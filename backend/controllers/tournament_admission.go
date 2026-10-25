package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func tournamentService() services.TournamentService {
	if db.MongoDatabase == nil {
		return services.TournamentService{}
	}
	return services.TournamentService{Collection: db.MongoDatabase.Collection("tournaments")}
}

func writeTournamentError(c *gin.Context, err error) {
	status, code, message := http.StatusServiceUnavailable, "storage_unavailable", "Tournament storage is unavailable"
	switch {
	case errors.Is(err, services.ErrTournamentNotFound), errors.Is(err, mongo.ErrNoDocuments):
		status, code, message = 404, "not_found", "Tournament or request not found"
	case errors.Is(err, services.ErrTournamentForbidden), errors.Is(err, services.ErrTournamentMember):
		status, code, message = 403, "forbidden", err.Error()
	case errors.Is(err, services.ErrTournamentLocked):
		status, code, message = 409, "lobby_closed", err.Error()
	case errors.Is(err, services.ErrTournamentFull):
		status, code, message = 409, "full", err.Error()
	case errors.Is(err, services.ErrTournamentRequestLimit):
		status, code, message = 429, "request_limit", err.Error()
	case errors.Is(err, services.ErrTournamentConflict), errors.Is(err, services.ErrTournamentRequestConflict):
		status, code, message = 409, "conflict", err.Error()
	case errors.Is(err, services.ErrTournamentNotReady):
		status, code, message = 409, "roster_not_ready", err.Error()
	case errors.Is(err, services.ErrTournamentScheduled):
		status, code, message = 409, "scheduled", err.Error()
	case errors.Is(err, services.ErrTournamentExecution), errors.Is(err, services.ErrTournamentPhase):
		status, code, message = 409, "phase_closed", err.Error()
	case errors.Is(err, services.ErrTournamentSubmissionConflict):
		status, code, message = 409, "submission_conflict", err.Error()
	case errors.Is(err, services.ErrTournamentTranscript):
		status, code, message = 400, "invalid_transcript", err.Error()
	}
	c.JSON(status, gin.H{"error": message, "code": code})
}

func tournamentActor(c *gin.Context, requireName bool) (models.TournamentParticipant, bool) {
	id, ok := getCurrentUserID(c)
	if !ok || id.IsZero() {
		c.JSON(401, gin.H{"error": "Invalid user session"})
		return models.TournamentParticipant{}, false
	}
	name, _ := c.Get("displayName")
	display, _ := name.(string)
	display = strings.TrimSpace(display)
	if requireName && (display == "" || len(display) > 80) {
		c.JSON(400, gin.H{"error": "Set a display name of at most 80 characters before joining"})
		return models.TournamentParticipant{}, false
	}
	return models.TournamentParticipant{UserID: id, Name: display}, true
}

func tournamentID(c *gin.Context) (primitive.ObjectID, bool) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid tournament ID"})
		return id, false
	}
	return id, true
}

func bindTournamentAdmission(c *gin.Context, target interface{}) bool {
	return bindTournamentJSON(c, target, 4096)
}

func bindTournamentJSON(c *gin.Context, target interface{}, limit int64) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
	decoder := json.NewDecoder(c.Request.Body)
	var raw json.RawMessage
	if err := decoder.Decode(&raw); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request body"})
		return false
	}
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || raw[0] != '{' || !utf8.Valid(raw) {
		c.JSON(400, gin.H{"error": "Expected a JSON object"})
		return false
	}
	// encoding/json otherwise accepts duplicate keys and case-folded aliases.
	keys := json.NewDecoder(bytes.NewReader(raw))
	_, _ = keys.Token()
	seen := make(map[string]bool)
	for keys.More() {
		key, err := keys.Token()
		name, ok := key.(string)
		duplicate := false
		for previous := range seen {
			if strings.EqualFold(previous, name) {
				duplicate = true
				break
			}
		}
		if err != nil || !ok || duplicate {
			c.JSON(400, gin.H{"error": "Invalid request body"})
			return false
		}
		seen[name] = true
		var value json.RawMessage
		if err := keys.Decode(&value); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request body"})
			return false
		}
	}
	fields := json.NewDecoder(bytes.NewReader(raw))
	fields.DisallowUnknownFields()
	if err := fields.Decode(target); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request body"})
		return false
	}
	var extra interface{}
	if err := decoder.Decode(&extra); err != io.EOF {
		c.JSON(400, gin.H{"error": "Expected one JSON object"})
		return false
	}
	return true
}

