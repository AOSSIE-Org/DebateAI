package controllers

import (
	"context"
	"crypto/rand"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const maxTournamentParticipants = 16

type CreateTournamentInput struct {
Title           string `json:"title" binding:"required,max=100"`
	Description     string `json:"description" binding:"required,max=2000"`
	ModeratorName   string `json:"moderatorName" binding:"required,max=80"`
	Category        string `json:"category" binding:"required,oneof=chat_only voice_only voice_video"`
	Visibility      string `json:"visibility" binding:"required,oneof=public private"`
	MinParticipants int    `json:"minParticipants" binding:"required,min=3"`
	MaxParticipants int    `json:"maxParticipants" binding:"required"`
	StartType       string `json:"startType" binding:"required,oneof=direct scheduled"`
	ScheduleAt      string `json:"scheduleAt,omitempty"`
}

func generateInviteCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", err
	}
	return strconv.FormatInt(n.Int64()+100000, 10), nil
}

func CreateTournamentHandler(c *gin.Context) {
	var input CreateTournamentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	input.ModeratorName = strings.TrimSpace(input.ModeratorName)
	if input.Title == "" || input.Description == "" || input.ModeratorName == "" {
    c.JSON(http.StatusBadRequest, gin.H{"error": "Title, description, and moderator name cannot be blank"})
    return
}

	if input.MaxParticipants < input.MinParticipants {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Max must be >= min"})
		return
	}
	if input.MaxParticipants > maxTournamentParticipants {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Max cannot exceed 16"})
		return
	}

	userIDRaw, _ := c.Get("userID")
	displayNameRaw, _ := c.Get("displayName")

userID, ok := userIDRaw.(primitive.ObjectID)
displayName, displayNameOK := displayNameRaw.(string)
if !ok || !displayNameOK || strings.TrimSpace(displayName) == "" {
    c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
    return
}
_ = displayName  

	now := time.Now()
	tournament := models.Tournament{
		ID:              primitive.NewObjectID(),
		HostID:          userID,
		ModeratorName:   input.ModeratorName,
	Title:           input.Title,
		Description:     input.Description,
		Category:        input.Category,
		Visibility:      input.Visibility,
		MinParticipants: input.MinParticipants,
		MaxParticipants: input.MaxParticipants,
		Participants:    []primitive.ObjectID{userID},
		CreatedAt:       now,
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

	if input.Visibility == models.VisibilityPrivate {
		inviteCode, err := generateInviteCode()
		if err != nil {
			log.Printf("Failed to generate tournament invite code: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tournament invite code"})
			return
		}
		tournament.InviteCode = inviteCode
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
defer cancel()

_, err := db.MongoDatabase.Collection("tournaments").InsertOne(ctx, tournament)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tournament"})
		return
	}

	c.JSON(http.StatusCreated, tournament)
}
