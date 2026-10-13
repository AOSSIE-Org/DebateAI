package services_test

import (
	"context"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"arguehub/models"
	"arguehub/services"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func readyTournament() models.Tournament {
	t := tournamentFixture(models.VisibilityPublic)
	t.Participants = append(t.Participants,
		models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "Alice", Stance: models.StanceAgainst},
		models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "Bob", Stance: models.StanceFor})
	return t
}

func TestTournamentPhaseOrderAndCanonicalText(t *testing.T) {
	definitions := services.TournamentPhaseDefinitions()
	if len(definitions) != 8 || definitions[0].Round != "opening_statement_for" || definitions[7].Round != "closing_statement_against" {
		t.Fatal("wrong phase order")
	}
	sides := map[string]int{}
	for _, phase := range definitions {
		sides[phase.Stance]++
	}
	if sides[models.StanceFor] != 4 || sides[models.StanceAgainst] != 4 {
		t.Fatal("each side needs four phases")
	}
	a, hash, err := services.CanonicalTournamentTranscript("  First\r\nSecond\rThird  ")
	b, same, _ := services.CanonicalTournamentTranscript("First\nSecond\nThird")
	if err != nil || a != b || hash != same || len(hash) != 64 {
		t.Fatal("normalization/hash mismatch")
	}
	for _, text := range []string{"   ", "\x00text", string([]byte{0xff}), strings.Repeat("x", 8193), strings.Repeat("界", 2731)} {
		if _, _, err := services.CanonicalTournamentTranscript(text); !errors.Is(err, services.ErrTournamentTranscript) {
			t.Fatalf("accepted invalid input: %v", err)
		}
	}
	if _, _, err := services.CanonicalTournamentTranscript(strings.Repeat("x", 8192)); err != nil {
		t.Fatal(err)
	}
}

func TestTournamentMongoStartGuardsAndReplay(t *testing.T) {
	s, ctx := tournamentTestStore(t)
	now := time.Now().UTC().Truncate(time.Millisecond)
	e := services.TournamentExecutionService{Collection: s.Collection, Now: func() time.Time { return now }}
	tests := []struct {
		name   string
		modify func(*models.Tournament)
		want   error
	}{
		{"too few", func(t *models.Tournament) { t.Participants = t.Participants[:2] }, services.ErrTournamentNotReady},
		{"unset stance", func(t *models.Tournament) { t.Participants[1].Stance = "" }, services.ErrTournamentNotReady},
		{"one side", func(t *models.Tournament) { t.Participants[1].Stance = models.StanceFor }, services.ErrTournamentNotReady},
		{"duplicate", func(t *models.Tournament) { t.Participants[1].UserID = t.HostID }, services.ErrTournamentNotReady},
		{"oversized", func(t *models.Tournament) { t.MaxParticipants = 12 }, services.ErrTournamentNotReady},
		{"missing host", func(t *models.Tournament) { t.HostID = primitive.NewObjectID() }, services.ErrTournamentNotReady},
		{"scheduled", func(t *models.Tournament) { future := now.Add(time.Hour); t.ScheduleAt = &future }, services.ErrTournamentScheduled},
		{"legacy completed", func(t *models.Tournament) { t.Status = models.StatusCompleted }, services.ErrTournamentLocked},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			fixture := readyTournament()
			test.modify(&fixture)
			if err := s.Create(ctx, &fixture); err != nil {
				t.Fatal(err)
			}
			if _, _, err := e.Start(ctx, fixture.ID, fixture.HostID); !errors.Is(err, test.want) {
				t.Fatalf("got %v, want %v", err, test.want)
			}
			if test.name == "legacy completed" {
				if _, err := e.Get(ctx, fixture.ID, fixture.HostID); !errors.Is(err, services.ErrTournamentExecution) {
					t.Fatal("legacy completion mislabelled as a lobby")
				}
			}
		})
	}
	fixture := readyTournament()
	if err := s.Create(ctx, &fixture); err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.Start(ctx, fixture.ID, fixture.Participants[1].UserID); !errors.Is(err, services.ErrTournamentForbidden) {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	var writes atomic.Int32
	errList := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, created, err := e.Start(ctx, fixture.ID, fixture.HostID)
			if created {
				writes.Add(1)
			}
			errList <- err
		}()
	}
	wg.Wait()
	close(errList)
	for err := range errList {
		if err != nil {
			t.Fatal(err)
		}
	}
	stored, err := e.Get(ctx, fixture.ID, fixture.HostID)
	if err != nil || writes.Load() != 1 || stored.Revision != 1 || stored.SchemaVersion != 2 {
		t.Fatalf("start count/schema/revision: %d %+v %v", writes.Load(), stored, err)
	}
	slots := 0
	counts := map[primitive.ObjectID]int{}
	for _, phase := range stored.Execution.Phases {
		for _, slot := range phase.Slots {
			slots++
			counts[slot.UserID]++
		}
	}
	if slots != 12 || len(stored.Execution.Roster) != 3 {
		t.Fatal("wrong frozen inputs")
	}
	for _, count := range counts {
		if count != 4 {
			t.Fatal("not four slots per person")
		}
	}
	if stored.Execution.Phases[0].DeadlineAt.Sub(*stored.Execution.Phases[0].OpenedAt) != 180*time.Second {
		t.Fatal("wrong window")
	}
	if _, _, err := s.ChooseStance(ctx, fixture.ID, fixture.HostID, models.StanceAgainst); !errors.Is(err, services.ErrTournamentLocked) {
		t.Fatal(err)
	}
	if _, _, err := s.JoinPublic(ctx, fixture.ID, models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "Late"}); !errors.Is(err, services.ErrTournamentLocked) {
		t.Fatal(err)
	}
	if err := s.DeleteLobby(ctx, fixture.ID, fixture.HostID); !errors.Is(err, services.ErrTournamentLocked) {
		t.Fatal(err)
	}
}