type tournamentAdmissionResponse struct {
	TournamentResponse
	TournamentID primitive.ObjectID `json:"tournamentId"`
	UserID       primitive.ObjectID `json:"userId"`
	Message      string             `json:"message"`
	Action       string             `json:"action,omitempty"`
	Stance       string             `json:"stance,omitempty"`
}

func JoinPublicTournament(c *gin.Context) {
	actor, ok := tournamentActor(c, true)
	if !ok {
		return
	}
	id, ok := tournamentID(c)
	if !ok {
		return
	}
	// #671's public join accepts no body; supplied JSON must still be strict.
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 4096))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid request body"})
		return
	}
	var input struct{}
	if len(body) != 0 {
		c.Request.Body = io.NopCloser(bytes.NewReader(body))
		if !bindTournamentAdmission(c, &input) {
			return
		}
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	t, created, err := tournamentService().JoinPublic(ctx, id, actor)
	if err != nil {
		writeTournamentError(c, err)
		return
	}
	status := 200
	if created {
		status = 201
	}
	c.JSON(status, tournamentAdmissionResponse{TournamentResponse: toTournamentResponse(t, t.HostID == actor.UserID), TournamentID: t.ID, UserID: actor.UserID, Message: "Joined successfully"})
}

var tournamentInvitePattern = regexp.MustCompile(`^[0-9]{6}$`)

