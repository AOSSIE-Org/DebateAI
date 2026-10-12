package services

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"arguehub/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type fixtureJudge struct {
	call  func(context.Context, TournamentJudgeRequest) ([]byte, error)
	model string
}

func (p fixtureJudge) Metadata() (string, string) {
	model := p.model
	if model == "" {
		model = "fixture-v1"
	}
	return "fixture", model
}
func (p fixtureJudge) Judge(ctx context.Context, request TournamentJudgeRequest) ([]byte, error) {
	if p.call != nil {
		return p.call(ctx, request)
	}
	return fixtureJudgeOutput(request, func(string) int { return 80 }), nil
}

func fixtureJudgeOutput(request TournamentJudgeRequest, total func(string) int) []byte {
	scores := []map[string]any{}
	for _, submission := range request.Submissions {
		remaining := total(submission.Speaker)
		criteria := map[string]int{}
		for _, component := range []struct {
			name string
			max  int
		}{{"reasoning", 35}, {"relevance", 25}, {"phaseSkill", 25}, {"clarity", 15}} {
			value := remaining
			if value > component.max {
				value = component.max
			}
			remaining -= value
			criteria[component.name] = value
		}
		scores = append(scores, map[string]any{"speaker": submission.Speaker, "criteria": criteria, "explanation": "Fixture rubric response; not live AI evidence."})
	}
	raw, _ := json.Marshal(map[string]any{"round": request.Round, "scores": scores})
	return raw
}

func evaluationFixture() models.Tournament {
	now := time.Now().UTC().Truncate(time.Millisecond)
	host := primitive.NewObjectID()
	roster := []models.TournamentParticipant{{UserID: host, Name: "Host private name", Stance: models.StanceFor}, {UserID: primitive.NewObjectID(), Name: "Alice private name", Stance: models.StanceAgainst}, {UserID: primitive.NewObjectID(), Name: "Bob private name", Stance: models.StanceFor}}
	t := models.Tournament{ID: primitive.NewObjectID(), HostID: host, Topic: "Should cities invest in transit?", Visibility: models.VisibilityPublic, Status: models.StatusLive, MinParticipants: 3, MaxParticipants: 3, Participants: roster, SchemaVersion: 2, CreatedAt: now, InviteCode: "123456"}
	t.Execution = &models.TournamentExecution{RunID: primitive.NewObjectID(), State: models.ExecutionFinished, Roster: roster, PhaseIndex: 7, StartedAt: now, FinishedAt: &now}
	for _, definition := range TournamentPhaseDefinitions() {
		phase := models.TournamentPhase{Round: definition.Round, Status: models.PhaseClosed, OpenedAt: &now, ClosedAt: &now}
		for _, member := range roster {
			if member.Stance == definition.Stance {
				content, hash, _ := CanonicalTournamentTranscript("Supported argument about transit: " + definition.Round)
				phase.Slots = append(phase.Slots, models.TournamentSubmissionSlot{UserID: member.UserID, Status: models.SlotSubmitted, Content: content, ContentHash: hash, SubmittedAt: &now})
			}
		}
		t.Execution.Phases = append(t.Execution.Phases, phase)
	}
	t.Evaluation = &models.TournamentEvaluation{ID: primitive.NewObjectID(), TournamentID: t.ID, RunID: t.Execution.RunID, State: models.EvaluationPending, InputHash: TournamentInputHash(t), CreatedAt: now}
	return t
}

func evaluationStore(t *testing.T) (*mongo.Collection, context.Context) {
	t.Helper()
	uri := os.Getenv("TOURNAMENT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("set TOURNAMENT_TEST_MONGO_URI for isolated Mongo evaluation tests")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	database := client.Database("debateai_evaluation_test_" + primitive.NewObjectID().Hex())
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		_ = database.Drop(cleanup)
		_ = client.Disconnect(cleanup)
		cancel()
	})
	if err := client.Ping(ctx, nil); err != nil {
		t.Fatal(err)
	}
	return database.Collection("tournaments"), ctx
}

