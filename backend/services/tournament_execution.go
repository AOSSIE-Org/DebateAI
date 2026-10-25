package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"
	"unicode/utf8"

	"arguehub/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	ErrTournamentNotReady           = errors.New("Roster needs valid stances on both sides and the required participants")
	ErrTournamentScheduled          = errors.New("Scheduled start time has not been reached")
	ErrTournamentExecution          = errors.New("Tournament execution is not available")
	ErrTournamentPhase              = errors.New("This run or phase is not open for submission")
	ErrTournamentTranscript         = errors.New("Transcript must contain valid text of at most 8192 UTF-8 bytes")
	ErrTournamentSubmissionConflict = errors.New("An accepted transcript cannot be changed")
)

type TournamentPhaseDefinition struct{ Round, Stance string }

func TournamentPhaseDefinitions() []TournamentPhaseDefinition {
	return []TournamentPhaseDefinition{
		{"opening_statement_for", models.StanceFor},
		{"opening_statement_against", models.StanceAgainst},
		{"cross_examination_question_for", models.StanceFor},
		{"cross_examination_answer_against", models.StanceAgainst},
		{"cross_examination_question_against", models.StanceAgainst},
		{"cross_examination_answer_for", models.StanceFor},
		{"closing_statement_for", models.StanceFor},
		{"closing_statement_against", models.StanceAgainst},
	}
}

type TournamentExecutionService struct {
	Collection *mongo.Collection
	Now        func() time.Time
}

func (s TournamentExecutionService) ServerTime() time.Time {
	if s.Now != nil {
		return s.Now().UTC().Truncate(time.Millisecond)
	}
	return time.Now().UTC().Truncate(time.Millisecond)
}

func (s TournamentExecutionService) read(ctx context.Context, id primitive.ObjectID) (models.Tournament, error) {
	var t models.Tournament
	if s.Collection == nil {
		return t, ErrTournamentUnavailable
	}
	err := s.Collection.FindOne(ctx, bson.M{"_id": id}).Decode(&t)
	if errors.Is(err, mongo.ErrNoDocuments) {
		err = ErrTournamentNotFound
	}
	return t, err
}

func executionPermission(t models.Tournament, actor primitive.ObjectID) error {
	if !actor.IsZero() && (t.HostID == actor || TournamentHasMember(t, actor)) {
		return nil
	}
	if t.Visibility == models.VisibilityPrivate {
		return ErrTournamentNotFound
	}
	return ErrTournamentForbidden
}

func validateTournamentRoster(t models.Tournament, now time.Time) error {
	if t.MinParticipants < 3 || t.MaxParticipants > 11 || t.MaxParticipants < t.MinParticipants || len(t.Participants) < t.MinParticipants || len(t.Participants) > t.MaxParticipants {
		return ErrTournamentNotReady
	}
	seen := make(map[primitive.ObjectID]bool)
	forCount, againstCount := 0, 0
	for _, member := range t.Participants {
		if member.UserID.IsZero() || seen[member.UserID] || strings.TrimSpace(member.Name) == "" || len(member.Name) > 80 || !utf8.ValidString(member.Name) {
			return ErrTournamentNotReady
		}
		seen[member.UserID] = true
		switch member.Stance {
		case models.StanceFor:
			forCount++
		case models.StanceAgainst:
			againstCount++
		default:
			return ErrTournamentNotReady
		}
	}
	if !seen[t.HostID] || forCount == 0 || againstCount == 0 {
		return ErrTournamentNotReady
	}
	if t.ScheduleAt != nil && now.Before(*t.ScheduleAt) {
		return ErrTournamentScheduled
	}
	return nil
}

func openTournamentPhase(execution *models.TournamentExecution, now time.Time) {
	phase := &execution.Phases[execution.PhaseIndex]
	deadline := now.Add(models.TournamentPhaseSeconds * time.Second)
	phase.Status, phase.OpenedAt, phase.DeadlineAt = models.PhaseOpen, &now, &deadline
	execution.DeadlineAt = &deadline
}

func (s TournamentExecutionService) Start(ctx context.Context, id, actor primitive.ObjectID) (models.Tournament, bool, error) {
	return (TournamentService{Collection: s.Collection}).mutate(ctx, id, func(t *models.Tournament) (bson.M, error) {
		if actor.IsZero() {
			return nil, ErrTournamentForbidden
		}
		if err := tournamentHostPermission(*t, actor); err != nil {
			return nil, err
		}
		if t.Execution != nil {
			if t.Execution.RunID.IsZero() {
				return nil, ErrTournamentExecution
			}
			return nil, nil
		}
		if !TournamentLobbyOpen(*t) {
			return nil, ErrTournamentLocked
		}
		now := s.ServerTime()
		if err := validateTournamentRoster(*t, now); err != nil {
			return nil, err
		}
		execution := &models.TournamentExecution{RunID: primitive.NewObjectID(), State: models.ExecutionRunning, Roster: append([]models.TournamentParticipant(nil), t.Participants...), StartedAt: now}
		for _, definition := range TournamentPhaseDefinitions() {
			phase := models.TournamentPhase{Round: definition.Round, Status: models.PhaseWaiting, Slots: []models.TournamentSubmissionSlot{}}
			for _, member := range execution.Roster {
				if member.Stance == definition.Stance {
					phase.Slots = append(phase.Slots, models.TournamentSubmissionSlot{UserID: member.UserID, Status: models.SlotPending})
				}
			}
			execution.Phases = append(execution.Phases, phase)
		}
		openTournamentPhase(execution, now)
		return bson.M{"execution": execution, "status": models.StatusLive, "schemaVersion": 2}, nil
	})
}