func JoinPrivateTournament(c *gin.Context) {
	actor, ok := tournamentActor(c, true)
	if !ok {
		return
	}
	var input struct {
		InviteCode string `json:"inviteCode"`
	}
	if !bindTournamentAdmission(c, &input) {
		return
	}
	if !tournamentInvitePattern.MatchString(input.InviteCode) {
		c.JSON(400, gin.H{"error": "Invite code must contain six digits"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	t, _, err := tournamentService().RequestPrivate(ctx, input.InviteCode, actor)
	if err != nil {
		writeTournamentError(c, err)
		return
	}
	status := models.JoinRequestApproved
	var requestedAt *time.Time
	for _, request := range t.JoinRequests {
		if request.UserID == actor.UserID {
			status = request.Status
			requestedAt = &request.CreatedAt
			break
		}
	}
	c.JSON(202, gin.H{"tournamentId": t.ID, "status": status, "requestCreatedAt": requestedAt, "message": "Admission request status: " + status})
}

func GetPendingRequests(c *gin.Context) {
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
	s := tournamentService()
	if s.Collection == nil {
		writeTournamentError(c, services.ErrTournamentUnavailable)
		return
	}
	var t models.Tournament
	if err := s.Collection.FindOne(ctx, bson.M{"_id": id}).Decode(&t); err != nil {
		writeTournamentError(c, err)
		return
	}
	if t.HostID != actor.UserID {
		err := services.ErrTournamentForbidden
		if t.Visibility == models.VisibilityPrivate && !services.TournamentHasMember(t, actor.UserID) {
			err = services.ErrTournamentNotFound
		}
		writeTournamentError(c, err)
		return
	}
	pending := make([]models.JoinRequest, 0)
	for _, request := range t.JoinRequests {
		if request.Status == models.JoinRequestPending {
			pending = append(pending, request)
		}
	}
	c.JSON(200, gin.H{"pendingRequests": pending, "count": len(pending), "tournamentId": t.ID, "participants": len(t.Participants), "maxParticipants": t.MaxParticipants, "revision": t.Revision, "lobbyOpen": services.TournamentLobbyOpen(t)})
}

func GetTournamentRequestHandler(c *gin.Context) {
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
	s := tournamentService()
	if s.Collection == nil {
		writeTournamentError(c, services.ErrTournamentUnavailable)
		return
	}
	var t models.Tournament
	if err := s.Collection.FindOne(ctx, bson.M{"_id": id}).Decode(&t); err != nil {
		writeTournamentError(c, err)
		return
	}
	for _, request := range t.JoinRequests {
		if request.UserID == actor.UserID {
			c.JSON(200, gin.H{"tournamentId": t.ID, "status": request.Status, "requestCreatedAt": request.CreatedAt})
			return
		}
	}
	if services.TournamentHasMember(t, actor.UserID) {
		c.JSON(200, gin.H{"tournamentId": t.ID, "status": models.JoinRequestApproved})
		return
	}
	writeTournamentError(c, services.ErrTournamentNotFound)
}

func ManageJoinRequest(c *gin.Context) {
	actor, ok := tournamentActor(c, false)
	if !ok {
		return
	}
	id, ok := tournamentID(c)
	if !ok {
		return
	}
	requester, err := primitive.ObjectIDFromHex(c.Param("userId"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid requester ID"})
		return
	}
	var input struct {
		Status           *string `json:"status"`
		Action           *string `json:"action"`
		RequestCreatedAt *string `json:"requestCreatedAt"`
	}
	if !bindTournamentAdmission(c, &input) {
		return
	}
	if (input.Status == nil) == (input.Action == nil) {
		c.JSON(400, gin.H{"error": "Supply exactly one of action or status"})
		return
	}
	decision, action := "", ""
	if input.Action != nil {
		action = *input.Action
		switch action {
		case "approve":
			decision = models.JoinRequestApproved
		case "reject":
			decision = models.JoinRequestRejected
		}
	} else {
		decision = *input.Status
		if decision == models.JoinRequestApproved {
			action = "approve"
		} else if decision == models.JoinRequestRejected {
			action = "reject"
		}
	}
	if action == "" || decision == "" {
		c.JSON(400, gin.H{"error": "Action must be approve/reject or status approved/rejected"})
		return
	}
	var requestedAt *time.Time
	if input.RequestCreatedAt != nil {
		parsed, err := time.Parse(time.RFC3339Nano, *input.RequestCreatedAt)
		if err != nil {
			c.JSON(400, gin.H{"error": "Invalid request timestamp"})
			return
		}
		requestedAt = &parsed
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	t, _, err := tournamentService().DecideRequestAt(ctx, id, actor.UserID, requester, decision, requestedAt)
	if err != nil {
		writeTournamentError(c, err)
		return
	}
	c.JSON(200, tournamentAdmissionResponse{TournamentResponse: toTournamentResponse(t, true), TournamentID: t.ID, UserID: requester, Action: action, Message: "Request " + decision + " successfully"})
}

func ChooseStance(c *gin.Context) {
	actor, ok := tournamentActor(c, false)
	if !ok {
		return
	}
	id, ok := tournamentID(c)
	if !ok {
		return
	}
	var input struct {
		Stance string `json:"stance"`
	}
	if !bindTournamentAdmission(c, &input) {
		return
	}
	if input.Stance != models.StanceFor && input.Stance != models.StanceAgainst {
		c.JSON(400, gin.H{"error": "Stance must be for or against"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	t, _, err := tournamentService().ChooseStance(ctx, id, actor.UserID, input.Stance)
	if err != nil {
		writeTournamentError(c, err)
		return
	}
	c.JSON(200, tournamentAdmissionResponse{TournamentResponse: toTournamentResponse(t, t.HostID == actor.UserID), TournamentID: t.ID, UserID: actor.UserID, Stance: input.Stance, Message: "Stance updated successfully"})
}