func putEvaluation(t *testing.T, ctx context.Context, collection *mongo.Collection, fixture models.Tournament) {
	t.Helper()
	if _, err := collection.InsertOne(ctx, fixture); err != nil {
		t.Fatal(err)
	}
}
func readEvaluation(t *testing.T, ctx context.Context, collection *mongo.Collection, id primitive.ObjectID) models.Tournament {
	t.Helper()
	var result models.Tournament
	if err := collection.FindOne(ctx, bson.M{"_id": id}).Decode(&result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestTournamentJudgeStrictOutput(t *testing.T) {
	fixture := evaluationFixture()
	request := tournamentJudgeRequest(fixture, 0)
	good := string(fixtureJudgeOutput(request, func(string) int { return 100 }))
	if scores, err := decodeJudgeOutput([]byte(good), request); err != nil || len(scores) != 2 {
		t.Fatalf("valid output rejected: %v", err)
	}
	cases := map[string]string{
		"wrong round":          strings.Replace(good, request.Round, "closing_statement_for", 1),
		"wrong speaker":        strings.Replace(good, "speaker_01", "forged_id", 1),
		"duplicate speaker":    strings.Replace(good, "speaker_03", "speaker_01", 1),
		"missing component":    strings.Replace(good, `"clarity":15,`, "", 1),
		"null component":       strings.Replace(good, `"clarity":15`, `"clarity":null`, 1),
		"fraction":             strings.Replace(good, `"clarity":15`, `"clarity":1.5`, 1),
		"range":                strings.Replace(good, `"clarity":15`, `"clarity":16`, 1),
		"negative":             strings.Replace(good, `"clarity":15`, `"clarity":-1`, 1),
		"unknown":              strings.Replace(good, `"round":`, `"winner":"for","round":`, 1),
		"duplicate key":        strings.Replace(good, `"round":`, `"round":"x","round":`, 1),
		"wrong casing":         strings.Replace(good, `"round":`, `"Round":`, 1),
		"null scores":          `{"round":"` + request.Round + `","scores":null}`,
		"empty scores":         `{"round":"` + request.Round + `","scores":[]}`,
		"too long explanation": strings.Replace(good, "Fixture rubric response; not live AI evidence.", strings.Repeat("x", 501), 1),
		"blank explanation":    strings.Replace(good, "Fixture rubric response; not live AI evidence.", " ", 1),
		"null explanation":     strings.Replace(good, `"explanation":"Fixture rubric response; not live AI evidence."`, `"explanation":null`, 1),
		"trailing":             good + ` {}`,
		"fence":                "```json\n" + good + "\n```",
		"truncated":            good[:len(good)-2],
		"utf8":                 good + string([]byte{255}),
		"oversized":            strings.Repeat(" ", TournamentProviderOutputLimit+1),
	}
	for name, raw := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := decodeJudgeOutput([]byte(raw), request); !errors.Is(err, ErrTournamentEvaluationOutput) {
				t.Fatalf("accepted invalid output: %v", err)
			}
		})
	}
}

func TestTournamentEvaluationInputAndPrivacy(t *testing.T) {
	fixture := evaluationFixture()
	if err := validateEvaluationInput(fixture); err != nil {
		t.Fatal(err)
	}
	request := tournamentJudgeRequest(fixture, 7)
	data, _ := json.Marshal(request)
	for _, member := range fixture.Execution.Roster {
		if strings.Contains(string(data), member.Name) || strings.Contains(string(data), member.UserID.Hex()) {
			t.Fatal("provider sees profile identity")
		}
	}
	if strings.Contains(string(data), fixture.InviteCode) || strings.Contains(string(data), fixture.ID.Hex()) {
		t.Fatal("provider sees private metadata")
	}
	if request.Context == nil || len(request.Context) == 0 {
		t.Fatal("lost debate context")
	}
	for _, mutate := range []func(*models.Tournament){
		func(t *models.Tournament) { t.Topic = strings.Repeat("x", 101) },
		func(t *models.Tournament) { t.Execution.Phases[0].Slots[0].ContentHash = "wrong" },
		func(t *models.Tournament) {
			t.Execution.Phases[0].Slots[0].UserID = t.Execution.Phases[0].Slots[1].UserID
		},
		func(t *models.Tournament) { t.Execution.Phases[0].Round = "wrong" },
		func(t *models.Tournament) { t.Execution.Phases[0].Status = models.PhaseOpen },
		func(t *models.Tournament) { t.Execution.Phases[0].Slots[0].Status = models.SlotPending },
		func(t *models.Tournament) { t.Execution.Roster[0].Stance = "" },
		func(t *models.Tournament) { t.Evaluation.RunID = primitive.NewObjectID() },
	} {
		broken := evaluationFixture()
		mutate(&broken)
		broken.Evaluation.InputHash = TournamentInputHash(broken)
		if err := validateEvaluationInput(broken); err == nil {
			t.Fatal("accepted corrupt input")
		}
	}
	// Maximum original text remains intact; only previous context is clipped.
	for pi := range fixture.Execution.Phases {
		for si := range fixture.Execution.Phases[pi].Slots {
			slot := &fixture.Execution.Phases[pi].Slots[si]
			slot.Content, slot.ContentHash, _ = CanonicalTournamentTranscript(strings.Repeat("界", 2730))
		}
	}
	request = tournamentJudgeRequest(fixture, 7)
	length := 0
	for _, entry := range request.Context {
		length += len(entry.Content)
		if !entry.Truncated {
			t.Fatal("context was not bounded")
		}
	}
	if length > 16384 || len(request.Submissions[0].Content) != 8190 {
		t.Fatal("context bound or complete target text violated")
	}
}