func TestTournamentMongoTranscriptGuardsReplayAndDeadline(t *testing.T) {
	s, ctx := tournamentTestStore(t)
	now := time.Now().UTC().Truncate(time.Millisecond)
	e := services.TournamentExecutionService{Collection: s.Collection, Now: func() time.Time { return now }}
	fixture := readyTournament()
	fixture.Visibility = models.VisibilityPrivate
	if err := s.Create(ctx, &fixture); err != nil {
		t.Fatal(err)
	}
	run, _, err := e.Start(ctx, fixture.ID, fixture.HostID)
	if err != nil {
		t.Fatal(err)
	}
	round := run.Execution.Phases[0].Round
	if _, err := e.Get(ctx, fixture.ID, primitive.NewObjectID()); !errors.Is(err, services.ErrTournamentNotFound) {
		t.Fatal(err)
	}
	for _, test := range []struct {
		actor, run    primitive.ObjectID
		round, stance string
	}{
		{fixture.Participants[1].UserID, run.Execution.RunID, round, ""},
		{fixture.HostID, primitive.NewObjectID(), round, ""},
		{fixture.HostID, run.Execution.RunID, "closing_statement_for", ""},
		{fixture.HostID, run.Execution.RunID, round, "against"},
	} {
		if _, _, err := e.Submit(ctx, fixture.ID, test.actor, test.run, test.round, "Evidence", test.stance); !errors.Is(err, services.ErrTournamentPhase) {
			t.Fatal(err)
		}
	}
	var wg sync.WaitGroup
	var writes atomic.Int32
	errList := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, created, err := e.Submit(ctx, fixture.ID, fixture.HostID, run.Execution.RunID, round, "  Evidence\r\nText ", "for")
			if created {
				writes.Add(1)
			}
			errList <- err
		}()
	}
	wg.Wait()
	close(errList)
	for err := range errList {
		if err != nil {
			t.Fatal(err)
		}
	}
	if writes.Load() != 1 {
		t.Fatal("duplicate accepted writes")
	}
	if _, _, err := e.Submit(ctx, fixture.ID, fixture.HostID, run.Execution.RunID, round, "Changed", ""); !errors.Is(err, services.ErrTournamentSubmissionConflict) {
		t.Fatal(err)
	}
	now = *run.Execution.Phases[0].DeadlineAt
	if _, _, err := e.Submit(ctx, fixture.ID, fixture.Participants[2].UserID, run.Execution.RunID, round, "Too late", ""); !errors.Is(err, services.ErrTournamentPhase) {
		t.Fatal("late first accepted before recovery")
	}
	receipt, created, err := e.Submit(ctx, fixture.ID, fixture.HostID, run.Execution.RunID, round, "Evidence\nText", "")
	if err != nil || created || receipt.SubmittedAt == nil {
		t.Fatalf("late identical replay: %v", err)
	}
	advanced, err := e.Advance(ctx, fixture.ID)
	if err != nil || advanced.Execution.PhaseIndex != 1 || advanced.Execution.Phases[0].Slots[1].Status != models.SlotMissing {
		t.Fatalf("timeout missing/advance: %+v %v", advanced.Execution, err)
	}
	if _, created, err := e.Submit(ctx, fixture.ID, fixture.HostID, run.Execution.RunID, round, "Evidence\nText", ""); err != nil || created {
		t.Fatalf("closed phase replay: %v", err)
	}
}

