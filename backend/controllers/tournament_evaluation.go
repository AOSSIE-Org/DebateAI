package controllers

import (
	"context"
	"time"

	"arguehub/models"
	"arguehub/services"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type TournamentEvaluationResponse struct {
	ViewerID      primitive.ObjectID             `json:"viewerId"`
	TournamentID  primitive.ObjectID             `json:"tournamentId"`
	Topic         string                         `json:"topic"`
	Revision      int64                          `json:"revision"`
	Roster        []models.TournamentParticipant `json:"roster"`
	State         string                         `json:"state"`
	Retrying      bool                           `json:"retrying"`
	Retryable     bool                           `json:"retryable"`
	ErrorCode     string                         `json:"errorCode,omitempty"`
	RunID         *primitive.ObjectID            `json:"runId,omitempty"`
	RubricVersion string                         `json:"rubricVersion,omitempty"`
	Provider      string                         `json:"provider,omitempty"`
	Model         string                         `json:"model,omitempty"`
	CompletedAt   *time.Time                     `json:"completedAt,omitempty"`
	Result        *models.EvaluationResult       `json:"result,omitempty"`
	Winner        *models.Winner                 `json:"winner,omitempty"`
	Totals        []models.WinningIndividual     `json:"totals,omitempty"`
	SideMeans     []models.TournamentSideMean    `json:"sideMeans,omitempty"`
}

func toTournamentEvaluationResponse(t models.Tournament, actor primitive.ObjectID) (int, TournamentEvaluationResponse) {
	response := TournamentEvaluationResponse{ViewerID: actor, TournamentID: t.ID, Topic: t.Topic, Revision: t.Revision, Roster: append([]models.TournamentParticipant{}, t.Participants...), State: "not_ready"}
	if t.Execution != nil {
		response.Roster = append([]models.TournamentParticipant{}, t.Execution.Roster...)
	}
	if t.Execution == nil && t.Status == models.StatusCompleted {
		response.State = "legacy_no_evaluation"
		return 200, response
	}
	e := t.Evaluation
	if e == nil {
		return 200, response
	}
	response.State, response.RunID = e.State, &e.RunID
	switch e.State {
	case models.EvaluationPending, models.EvaluationRunning:
		response.Retrying = e.Attempts > 0 && (e.NextAttemptAt != nil || e.LastErrorCode != "" || e.Attempts > 1)
		return 202, response
	case models.EvaluationCompleted:
		if e.Result == nil || e.Winner == nil || e.CompletedAt == nil {
			response.State, response.ErrorCode = models.EvaluationFailed, "result_unavailable"
			return 200, response
		}
		response.RubricVersion, response.Provider, response.Model = e.RubricVersion, e.Provider, e.Model
		response.Result, response.Winner, response.Totals, response.SideMeans, response.CompletedAt = e.Result, e.Winner, e.Totals, e.SideMeans, e.CompletedAt
	case models.EvaluationFailed:
		// Only safe enums are exposed, never raw provider errors or internal fields.
		switch e.LastErrorCode {
		case "invalid_input", "invalid_output", "provider_timeout", "provider_rate_limited", "provider_unavailable", "provider_network", "provider_configuration", "provider_blocked", "provider_truncated", "provider_failure", "provider_attempts_exhausted":
			response.ErrorCode = e.LastErrorCode
		default:
			response.ErrorCode = "evaluation_failed"
		}
	default:
		response.State, response.ErrorCode = models.EvaluationFailed, "evaluation_failed"
	}
	return 200, response
}

func GetTournamentEvaluationHandler(c *gin.Context) {
	actor, ok := tournamentActor(c, false)
	if !ok {
		return
	}
	id, ok := tournamentID(c)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	s := services.TournamentEvaluationService{Collection: tournamentService().Collection}
	t, err := s.Get(ctx, id, actor.UserID)
	if err != nil {
		writeTournamentError(c, err)
		return
	}
	status, response := toTournamentEvaluationResponse(t, actor.UserID)
	c.Header("Cache-Control", "no-store")
	c.JSON(status, response)
}
