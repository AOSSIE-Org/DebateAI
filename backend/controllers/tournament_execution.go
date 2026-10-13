package controllers

import (
	"context"
	"time"

	"arguehub/models"
	"arguehub/services"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type TournamentSlotResponse struct {
	UserID      primitive.ObjectID `json:"userId"`
	Status      string             `json:"status"`
	SubmittedAt *time.Time         `json:"submittedAt,omitempty"`
}

type TournamentPhaseResponse struct {
	Round        string                           `json:"round"`
	Status       string                           `json:"status"`
	OpenedAt     *time.Time                       `json:"openedAt,omitempty"`
	DeadlineAt   *time.Time                       `json:"deadlineAt,omitempty"`
	ClosedAt     *time.Time                       `json:"closedAt,omitempty"`
	Slots        []TournamentSlotResponse         `json:"slots"`
	MySubmission *models.TournamentSubmissionSlot `json:"mySubmission,omitempty"`
}

type TournamentExecutionResponse struct {
	ViewerID        primitive.ObjectID             `json:"viewerId"`
	TournamentID    primitive.ObjectID             `json:"tournamentId"`
	HostID          primitive.ObjectID             `json:"hostId"`
	Topic           string                         `json:"topic"`
	Revision        int64                          `json:"revision"`
	ServerTime      time.Time                      `json:"serverTime"`
	State           string                         `json:"state"`
	RunID           *primitive.ObjectID            `json:"runId,omitempty"`
	Roster          []models.TournamentParticipant `json:"roster"`
	PhaseIndex      int                            `json:"phaseIndex"`
	Phases          []TournamentPhaseResponse      `json:"phases"`
	StartedAt       *time.Time                     `json:"startedAt,omitempty"`
	FinishedAt      *time.Time                     `json:"finishedAt,omitempty"`
	EvaluationState string                         `json:"evaluationState,omitempty"`
}

func toTournamentExecutionResponse(t models.Tournament, actor primitive.ObjectID, now time.Time) TournamentExecutionResponse {
	response := TournamentExecutionResponse{ViewerID: actor, TournamentID: t.ID, HostID: t.HostID, Topic: t.Topic, Revision: t.Revision, ServerTime: now, State: "lobby", Roster: []models.TournamentParticipant{}, Phases: []TournamentPhaseResponse{}}
	if t.Execution == nil {
		return response
	}
	execution := t.Execution
	response.RunID, response.State, response.Roster, response.PhaseIndex = &execution.RunID, execution.State, execution.Roster, execution.PhaseIndex
	response.StartedAt, response.FinishedAt = &execution.StartedAt, execution.FinishedAt
	if t.Evaluation != nil {
		response.EvaluationState = t.Evaluation.State
	}
	for _, phase := range execution.Phases {
		entry := TournamentPhaseResponse{Round: phase.Round, Status: phase.Status, OpenedAt: phase.OpenedAt, DeadlineAt: phase.DeadlineAt, ClosedAt: phase.ClosedAt, Slots: []TournamentSlotResponse{}}
		for _, slot := range phase.Slots {
			entry.Slots = append(entry.Slots, TournamentSlotResponse{UserID: slot.UserID, Status: slot.Status, SubmittedAt: slot.SubmittedAt})
			if slot.UserID == actor {
				own := slot
				entry.MySubmission = &own
			}
		}
		response.Phases = append(response.Phases, entry)
	}
	return response
}

func tournamentExecutionService() services.TournamentExecutionService {
	return services.TournamentExecutionService{Collection: tournamentService().Collection}
}

func StartTournamentHandler(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	actor, ok := tournamentActor(c, false)
	if !ok {
		return
	}
	id, ok := tournamentID(c)
	if !ok {
		return
	}
	var input struct{}
	if !bindTournamentAdmission(c, &input) {
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	s := tournamentExecutionService()
	t, created, err := s.Start(ctx, id, actor.UserID)
	if err != nil {
		writeTournamentError(c, err)
		return
	}
	status := 200
	if created {
		status = 201
	}
	c.JSON(status, toTournamentExecutionResponse(t, actor.UserID, s.ServerTime()))
}

func GetTournamentExecutionHandler(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
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
	s := tournamentExecutionService()
	t, err := s.Get(ctx, id, actor.UserID)
	if err != nil {
		writeTournamentError(c, err)
		return
	}
	c.JSON(200, toTournamentExecutionResponse(t, actor.UserID, s.ServerTime()))
}

func SubmitTournamentTranscriptHandler(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	actor, ok := tournamentActor(c, false)
	if !ok {
		return
	}
	id, ok := tournamentID(c)
	if !ok {
		return
	}
	var input struct {
		RunID   string `json:"runId"`
		Round   string `json:"round"`
		Content string `json:"content"`
		Stance  string `json:"stance,omitempty"`
	}
	if !bindTournamentJSON(c, &input, 16384) {
		return
	}
	run, err := primitive.ObjectIDFromHex(input.RunID)
	if err != nil || run.IsZero() {
		c.JSON(400, gin.H{"error": "Invalid run ID"})
		return
	}
	validPhase := false
	for _, definition := range services.TournamentPhaseDefinitions() {
		if definition.Round == input.Round {
			validPhase = true
		}
	}
	if !validPhase || (input.Stance != "" && input.Stance != models.StanceFor && input.Stance != models.StanceAgainst) {
		c.JSON(400, gin.H{"error": "Invalid phase or stance"})
		return
	}
	if _, _, err := services.CanonicalTournamentTranscript(input.Content); err != nil {
		writeTournamentError(c, err)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	receipt, created, err := tournamentExecutionService().Submit(ctx, id, actor.UserID, run, input.Round, input.Content, input.Stance)
	if err != nil {
		writeTournamentError(c, err)
		return
	}
	status := 200
	if created {
		status = 201
	}
	c.JSON(status, receipt)
}