func TestTournamentMongoEightPhasesSinglePendingHandoff(t *testing.T) {
	s, ctx := tournamentTestStore(t)
	now := time.Now().UTC().Truncate(time.Millisecond)
	e := services.TournamentExecutionService{Collection: s.Collection, Now: func() time.Time { return now }}
	fixture := readyTournament()
	fixture.Participants[2].Stance = models.StanceAgainst
	if err := s.Create(ctx, &fixture); err != nil {
		t.Fatal(err)
	}
	record, _, err := e.Start(ctx, fixture.ID, fixture.HostID)
	if err != nil {
		t.Fatal(err)
	}
	var finalReceipt services.TournamentSubmissionReceipt
	for index := 0; index < 8; index++ {
		record, err = e.Get(ctx, fixture.ID, fixture.HostID)
		if err != nil {
			t.Fatal(err)
		}
		if record.Execution.PhaseIndex != index {
			t.Fatal("phase not persisted")
		}
		phase := record.Execution.Phases[index]
		var wg sync.WaitGroup
		type result struct {
			receipt services.TournamentSubmissionReceipt
			err     error
		}
		results := make(chan result, len(phase.Slots)*2)
		for _, slot := range phase.Slots {
			for retry := 0; retry < 2; retry++ {
				wg.Add(1)
				go func(user primitive.ObjectID) {
					defer wg.Done()
					receipt, _, err := e.Submit(ctx, fixture.ID, user, record.Execution.RunID, phase.Round, "Attributed <script>text</script>", "")
					results <- result{receipt, err}
				}(slot.UserID)
			}
		}
		wg.Wait()
		close(results)
		for result := range results {
			if result.err != nil {
				t.Fatal(result.err)
			}
			finalReceipt = result.receipt
		}
	}
	record, err = e.Get(ctx, fixture.ID, fixture.HostID)
	if err != nil || record.Execution.State != models.ExecutionFinished || record.Evaluation == nil || record.Evaluation.State != "pending" || record.Status != models.StatusLive || record.Revision != 13 {
		t.Fatalf("final handoff: %+v %v", record, err)
	}
	if record.Evaluation.InputHash != services.TournamentInputHash(record) || len(record.Evaluation.InputHash) != 64 || record.Execution.DeadlineAt != nil {
		t.Fatal("wrong frozen hash/deadline")
	}
	id, revision := record.Evaluation.ID, record.Revision
	for i := 0; i < 3; i++ {
		if _, err := e.Advance(ctx, fixture.ID); err != nil {
			t.Fatal(err)
		}
	}
	if _, created, err := e.Submit(ctx, fixture.ID, finalReceipt.UserID, record.Execution.RunID, finalReceipt.Round, "Attributed <script>text</script>", ""); err != nil || created {
		t.Fatal("completed replay failed")
	}
	stored, err := e.Get(ctx, fixture.ID, fixture.HostID)
	if err != nil || stored.Evaluation.ID != id || stored.Revision != revision {
		t.Fatal("handoff regenerated")
	}
}