func validTournamentExecution(execution *models.TournamentExecution) bool {
	if execution == nil || execution.RunID.IsZero() || len(execution.Phases) != 8 || execution.PhaseIndex < 0 || execution.PhaseIndex >= 8 {
		return false
	}
	return execution.State == models.ExecutionRunning || execution.State == models.ExecutionFinished
}

// A phase closes once; after downtime the next window starts now, not in the past.
func closeTournamentPhase(t *models.Tournament, now time.Time) bool {
	execution := t.Execution
	if !validTournamentExecution(execution) || execution.State != models.ExecutionRunning {
		return false
	}
	phase := &execution.Phases[execution.PhaseIndex]
	if phase.Status != models.PhaseOpen || phase.DeadlineAt == nil {
		return false
	}
	allSubmitted := true
	for _, slot := range phase.Slots {
		if slot.Status != models.SlotSubmitted {
			allSubmitted = false
		}
	}
	if !allSubmitted && now.Before(*phase.DeadlineAt) {
		return false
	}
	for index := range phase.Slots {
		if phase.Slots[index].Status == models.SlotPending {
			phase.Slots[index].Status = models.SlotMissing
		}
	}
	phase.Status, phase.ClosedAt = models.PhaseClosed, &now
	if execution.PhaseIndex < len(execution.Phases)-1 {
		execution.PhaseIndex++
		openTournamentPhase(execution, now)
	} else {
		execution.State, execution.FinishedAt, execution.DeadlineAt = models.ExecutionFinished, &now, nil
		t.Evaluation = &models.TournamentEvaluation{ID: primitive.NewObjectID(), TournamentID: t.ID, RunID: execution.RunID, State: "pending", InputHash: TournamentInputHash(*t), CreatedAt: now}
	}
	return true
}

// Hash exactly the frozen attributable inputs, independent of retry timestamps.
func TournamentInputHash(t models.Tournament) string {
	if t.Execution == nil {
		return ""
	}
	type slotInput struct {
		UserID          primitive.ObjectID
		Status, Content string
	}
	type phaseInput struct {
		Round string
		Slots []slotInput
	}
	input := struct {
		RunID  primitive.ObjectID
		Topic  string
		Roster []models.TournamentParticipant
		Phases []phaseInput
	}{RunID: t.Execution.RunID, Topic: t.Topic, Roster: t.Execution.Roster}
	for _, phase := range t.Execution.Phases {
		entry := phaseInput{Round: phase.Round}
		for _, slot := range phase.Slots {
			entry.Slots = append(entry.Slots, slotInput{slot.UserID, slot.Status, slot.Content})
		}
		input.Phases = append(input.Phases, entry)
	}
	data, _ := json.Marshal(input)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

func executionFilter(t models.Tournament) bson.M {
	return bson.M{"_id": t.ID, "revision": t.Revision, "execution.runId": t.Execution.RunID, "execution.state": models.ExecutionRunning}
}

func (s TournamentExecutionService) save(ctx context.Context, t models.Tournament) (models.Tournament, error) {
	set := bson.M{"execution": t.Execution, "schemaVersion": 2}
	if t.Evaluation != nil {
		set["evaluation"] = t.Evaluation
	}
	var updated models.Tournament
	err := s.Collection.FindOneAndUpdate(ctx, executionFilter(t), bson.M{"$set": set, "$inc": bson.M{"revision": 1}}, options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&updated)
	return updated, err
}

func (s TournamentExecutionService) Advance(ctx context.Context, id primitive.ObjectID) (models.Tournament, error) {
	for attempt := 0; attempt < 32; attempt++ {
		t, err := s.read(ctx, id)
		if err != nil {
			return t, err
		}
		if !closeTournamentPhase(&t, s.ServerTime()) {
			return t, nil
		}
		updated, err := s.save(ctx, t)
		if errors.Is(err, mongo.ErrNoDocuments) {
			continue
		}
		return updated, err
	}
	return models.Tournament{}, ErrTournamentConflict
}

func (s TournamentExecutionService) Get(ctx context.Context, id, actor primitive.ObjectID) (models.Tournament, error) {
	t, err := s.read(ctx, id)
	if err != nil {
		return t, err
	}
	if err := executionPermission(t, actor); err != nil {
		return models.Tournament{}, err
	}
	if t.Execution == nil && !TournamentLobbyOpen(t) {
		return models.Tournament{}, ErrTournamentExecution
	}
	if t.Execution != nil && !validTournamentExecution(t.Execution) {
		return models.Tournament{}, ErrTournamentExecution
	}
	return s.Advance(ctx, id)
}

func CanonicalTournamentTranscript(content string) (string, string, error) {
	if !utf8.ValidString(content) || len(content) > 8192 || strings.ContainsRune(content, 0) {
		return "", "", ErrTournamentTranscript
	}
	content = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(content, "\r\n", "\n"), "\r", "\n"))
	if content == "" {
		return "", "", ErrTournamentTranscript
	}
	hash := sha256.Sum256([]byte(content))
	return content, hex.EncodeToString(hash[:]), nil
}

