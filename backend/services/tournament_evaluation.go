package services

import (
	"context"
	"encoding/hex"
	"errors"
	"log/slog"
	"sync"
	"time"

	"arguehub/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const tournamentEvaluationTimeout = 120 * time.Second
const tournamentEvaluationLease = 150 * time.Second
const tournamentEvaluationMaxAttempts = 3

// Implementations must honor ctx. Provider errors carry only safe codes.
type TournamentJudge interface {
	Metadata() (provider, model string)
	Judge(context.Context, TournamentJudgeRequest) ([]byte, error)
}

type TournamentJudgeError struct {
	Code      string
	Retryable bool
}

func (e *TournamentJudgeError) Error() string { return e.Code }

type TournamentEvaluationService struct {
	Collection *mongo.Collection
	Provider   TournamentJudge
	Now        func() time.Time
}

func (s TournamentEvaluationService) now() time.Time {
	return (TournamentExecutionService{Now: s.Now}).ServerTime()
}

// GET is deliberately read-only; queue progress never depends on a caller.
func (s TournamentEvaluationService) Get(ctx context.Context, id, actor primitive.ObjectID) (models.Tournament, error) {
	t, err := (TournamentExecutionService{Collection: s.Collection}).read(ctx, id)
	if err != nil {
		return t, err
	}
	if err := executionPermission(t, actor); err != nil {
		return models.Tournament{}, err
	}
	return t, nil
}

func (s TournamentEvaluationService) Claim(ctx context.Context) (models.Tournament, error) {
	if s.Collection == nil || s.Provider == nil {
		return models.Tournament{}, ErrTournamentUnavailable
	}
	provider, model := s.Provider.Metadata()
	if provider == "" || model == "" || len(provider) > 80 || len(model) > 120 {
		return models.Tournament{}, ErrTournamentUnavailable
	}
	now := s.now()
	lease := now.Add(tournamentEvaluationLease)
	token := primitive.NewObjectID().Hex()
	filter := bson.M{"status": models.StatusLive, "execution.state": models.ExecutionFinished, "$or": bson.A{
		bson.M{"evaluation.state": models.EvaluationPending, "$or": bson.A{bson.M{"evaluation.nextAttemptAt": nil}, bson.M{"evaluation.nextAttemptAt": bson.M{"$lte": now}}}},
		bson.M{"evaluation.state": models.EvaluationRunning, "$or": bson.A{bson.M{"evaluation.leaseUntil": nil}, bson.M{"evaluation.leaseUntil": bson.M{"$lte": now}}}},
	}}
	// Pin metadata only once, including handoffs written by P2 before P3 existed.
	update := mongo.Pipeline{bson.D{{Key: "$set", Value: bson.M{
		"evaluation.state":      models.EvaluationRunning,
		"evaluation.attempts":   bson.M{"$add": bson.A{bson.M{"$ifNull": bson.A{"$evaluation.attempts", 0}}, 1}},
		"evaluation.leaseToken": token, "evaluation.leaseUntil": lease,
		"evaluation.nextAttemptAt": "$$REMOVE",
		"evaluation.rubricVersion": bson.M{"$ifNull": bson.A{"$evaluation.rubricVersion", TournamentRubricVersion}},
		"evaluation.provider":      bson.M{"$ifNull": bson.A{"$evaluation.provider", bson.M{"$literal": provider}}},
		"evaluation.model":         bson.M{"$ifNull": bson.A{"$evaluation.model", bson.M{"$literal": model}}},
		"revision":                 bson.M{"$add": bson.A{bson.M{"$ifNull": bson.A{"$revision", 0}}, 1}},
	}}}}
	exhausted := bson.M{"$gt": bson.A{"$evaluation.attempts", tournamentEvaluationMaxAttempts}}
	update = append(update, bson.D{{Key: "$set", Value: bson.M{
		"evaluation.state":         bson.M{"$cond": bson.A{exhausted, models.EvaluationFailed, "$evaluation.state"}},
		"evaluation.attempts":      bson.M{"$min": bson.A{"$evaluation.attempts", tournamentEvaluationMaxAttempts}},
		"evaluation.lastErrorCode": bson.M{"$cond": bson.A{exhausted, "provider_attempts_exhausted", bson.M{"$ifNull": bson.A{"$evaluation.lastErrorCode", "$$REMOVE"}}}},
		"evaluation.failedAt":      bson.M{"$cond": bson.A{exhausted, now, "$$REMOVE"}},
		"evaluation.leaseToken":    bson.M{"$cond": bson.A{exhausted, "$$REMOVE", "$evaluation.leaseToken"}},
		"evaluation.leaseUntil":    bson.M{"$cond": bson.A{exhausted, "$$REMOVE", "$evaluation.leaseUntil"}},
	}}})
	var t models.Tournament
	err := s.Collection.FindOneAndUpdate(ctx, filter, update, options.FindOneAndUpdate().SetSort(bson.D{{Key: "evaluation.createdAt", Value: 1}, {Key: "_id", Value: 1}}).SetReturnDocument(options.After)).Decode(&t)
	if err == nil {
		s.log(t, t.Evaluation.State, t.Evaluation.LastErrorCode)
	}
	return t, err
}

func (s TournamentEvaluationService) log(t models.Tournament, state, code string) {
	age := s.now().Sub(t.Evaluation.CreatedAt).Milliseconds()
	if age < 0 {
		age = 0
	}
	slog.Info("tournament_evaluation", "tournamentId", t.ID.Hex(), "runId", t.Evaluation.RunID.Hex(), "state", state, "attempts", t.Evaluation.Attempts, "jobAgeMs", age, "errorCode", code)
}

func safeJudgeFailure(err error) (string, bool) {
	var failure *TournamentJudgeError
	if errors.As(err, &failure) {
		switch failure.Code {
		case "provider_timeout", "provider_rate_limited", "provider_unavailable", "provider_network":
			return failure.Code, failure.Retryable
		case "provider_configuration", "provider_blocked", "provider_truncated", "invalid_output":
			return failure.Code, false
		}
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "provider_timeout", true
	}
	if errors.Is(err, ErrTournamentEvaluationOutput) {
		return "invalid_output", false
	}
	if errors.Is(err, ErrTournamentEvaluationInput) {
		return "invalid_input", false
	}
	return "provider_failure", false
}

func (s TournamentEvaluationService) fence(t models.Tournament) bson.M {
	return bson.M{"_id": t.ID, "revision": t.Revision, "status": models.StatusLive, "execution.state": models.ExecutionFinished, "execution.runId": t.Evaluation.RunID, "evaluation.id": t.Evaluation.ID, "evaluation.runId": t.Evaluation.RunID, "evaluation.inputHash": t.Evaluation.InputHash, "evaluation.state": models.EvaluationRunning, "evaluation.leaseToken": t.Evaluation.LeaseToken, "evaluation.leaseUntil": bson.M{"$gt": s.now()}}
}

func (s TournamentEvaluationService) fail(ctx context.Context, t models.Tournament, err error) (bool, error) {
	code, retryable := safeJudgeFailure(err)
	now := s.now()
	state := models.EvaluationFailed
	set := bson.M{"evaluation.state": state, "evaluation.lastErrorCode": code, "evaluation.failedAt": now}
	unset := bson.M{"evaluation.leaseToken": "", "evaluation.leaseUntil": "", "evaluation.nextAttemptAt": "", "evaluation.result": "", "evaluation.winner": "", "evaluation.totals": "", "evaluation.sideMeans": "", "evaluation.completedAt": ""}
	if retryable && t.Evaluation.Attempts < tournamentEvaluationMaxAttempts {
		delay := 5 * time.Second
		if t.Evaluation.Attempts >= 2 {
			delay = 30 * time.Second
		}
		jitter, _ := hex.DecodeString(t.Evaluation.LeaseToken[:2])
		next := now.Add(delay + time.Duration(jitter[0])*time.Millisecond)
		state = models.EvaluationPending
		set["evaluation.state"], set["evaluation.nextAttemptAt"] = state, next
		delete(set, "evaluation.failedAt")
		delete(unset, "evaluation.nextAttemptAt")
		unset["evaluation.failedAt"] = ""
	}
	result, updateErr := s.Collection.UpdateOne(ctx, s.fence(t), bson.M{"$set": set, "$unset": unset, "$inc": bson.M{"revision": 1}})
	if updateErr == nil && result.ModifiedCount == 1 {
		s.log(t, state, code)
	}
	return updateErr == nil && result.ModifiedCount == 1, updateErr
}

func (s TournamentEvaluationService) evaluate(ctx context.Context, t models.Tournament) (models.EvaluationResult, error) {
	var result models.EvaluationResult
	if err := validateEvaluationInput(t); err != nil {
		return result, err
	}
	provider, model := s.Provider.Metadata()
	if t.Evaluation.RubricVersion != TournamentRubricVersion || t.Evaluation.Provider != provider || t.Evaluation.Model != model || t.Evaluation.Attempts > tournamentEvaluationMaxAttempts {
		return result, &TournamentJudgeError{Code: "provider_configuration"}
	}
	aliases := judgeAliases(t)
	corrected := false
	for index, round := range result.Rounds() {
		request := tournamentJudgeRequest(t, index)
		scores := map[string]models.ParticipantScore{}
		if len(request.Submissions) > 0 {
			raw, err := s.Provider.Judge(ctx, request)
			if err != nil {
				return result, err
			}
			scores, err = decodeJudgeOutput(raw, request)
			if err != nil && !corrected {
				corrected, request.Corrective = true, true
				s.log(t, "invalid_output", "invalid_output")
				raw, err = s.Provider.Judge(ctx, request)
				if err == nil {
					scores, err = decodeJudgeOutput(raw, request)
				}
			}
			if err != nil {
				return result, err
			}
		}
		for _, slot := range t.Execution.Phases[index].Slots {
			score := models.ParticipantScore{UserID: slot.UserID, SubmissionStatus: models.SlotMissing, Explanation: "No accepted submission; score is zero."}
			if slot.Status == models.SlotSubmitted {
				score = scores[aliases[slot.UserID]]
				score.UserID = slot.UserID
			}
			round.Scores = append(round.Scores, score)
		}
	}
	return result, ctx.Err()
}

// ProcessClaim never claims again, and cannot publish after expiry/reclaim.
func (s TournamentEvaluationService) ProcessClaim(ctx context.Context, t models.Tournament) (bool, error) {
	if s.Provider == nil || s.Collection == nil || t.Evaluation == nil || len(t.Evaluation.LeaseToken) != 24 || t.Evaluation.State != models.EvaluationRunning {
		return false, ErrTournamentUnavailable
	}
	if _, err := hex.DecodeString(t.Evaluation.LeaseToken); err != nil {
		return false, ErrTournamentUnavailable
	}
	if err := s.Collection.FindOne(ctx, s.fence(t)).Err(); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return false, nil
		}
		return false, err
	}
	bounded, cancel := context.WithTimeout(ctx, tournamentEvaluationTimeout)
	result, err := s.evaluate(bounded, t)
	cancel()
	if ctx.Err() != nil {
		return false, ctx.Err()
	} // Leave the lease for restart recovery.
	if err != nil {
		return s.fail(ctx, t, err)
	}
	// Detect external input corruption, not just a matching stored hash string.
	current, err := (TournamentExecutionService{Collection: s.Collection}).read(ctx, t.ID)
	if err != nil {
		return false, err
	}
	if err = validateEvaluationInput(current); err != nil {
		return s.fail(ctx, t, err)
	}
	winner, totals, means := aggregateTournamentScores(t, result)
	now := s.now()
	published, err := s.Collection.UpdateOne(ctx, s.fence(t), bson.M{"$set": bson.M{"evaluation.state": models.EvaluationCompleted, "evaluation.result": result, "evaluation.winner": winner, "evaluation.totals": totals, "evaluation.sideMeans": means, "evaluation.completedAt": now, "status": models.StatusCompleted}, "$unset": bson.M{"evaluation.leaseToken": "", "evaluation.leaseUntil": "", "evaluation.nextAttemptAt": "", "evaluation.lastErrorCode": "", "evaluation.failedAt": ""}, "$inc": bson.M{"revision": 1}})
	if err == nil && published.ModifiedCount == 1 {
		s.log(t, models.EvaluationCompleted, "")
	}
	return err == nil && published.ModifiedCount == 1, err
}

func (s TournamentEvaluationService) ProcessNext(ctx context.Context) (bool, error) {
	t, err := s.Claim(ctx)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if t.Evaluation.State == models.EvaluationFailed {
		return true, nil
	}
	return s.ProcessClaim(ctx, t)
}

func (s TournamentEvaluationService) Run(ctx context.Context) {
	if s.Provider == nil {
		return
	}
	var workers sync.WaitGroup
	for i := 0; i < 2; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			ticker := time.NewTicker(time.Second)
			defer ticker.Stop()
			for ctx.Err() == nil {
				batch, cancel := context.WithTimeout(ctx, tournamentEvaluationTimeout+10*time.Second)
				_, err := s.ProcessNext(batch)
				cancel()
				if err != nil && ctx.Err() == nil {
					slog.Warn("tournament_evaluation_worker", "state", "storage_retry")
				}
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
				}
			}
		}()
	}
	workers.Wait()
}