func TestTournamentMongoRecoveryAfterRestartAndMissing(t *testing.T) {
	s, ctx := tournamentTestStore(t)
	now := time.Now().UTC().Truncate(time.Millisecond)
	e := services.TournamentExecutionService{Collection: s.Collection, Now: func() time.Time { return now }}
	fixture := readyTournament()
	if err := s.Create(ctx, &fixture); err != nil {
		t.Fatal(err)
	}
	record, _, err := e.Start(ctx, fixture.ID, fixture.HostID)
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(5 * time.Hour)
	// New service instance has no in-memory run state; recovery is entirely persisted.
	restarted := services.TournamentExecutionService{Collection: s.Collection, Now: func() time.Time { return now }}
	count, err := restarted.Recover(ctx)
	if err != nil || count != 1 {
		t.Fatalf("restart scan: %d %v", count, err)
	}
	record, err = restarted.Get(ctx, fixture.ID, fixture.HostID)
	if err != nil || record.Execution.PhaseIndex != 1 || !record.Execution.Phases[1].OpenedAt.Equal(now) || !record.Execution.Phases[1].DeadlineAt.Equal(now.Add(180*time.Second)) {
		t.Fatal("downtime consumed future phases")
	}
	for index := 1; index < 8; index++ {
		now = *record.Execution.DeadlineAt
		if _, err := restarted.Recover(ctx); err != nil {
			t.Fatal(err)
		}
		record, err = restarted.Get(ctx, fixture.ID, fixture.HostID)
		if err != nil {
			t.Fatal(err)
		}
	}
	if record.Execution.State != models.ExecutionFinished || record.Evaluation == nil {
		t.Fatal("all-missing debate stalled")
	}
	for _, phase := range record.Execution.Phases {
		for _, slot := range phase.Slots {
			if slot.Status != models.SlotMissing || slot.Content != "" {
				t.Fatal("missing input was fabricated")
			}
		}
	}
	worker, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() { restarted.RunRecovery(worker); close(done) }()
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("worker did not stop")
	}
}

func TestTournamentMongoStartVersusAdmissionAndStance(t *testing.T) {
	s, ctx := tournamentTestStore(t)
	e := services.TournamentExecutionService{Collection: s.Collection}
	for i := 0; i < 6; i++ {
		fixture := readyTournament()
		fixture.MaxParticipants = 4
		if err := s.Create(ctx, &fixture); err != nil {
			t.Fatal(err)
		}
		newcomer := models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "Newcomer"}
		var wg sync.WaitGroup
		errs := make(chan error, 3)
		wg.Add(3)
		go func() { defer wg.Done(); _, _, err := e.Start(ctx, fixture.ID, fixture.HostID); errs <- err }()
		go func() { defer wg.Done(); _, _, err := s.JoinPublic(ctx, fixture.ID, newcomer); errs <- err }()
		go func() {
			defer wg.Done()
			_, _, err := s.ChooseStance(ctx, fixture.ID, fixture.Participants[2].UserID, models.StanceAgainst)
			errs <- err
		}()
		wg.Wait()
		close(errs)
		for err := range errs {
			if err != nil && !errors.Is(err, services.ErrTournamentLocked) && !errors.Is(err, services.ErrTournamentNotReady) {
				t.Fatal(err)
			}
		}
		var stored models.Tournament
		if err := s.Collection.FindOne(ctx, bson.M{"_id": fixture.ID}).Decode(&stored); err != nil {
			t.Fatal(err)
		}
		if stored.Execution != nil {
			if len(stored.Participants) != 3 || len(stored.Execution.Roster) != 3 {
				t.Fatal("join raced past frozen roster")
			}
			for index, member := range stored.Participants {
				if member != stored.Execution.Roster[index] {
					t.Fatal("stance raced past freeze")
				}
			}
		} else if len(stored.Participants) != 4 {
			t.Fatal("unexpected lobby outcome")
		}
	}
}