func TestTournamentEvaluationAggregation(t *testing.T) {
	fixture := evaluationFixture()
	service := TournamentEvaluationService{Provider: fixtureJudge{call: func(ctx context.Context, r TournamentJudgeRequest) ([]byte, error) {
		return fixtureJudgeOutput(r, func(alias string) int {
			switch alias {
			case "speaker_01":
				return 100
			case "speaker_02":
				return 60
			default:
				return 0
			}
		}), nil
	}}}
	fixture.Evaluation.RubricVersion = TournamentRubricVersion
	fixture.Evaluation.Provider = "fixture"
	fixture.Evaluation.Model = "fixture-v1"
	fixture.Evaluation.Attempts = 1
	result, err := service.evaluate(context.Background(), fixture)
	if err != nil {
		t.Fatal(err)
	}
	winner, totals, means := aggregateTournamentScores(fixture, result)
	if winner.Side != models.StanceAgainst || winner.Individual.UserID != fixture.HostID || totals[0].TotalScore != 400 || means[0].Mean != 200 || means[1].Mean != 240 {
		t.Fatalf("unfair side sum or constrained individual: %+v %+v", winner, means)
	}
	service.Provider = fixtureJudge{}
	result, err = service.evaluate(context.Background(), fixture)
	if err != nil {
		t.Fatal(err)
	}
	winner, _, _ = aggregateTournamentScores(fixture, result)
	if winner.Side != "draw" || winner.Individual != nil || len(winner.TiedIndividuals) != 3 {
		t.Fatal("ties lost")
	}
	raw, _ := json.Marshal(winner)
	if !strings.Contains(string(raw), `"individual":null`) {
		t.Fatal("tie serialized as fake individual")
	}
}

func TestTournamentEvaluationMaximumRosterPayload(t *testing.T) {
	fixture := evaluationFixture()
	for i := 0; i < 8; i++ {
		fixture.Execution.Roster = append(fixture.Execution.Roster, models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "Extra", Stance: models.StanceFor})
	}
	fixture.MaxParticipants = 11
	fixture.Participants = fixture.Execution.Roster
	fixture.Execution.Phases = nil
	text, hash, err := CanonicalTournamentTranscript(strings.Repeat("\x01", 8192))
	if err != nil {
		t.Fatal(err)
	}
	for _, definition := range TournamentPhaseDefinitions() {
		phase := models.TournamentPhase{Round: definition.Round, Status: models.PhaseClosed, ClosedAt: fixture.Execution.FinishedAt}
		for _, member := range fixture.Execution.Roster {
			if member.Stance == definition.Stance {
				phase.Slots = append(phase.Slots, models.TournamentSubmissionSlot{UserID: member.UserID, Status: models.SlotSubmitted, Content: text, ContentHash: hash, SubmittedAt: fixture.Execution.FinishedAt})
			}
		}
		fixture.Execution.Phases = append(fixture.Execution.Phases, phase)
	}
	fixture.Evaluation.InputHash = TournamentInputHash(fixture)
	if err := validateEvaluationInput(fixture); err != nil {
		t.Fatal(err)
	}
	request := tournamentJudgeRequest(fixture, 6)
	raw, err := json.Marshal(request)
	if err != nil || len(raw) > 640*1024 || len(request.Submissions) != 10 {
		t.Fatal("maximum escaped evidence exceeds phase budget")
	}
	for _, submission := range request.Submissions {
		if len(submission.Content) != 8192 {
			t.Fatal("target evidence truncated")
		}
	}
}

