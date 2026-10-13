package controllers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const maxTournamentParticipants = 11

// ---------- CREATE ----------

type CreateTournamentInput struct {
	Topic           string `json:"topic" binding:"required,max=100"`
	Description     string `json:"description" binding:"required,max=2000"`
	ModeratorName   string `json:"moderatorName" binding:"required,max=80"`
	Visibility      string `json:"visibility" binding:"required,oneof=public private"`
	Stance          string `json:"stance" binding:"required,oneof=for against"`
	MinParticipants int    `json:"minParticipants" binding:"required,min=3"`
	MaxParticipants int    `json:"maxParticipants" binding:"required"`
	StartType       string `json:"startType" binding:"required,oneof=direct scheduled"`
	ScheduleAt      string `json:"scheduleAt,omitempty"`
}

func CreateTournamentHandler(c *gin.Context) {
	var input CreateTournamentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.Topic = strings.TrimSpace(input.Topic)
	input.Description = strings.TrimSpace(input.Description)
	input.ModeratorName = strings.TrimSpace(input.ModeratorName)
	if input.Topic == "" || input.Description == "" || input.ModeratorName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Topic, description, and moderator name cannot be blank"})
		return
	}

	if input.MaxParticipants < input.MinParticipants {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Max must be >= min"})
		return
	}
	if input.MaxParticipants > maxTournamentParticipants {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Max cannot exceed 11"})
		return
	}

	userIDRaw, _ := c.Get("userID")
	displayNameRaw, _ := c.Get("displayName")

	userID, ok := userIDRaw.(primitive.ObjectID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user session"})
		return
	}

	hostName, hostNameOK := displayNameRaw.(string)
	if !hostNameOK || strings.TrimSpace(hostName) == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Please set your display name in your profile before creating a tournament.",
		})
		return
	}

	now := time.Now()
	tournament := models.Tournament{
		ID:              primitive.NewObjectID(),
		HostID:          userID,
		ModeratorName:   input.ModeratorName,
		Topic:           input.Topic,
		Description:     input.Description,
		Visibility:      input.Visibility,
		MinParticipants: input.MinParticipants,
		MaxParticipants: input.MaxParticipants,
		Participants: []models.TournamentParticipant{
			{
				UserID: userID,
				Name:   hostName,
				Stance: input.Stance,
			},
		},
		CreatedAt: now,
	}

	if input.StartType == "scheduled" {
		if input.ScheduleAt == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Schedule date required"})
			return
		}
		scheduledAt, err := time.Parse(time.RFC3339, input.ScheduleAt)
		if err != nil || !scheduledAt.After(now) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule date"})
			return
		}
		tournament.Status = models.StatusUpcoming
		tournament.ScheduleAt = &scheduledAt
	} else {
		tournament.Status = models.StatusLive
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := tournamentService().Create(ctx, &tournament); err != nil {
		writeTournamentError(c, err)
		return
	}

	c.JSON(http.StatusCreated, toTournamentResponse(tournament, true))
}

// ---------- DELETE ----------

// DeleteTournamentHandler handles DELETE /tournaments/:id
// Only the host can delete their own tournament.
func DeleteTournamentHandler(c *gin.Context) {
	id := c.Param("id")
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	userIDRaw, _ := c.Get("userID")
	currentUserID, ok := userIDRaw.(primitive.ObjectID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := tournamentService().DeleteLobby(ctx, objectID, currentUserID); err != nil {
		writeTournamentError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tournament deleted successfully"})
}

// ---------- RESPONSE HELPERS ----------

type TournamentResponse struct {
	Revision        int64                          `json:"revision"`
	LobbyOpen       bool                           `json:"lobbyOpen"`
	ExecutionState  string                         `json:"executionState,omitempty"`
	ID              primitive.ObjectID             `json:"id"`
	HostID          primitive.ObjectID             `json:"hostId"`
	ModeratorName   string                         `json:"moderatorName"`
	Topic           string                         `json:"topic"`
	Description     string                         `json:"description"`
	Status          string                         `json:"status"`
	Visibility      string                         `json:"visibility"`
	MinParticipants int                            `json:"minParticipants"`
	MaxParticipants int                            `json:"maxParticipants"`
	Participants    []models.TournamentParticipant `json:"participants"`
	ScheduleAt      *time.Time                     `json:"scheduleAt,omitempty"`
	CreatedAt       time.Time                      `json:"createdAt"`
	InviteCode      string                         `json:"inviteCode,omitempty"`
	JoinRequests    []models.JoinRequest           `json:"joinRequests,omitempty"`
}

func toTournamentResponse(
	tournament models.Tournament,
	isHost bool,
) TournamentResponse {
	response := TournamentResponse{
		Revision:        tournament.Revision,
		LobbyOpen:       services.TournamentLobbyOpen(tournament),
		ID:              tournament.ID,
		HostID:          tournament.HostID,
		ModeratorName:   tournament.ModeratorName,
		Topic:           tournament.Topic,
		Description:     tournament.Description,
		Status:          tournament.Status,
		Visibility:      tournament.Visibility,
		MinParticipants: tournament.MinParticipants,
		MaxParticipants: tournament.MaxParticipants,
		Participants:    tournament.Participants,
		ScheduleAt:      tournament.ScheduleAt,
		CreatedAt:       tournament.CreatedAt,
	}

	if isHost {
		response.InviteCode = tournament.InviteCode
		response.JoinRequests = tournament.JoinRequests
	}
	if tournament.Execution != nil {
		response.ExecutionState = tournament.Execution.State
	}

	return response
}

func getCurrentUserID(c *gin.Context) (primitive.ObjectID, bool) {
	userID, exists := c.Get("userID")
	if !exists {
		return primitive.NilObjectID, false
	}

	id, ok := userID.(primitive.ObjectID)
	return id, ok
}

// ---------- GET LIST ----------

func GetTournaments(c *gin.Context) {
	currentUserID, ok := getCurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID",
		})
		return
	}

	filter := bson.M{
		"$or": []bson.M{
			{"visibility": models.VisibilityPublic},
			{"hostId": currentUserID},
			{"participants.userId": currentUserID},
		},
	}

	if status := c.Query("status"); status != "" {
		switch status {
		case models.StatusLive, models.StatusUpcoming, models.StatusCompleted:
			filter["status"] = status
		default:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid tournament status",
			})
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if db.MongoDatabase == nil {
		writeTournamentError(c, services.ErrTournamentUnavailable)
		return
	}
	collection := db.MongoDatabase.Collection("tournaments")

	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve tournaments",
		})
		return
	}
	defer cursor.Close(ctx)

	tournaments := make([]models.Tournament, 0)
	if err := cursor.All(ctx, &tournaments); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve tournaments",
		})
		return
	}

	responses := make([]TournamentResponse, 0, len(tournaments))
	for _, tournament := range tournaments {
		responses = append(responses, toTournamentResponse(
			tournament,
			tournament.HostID == currentUserID,
		))
	}

	c.JSON(http.StatusOK, responses)
}