func TestTournamentMongoMaximumRosterAndFinalDeadlineRace(t *testing.T) {
	s, ctx := tournamentTestStore(t)
	now := time.Now().UTC().Truncate(time.Millisecond)
	e := services.TournamentExecutionService{Collection: s.Collection, Now: func() time.Time { return now }}
	fixture := readyTournament()
	fixture.MaxParticipants = 11
	for len(fixture.Participants) < 11 {
		fixture.Participants = append(fixture.Participants, models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "Member", Stance: models.StanceAgainst})
	}
	if err := s.Create(ctx, &fixture); err != nil {
		t.Fatal(err)
	}
	record, _, err := e.Start(ctx, fixture.ID, fixture.HostID)
	if err != nil {
		t.Fatal(err)
	}
	slots := 0
	for _, phase := range record.Execution.Phases {
		slots += len(phase.Slots)
	}
	if slots != 44 {
		t.Fatal("maximum roster must yield exactly 44 slots")
	}
	for record.Execution.PhaseIndex < 7 {
		phase := record.Execution.Phases[record.Execution.PhaseIndex]
		for _, slot := range phase.Slots {
			if _, _, err := e.Submit(ctx, fixture.ID, slot.UserID, record.Execution.RunID, phase.Round, "Earlier phase input", ""); err != nil {
				t.Fatal(err)
			}
		}
		record, err = e.Get(ctx, fixture.ID, fixture.HostID)
		if err != nil {
			t.Fatal(err)
		}
	}
	final := record.Execution.Phases[7]
	closing := services.TournamentExecutionService{Collection: s.Collection, Now: func() time.Time { return *final.DeadlineAt }}
	var wg sync.WaitGroup
	errs := make(chan error, len(final.Slots)+4)
	for _, slot := range final.Slots {
		wg.Add(1)
		go func(user primitive.ObjectID) {
			defer wg.Done()
			_, _, err := e.Submit(ctx, fixture.ID, user, record.Execution.RunID, final.Round, "Final input before deadline", "")
			errs <- err
		}(slot.UserID)
	}
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, err := closing.Advance(ctx, fixture.ID); errs <- err }()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil && !errors.Is(err, services.ErrTournamentPhase) {
			t.Fatal(err)
		}
	}
	stored, err := e.Get(ctx, fixture.ID, fixture.HostID)
	if err != nil || stored.Execution.State != models.ExecutionFinished || stored.Evaluation == nil || stored.Evaluation.InputHash != services.TournamentInputHash(stored) {
		t.Fatal("final race lost atomic handoff")
	}
	for _, slot := range stored.Execution.Phases[7].Slots {
		if slot.Status != models.SlotSubmitted && slot.Status != models.SlotMissing {
			t.Fatal("unclosed slot after race")
		}
	}
	evaluationID, revision := stored.Evaluation.ID, stored.Revision
	for i := 0; i < 3; i++ {
		if _, err := closing.Advance(ctx, fixture.ID); err != nil {
			t.Fatal(err)
		}
	}
	stored, err = e.Get(ctx, fixture.ID, fixture.HostID)
	if err != nil || stored.Evaluation.ID != evaluationID || stored.Revision != revision {
		t.Fatal("multiple handoffs after timeout race")
	}
}