func TestTournamentEvaluationMongoExclusiveClaimAndPublication(t *testing.T) {
	collection, ctx := evaluationStore(t)
	fixture := evaluationFixture()
	putEvaluation(t, ctx, collection, fixture)
	s := TournamentEvaluationService{Collection: collection, Provider: fixtureJudge{}}
	var wg sync.WaitGroup
	var claims atomic.Int32
	claimed := make(chan models.Tournament, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			record, err := s.Claim(ctx)
			if err == nil {
				claims.Add(1)
				claimed <- record
			} else if !errors.Is(err, mongo.ErrNoDocuments) {
				t.Errorf("claim: %v", err)
			}
		}()
	}
	wg.Wait()
	close(claimed)
	if claims.Load() != 1 {
		t.Fatal("multiple lease owners")
	}
	record := <-claimed
	if changed, err := s.ProcessClaim(ctx, record); err != nil || !changed {
		t.Fatalf("publish: %v %v", changed, err)
	}
	final := readEvaluation(t, ctx, collection, fixture.ID)
	if final.Status != models.StatusCompleted || final.Evaluation.State != models.EvaluationCompleted || final.Evaluation.Result == nil || final.Evaluation.Winner == nil || final.Evaluation.LeaseToken != "" || final.Revision != 2 || final.Evaluation.Attempts != 1 {
		t.Fatal("non-atomic final result")
	}
	if changed, err := s.ProcessClaim(ctx, record); err != nil || changed {
		t.Fatal("same claim republished")
	}
	if _, err := s.Claim(ctx); !errors.Is(err, mongo.ErrNoDocuments) {
		t.Fatal("completed result re-claimed")
	}
	if final.Evaluation.InputHash != TournamentInputHash(final) || final.Execution.Phases[0].Slots[0].Content == "" {
		t.Fatal("inputs discarded/changed")
	}
}