// ---------- GET BY ID ----------

func GetTournamentByID(c *gin.Context) {
	currentUserID, ok := getCurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID",
		})
		return
	}

	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid tournament ID",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if db.MongoDatabase == nil {
		writeTournamentError(c, services.ErrTournamentUnavailable)
		return
	}
	collection := db.MongoDatabase.Collection("tournaments")

	var tournament models.Tournament
	err = collection.FindOne(
		ctx,
		bson.M{"_id": id},
	).Decode(&tournament)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Tournament not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to retrieve tournament",
			})
		}
		return
	}

	isHost := tournament.HostID == currentUserID
	isParticipant := false

	for _, participant := range tournament.Participants {
		if participant.UserID == currentUserID {
			isParticipant = true
			break
		}
	}

	if tournament.Visibility == models.VisibilityPrivate &&
		!isHost && !isParticipant {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Tournament not found",
		})
		return
	}

	c.JSON(
		http.StatusOK,
		toTournamentResponse(tournament, isHost),
	)
}

// ---------- UPDATE ----------

type UpdateTournamentInput struct {
	Topic         *string `json:"topic"`
	Description   *string `json:"description"`
	ModeratorName *string `json:"moderatorName"`
	Visibility    *string `json:"visibility"`
	Status        *string `json:"status"`
	ScheduleAt    *string `json:"scheduleAt"`
}

func UpdateTournamentHandler(c *gin.Context) {
	// 1. Validate tournament ID.
	id := c.Param("id")
	tournamentID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid tournament ID",
		})
		return
	}

	// 2. Get authenticated user ID.
	userIDRaw, exists := c.Get("userID")
	currentUserID, ok := userIDRaw.(primitive.ObjectID)
	if !exists || !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID",
		})
		return
	}

	// 3. Parse request body.
	var input UpdateTournamentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	// 4. Build updates using only supplied fields.
	updates := bson.M{}

	if input.Topic != nil {
		value := strings.TrimSpace(*input.Topic)
		if value == "" || len(value) > 100 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Topic must be between 1 and 100 characters",
			})
			return
		}
		updates["topic"] = value
	}

	if input.Description != nil {
		value := strings.TrimSpace(*input.Description)
		if value == "" || len(value) > 2000 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Description must be between 1 and 2000 characters",
			})
			return
		}
		updates["description"] = value
	}

	if input.ModeratorName != nil {
		value := strings.TrimSpace(*input.ModeratorName)
		if value == "" || len(value) > 80 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Moderator name must be between 1 and 80 characters",
			})
			return
		}
		updates["moderatorName"] = value
	}

	if input.Visibility != nil {
		switch *input.Visibility {
		case models.VisibilityPublic, models.VisibilityPrivate:
			updates["visibility"] = *input.Visibility
		default:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid tournament visibility",
			})
			return
		}
	}

	if input.Status != nil {
		switch *input.Status {
		case models.StatusUpcoming,
			models.StatusLive,
			models.StatusCompleted:
			updates["status"] = *input.Status
		default:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid tournament status",
			})
			return
		}
	}

	if input.ScheduleAt != nil {
		scheduledAt, err := time.Parse(time.RFC3339, *input.ScheduleAt)
		if err != nil || !scheduledAt.After(time.Now()) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Schedule must be a valid future RFC3339 timestamp",
			})
			return
		}
		updates["scheduleAt"] = scheduledAt
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Provide at least one valid field to update",
		})
		return
	}

	// 5. Database operations.
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	tournament, _, err := tournamentService().UpdateLobby(ctx, tournamentID, currentUserID, updates)
	if err != nil {
		writeTournamentError(c, err)
		return
	}

	c.JSON(http.StatusOK, toTournamentResponse(tournament, true))
}