type TournamentSubmissionReceipt struct {
	RunID       primitive.ObjectID `json:"runId"`
	Round       string             `json:"round"`
	UserID      primitive.ObjectID `json:"userId"`
	Status      string             `json:"status"`
	ContentHash string             `json:"contentHash"`
	SubmittedAt *time.Time         `json:"submittedAt"`
}

func (s TournamentExecutionService) Submit(ctx context.Context, id, actor, run primitive.ObjectID, round, content, stance string) (TournamentSubmissionReceipt, bool, error) {
	text, hash, err := CanonicalTournamentTranscript(content)
	if err != nil {
		return TournamentSubmissionReceipt{}, false, err
	}
	for attempt := 0; attempt < 32; attempt++ {
		t, err := s.read(ctx, id)
		if err != nil {
			return TournamentSubmissionReceipt{}, false, err
		}
		if err := executionPermission(t, actor); err != nil {
			return TournamentSubmissionReceipt{}, false, err
		}
		if !validTournamentExecution(t.Execution) || t.Execution.RunID != run {
			return TournamentSubmissionReceipt{}, false, ErrTournamentPhase
		}
		memberStance := ""
		for _, member := range t.Execution.Roster {
			if member.UserID == actor {
				memberStance = member.Stance
			}
		}
		if memberStance == "" || (stance != "" && stance != memberStance) {
			return TournamentSubmissionReceipt{}, false, ErrTournamentPhase
		}
		phaseIndex := -1
		for index, phase := range t.Execution.Phases {
			if phase.Round == round {
				phaseIndex = index
				break
			}
		}
		if phaseIndex < 0 {
			return TournamentSubmissionReceipt{}, false, ErrTournamentPhase
		}
		phase := &t.Execution.Phases[phaseIndex]
		slotIndex := -1
		for index, slot := range phase.Slots {
			if slot.UserID == actor {
				slotIndex = index
				break
			}
		}
		if slotIndex < 0 {
			return TournamentSubmissionReceipt{}, false, ErrTournamentPhase
		}
		slot := &phase.Slots[slotIndex]
		receipt := TournamentSubmissionReceipt{RunID: run, Round: round, UserID: actor, Status: models.SlotSubmitted, ContentHash: hash}
		// Accepted-content replay precedes deadline/state checks, even after completion.
		if slot.Status == models.SlotSubmitted {
			if slot.ContentHash != hash || slot.Content != text {
				return TournamentSubmissionReceipt{}, false, ErrTournamentSubmissionConflict
			}
			receipt.SubmittedAt = slot.SubmittedAt
			return receipt, false, nil
		}
		now := s.ServerTime()
		if t.Execution.State != models.ExecutionRunning || t.Execution.PhaseIndex != phaseIndex || phase.Status != models.PhaseOpen || phase.DeadlineAt == nil || !now.Before(*phase.DeadlineAt) || slot.Status != models.SlotPending {
			return TournamentSubmissionReceipt{}, false, ErrTournamentPhase
		}
		slot.Status, slot.Content, slot.ContentHash, slot.SubmittedAt = models.SlotSubmitted, text, hash, &now
		receipt.SubmittedAt = &now
		closeTournamentPhase(&t, now)
		_, err = s.save(ctx, t)
		if errors.Is(err, mongo.ErrNoDocuments) {
			continue
		}
		return receipt, err == nil, err
	}
	return TournamentSubmissionReceipt{}, false, ErrTournamentConflict
}

func (s TournamentExecutionService) Recover(ctx context.Context) (int, error) {
	if s.Collection == nil {
		return 0, ErrTournamentUnavailable
	}
	cursor, err := s.Collection.Find(ctx, bson.M{"execution.state": models.ExecutionRunning, "execution.deadlineAt": bson.M{"$lte": s.ServerTime()}}, options.Find().SetProjection(bson.M{"_id": 1}).SetSort(bson.D{{Key: "execution.deadlineAt", Value: 1}, {Key: "_id", Value: 1}}).SetLimit(50))
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)
	count := 0
	for cursor.Next(ctx) {
		var record struct {
			ID primitive.ObjectID `bson:"_id"`
		}
		if err := cursor.Decode(&record); err != nil {
			return count, err
		}
		if _, err := s.Advance(ctx, record.ID); err != nil {
			return count, err
		}
		count++
	}
	return count, cursor.Err()
}

func (s TournamentExecutionService) RunRecovery(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		if ctx.Err() != nil {
			return
		}
		batch, cancel := context.WithTimeout(ctx, 10*time.Second)
		_, err := s.Recover(batch)
		cancel()
		if err != nil && ctx.Err() == nil {
			log.Print("Tournament phase recovery failed; retrying")
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