func TestTournamentEvaluationMongoExpiredLeaseFencing(t *testing.T) {
	collection, ctx := evaluationStore(t)
	fixture := evaluationFixture()
	putEvaluation(t, ctx, collection, fixture)
	now := time.Now().UTC().Truncate(time.Millisecond)
	s := TournamentEvaluationService{Collection: collection, Provider: fixtureJudge{}, Now: func() time.Time { return now }}
	old, err := s.Claim(ctx)
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(151 * time.Second)
	newer, err := s.Claim(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if newer.Evaluation.LeaseToken == old.Evaluation.LeaseToken || newer.Evaluation.Attempts != 2 {
		t.Fatal("lease not recovered")
	}
	if changed, err := s.ProcessClaim(ctx, old); err != nil || changed {
		t.Fatal("stale worker published")
	}
	if changed, err := s.ProcessClaim(ctx, newer); err != nil || !changed {
		t.Fatal("new owner failed")
	}
	if changed, err := s.fail(ctx, old, errors.New("secret raw error")); err != nil || changed {
		t.Fatal("stale failure overwrote result")
	}
	final := readEvaluation(t, ctx, collection, fixture.ID)
	if final.Evaluation.State != models.EvaluationCompleted || final.Evaluation.LastErrorCode != "" {
		t.Fatal("new result overwritten")
	}
}

func TestTournamentEvaluationMongoRetriesAndTerminalFailures(t *testing.T) {
	collection, ctx := evaluationStore(t)
	fixture := evaluationFixture()
	putEvaluation(t, ctx, collection, fixture)
	now := time.Now().UTC().Truncate(time.Millisecond)
	calls := 0
	s := TournamentEvaluationService{Collection: collection, Now: func() time.Time { return now }, Provider: fixtureJudge{call: func(context.Context, TournamentJudgeRequest) ([]byte, error) {
		calls++
		return nil, &TournamentJudgeError{Code: "provider_rate_limited", Retryable: true}
	}}}
	for attempt := 1; attempt <= 3; attempt++ {
		if changed, err := s.ProcessNext(ctx); err != nil || !changed {
			t.Fatal(err)
		}
		stored := readEvaluation(t, ctx, collection, fixture.ID)
		if stored.Evaluation.Attempts != attempt || stored.Status != models.StatusLive || stored.Evaluation.Winner != nil || stored.Evaluation.Result != nil {
			t.Fatal("provider failure made a result")
		}
		if attempt < 3 {
			if stored.Evaluation.State != models.EvaluationPending || stored.Evaluation.NextAttemptAt == nil {
				t.Fatal("no durable retry")
			}
			minimum := 5 * time.Second
			if attempt == 2 {
				minimum = 30 * time.Second
			}
			delay := stored.Evaluation.NextAttemptAt.Sub(now)
			if delay < minimum || delay > minimum+time.Second {
				t.Fatal("backoff outside bound")
			}
			if changed, err := s.ProcessNext(ctx); err != nil || changed {
				t.Fatal("retry before due")
			}
			now = *stored.Evaluation.NextAttemptAt
		} else if stored.Evaluation.State != models.EvaluationFailed || stored.Evaluation.LeaseToken != "" {
			t.Fatal("not terminal")
		}
	}
	if calls != 3 {
		t.Fatal("unbounded calls")
	}
	if changed, err := s.ProcessNext(ctx); err != nil || changed {
		t.Fatal("terminal re-queued")
	}
}

func TestTournamentEvaluationMongoInvalidOutputCorrection(t *testing.T) {
	collection, ctx := evaluationStore(t)
	for _, succeeds := range []bool{false, true} {
		fixture := evaluationFixture()
		putEvaluation(t, ctx, collection, fixture)
		calls := 0
		s := TournamentEvaluationService{Collection: collection, Provider: fixtureJudge{call: func(_ context.Context, r TournamentJudgeRequest) ([]byte, error) {
			calls++
			if calls == 1 || !succeeds {
				return []byte(`{"winner":"for"}`), nil
			}
			if calls == 2 && !r.Corrective {
				t.Error("correction not requested")
			}
			return fixtureJudgeOutput(r, func(string) int { return 80 }), nil
		}}}
		if changed, err := s.ProcessNext(ctx); err != nil || !changed {
			t.Fatal(err)
		}
		stored := readEvaluation(t, ctx, collection, fixture.ID)
		if succeeds {
			if stored.Evaluation.State != models.EvaluationCompleted || calls != 9 {
				t.Fatal("valid correction not published")
			}
		} else if stored.Evaluation.State != models.EvaluationFailed || stored.Evaluation.LastErrorCode != "invalid_output" || calls != 2 || stored.Evaluation.Winner != nil {
			t.Fatal("invalid output not terminal/bounded")
		}
	}
}

func TestTournamentEvaluationMongoMissingAndCorruptInput(t *testing.T) {
	collection, ctx := evaluationStore(t)
	fixture := evaluationFixture()
	for pi := range fixture.Execution.Phases {
		for si := range fixture.Execution.Phases[pi].Slots {
			slot := &fixture.Execution.Phases[pi].Slots[si]
			*slot = models.TournamentSubmissionSlot{UserID: slot.UserID, Status: models.SlotMissing}
		}
	}
	fixture.Evaluation.InputHash = TournamentInputHash(fixture)
	putEvaluation(t, ctx, collection, fixture)
	s := TournamentEvaluationService{Collection: collection, Provider: fixtureJudge{call: func(context.Context, TournamentJudgeRequest) ([]byte, error) {
		t.Error("missing inputs sent to provider")
		return nil, errors.New("unexpected")
	}}}
	if changed, err := s.ProcessNext(ctx); err != nil || !changed {
		t.Fatal(err)
	}
	stored := readEvaluation(t, ctx, collection, fixture.ID)
	if stored.Evaluation.Winner.Side != "draw" || stored.Evaluation.Winner.Individual != nil || len(stored.Evaluation.Winner.TiedIndividuals) != 3 {
		t.Fatal("all missing winner invented")
	}
	for _, round := range stored.Evaluation.Result.Rounds() {
		for _, score := range round.Scores {
			if score.Score != 0 || score.SubmissionStatus != models.SlotMissing {
				t.Fatal("missing not explicit")
			}
		}
	}
	broken := evaluationFixture()
	broken.Execution.Phases[0].Slots[0].Content = "changed"
	putEvaluation(t, ctx, collection, broken)
	if changed, err := s.ProcessNext(ctx); err != nil || !changed {
		t.Fatal(err)
	}
	stored = readEvaluation(t, ctx, collection, broken.ID)
	if stored.Evaluation.State != models.EvaluationFailed || stored.Evaluation.LastErrorCode != "invalid_input" || stored.Status != models.StatusLive {
		t.Fatal("corrupt frozen inputs published")
	}
}

func TestTournamentEvaluationMongoCancellationRecoveryAndExhaustion(t *testing.T) {
	collection, ctx := evaluationStore(t)
	fixture := evaluationFixture()
	putEvaluation(t, ctx, collection, fixture)
	now := time.Now().UTC().Truncate(time.Millisecond)
	s := TournamentEvaluationService{Collection: collection, Provider: fixtureJudge{}, Now: func() time.Time { return now }}
	claim, err := s.Claim(ctx)
	if err != nil {
		t.Fatal(err)
	}
	cancelled, stop := context.WithCancel(ctx)
	stop()
	if changed, err := s.ProcessClaim(cancelled, claim); !errors.Is(err, context.Canceled) || changed {
		t.Fatal("shutdown stored a fake failure")
	}
	for attempt := 2; attempt <= 3; attempt++ {
		now = now.Add(151 * time.Second)
		claim, err = s.Claim(ctx)
		if err != nil || claim.Evaluation.Attempts != attempt {
			t.Fatal("crash reclaim failed")
		}
	}
	now = now.Add(151 * time.Second)
	if changed, err := s.ProcessNext(ctx); err != nil || !changed {
		t.Fatal(err)
	}
	stored := readEvaluation(t, ctx, collection, fixture.ID)
	if stored.Evaluation.State != models.EvaluationFailed || stored.Evaluation.Attempts != 3 || stored.Evaluation.LastErrorCode != "provider_attempts_exhausted" {
		t.Fatal("crash retry budget bypassed")
	}
}

func TestTournamentEvaluationMongoPinnedModelAndMidCallInputChange(t *testing.T) {
	collection, ctx := evaluationStore(t)
	fixture := evaluationFixture()
	putEvaluation(t, ctx, collection, fixture)
	now := time.Now().UTC().Truncate(time.Millisecond)
	s := TournamentEvaluationService{Collection: collection, Provider: fixtureJudge{}, Now: func() time.Time { return now }}
	if _, err := s.Claim(ctx); err != nil {
		t.Fatal(err)
	}
	now = now.Add(151 * time.Second)
	s.Provider = fixtureJudge{model: "other-model", call: func(context.Context, TournamentJudgeRequest) ([]byte, error) {
		t.Error("changed model used")
		return nil, nil
	}}
	if changed, err := s.ProcessNext(ctx); err != nil || !changed {
		t.Fatal(err)
	}
	stored := readEvaluation(t, ctx, collection, fixture.ID)
	if stored.Evaluation.LastErrorCode != "provider_configuration" || stored.Evaluation.Model != "fixture-v1" {
		t.Fatal("model not pinned")
	}
	second := evaluationFixture()
	putEvaluation(t, ctx, collection, second)
	s.Provider = fixtureJudge{call: func(_ context.Context, r TournamentJudgeRequest) ([]byte, error) {
		_, err := collection.UpdateOne(ctx, bson.M{"_id": second.ID}, bson.M{"$set": bson.M{"topic": "tampered"}})
		if err != nil {
			t.Fatal(err)
		}
		return fixtureJudgeOutput(r, func(string) int { return 80 }), nil
	}}
	if changed, err := s.ProcessNext(ctx); err != nil || !changed {
		t.Fatal(err)
	}
	stored = readEvaluation(t, ctx, collection, second.ID)
	if stored.Evaluation.State != models.EvaluationFailed || stored.Evaluation.Winner != nil {
		t.Fatal("input changed during call published")
	}
}

func TestTournamentEvaluationMongoWorkerStartupAndShutdown(t *testing.T) {
	collection, ctx := evaluationStore(t)
	fixture := evaluationFixture()
	putEvaluation(t, ctx, collection, fixture)
	var active, peak atomic.Int32
	s := TournamentEvaluationService{Collection: collection, Provider: fixtureJudge{call: func(ctx context.Context, r TournamentJudgeRequest) ([]byte, error) {
		n := active.Add(1)
		for {
			p := peak.Load()
			if n <= p || peak.CompareAndSwap(p, n) {
				break
			}
		}
		defer active.Add(-1)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(2 * time.Millisecond):
		}
		return fixtureJudgeOutput(r, func(string) int { return 80 }), nil
	}}}
	for i := 0; i < 3; i++ {
		putEvaluation(t, ctx, collection, evaluationFixture())
	}
	run, stop := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() { s.Run(run); close(done) }()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		count, err := collection.CountDocuments(ctx, bson.M{"evaluation.state": models.EvaluationCompleted})
		if err != nil {
			t.Fatal(err)
		}
		if count == 4 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	stop()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("worker did not stop")
	}
	count, _ := collection.CountDocuments(ctx, bson.M{"evaluation.state": models.EvaluationCompleted})
	if count != 4 || peak.Load() > 2 || peak.Load() == 0 {
		t.Fatalf("startup recovery/concurrency: count=%d peak=%d", count, peak.Load())
	}
}

func TestTournamentEvaluationWorkerProcessHelper(t *testing.T) {
	databaseName := os.Getenv("TOURNAMENT_EVALUATION_TEST_CHILD_DB")
	if databaseName == "" {
		return
	}
	if !strings.HasPrefix(databaseName, "debateai_evaluation_test_") {
		t.Fatal("unexpected child database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(os.Getenv("TOURNAMENT_TEST_MONGO_URI")))
	if err != nil {
		t.Fatal(err)
	}
	defer client.Disconnect(ctx)
	service := TournamentEvaluationService{Collection: client.Database(databaseName).Collection("tournaments"), Provider: fixtureJudge{}}
	switch os.Getenv("TOURNAMENT_EVALUATION_TEST_CHILD_MODE") {
	case "claim":
		if _, err := service.Claim(ctx); err != nil {
			t.Fatal(err)
		}
	case "recover":
		if changed, err := service.ProcessNext(ctx); err != nil || !changed {
			t.Fatalf("recovery: %v %v", changed, err)
		}
	default:
		t.Fatal("unexpected child mode")
	}
}

func TestTournamentEvaluationMongoCrossProcessRecovery(t *testing.T) {
	collection, ctx := evaluationStore(t)
	fixture := evaluationFixture()
	putEvaluation(t, ctx, collection, fixture)
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	for _, mode := range []string{"claim", "recover"} {
		child := exec.CommandContext(ctx, executable, "-test.run=^TestTournamentEvaluationWorkerProcessHelper$", "-test.count=1")
		child.Env = append(os.Environ(), "TOURNAMENT_EVALUATION_TEST_CHILD_DB="+collection.Database().Name(), "TOURNAMENT_EVALUATION_TEST_CHILD_MODE="+mode)
		if output, err := child.CombinedOutput(); err != nil {
			t.Fatalf("child %s: %v %s", mode, err, output)
		}
		stored := readEvaluation(t, ctx, collection, fixture.ID)
		if mode == "claim" {
			if stored.Evaluation.State != models.EvaluationRunning || stored.Evaluation.Attempts != 1 {
				t.Fatal("child did not persist claim")
			}
			// Only this disposable test's exact job is advanced to simulate lease expiry.
			_, err := collection.UpdateOne(ctx, bson.M{"_id": fixture.ID, "evaluation.runId": fixture.Execution.RunID, "evaluation.leaseToken": stored.Evaluation.LeaseToken}, bson.M{"$set": bson.M{"evaluation.leaseUntil": time.Now().Add(-time.Second)}})
			if err != nil {
				t.Fatal(err)
			}
		} else if stored.Evaluation.State != models.EvaluationCompleted || stored.Evaluation.Attempts != 2 || stored.Status != models.StatusCompleted {
			t.Fatal("new process failed to recover persisted lease")
		}
	}
}
