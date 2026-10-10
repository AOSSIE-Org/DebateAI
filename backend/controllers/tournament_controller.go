package controllers

import (
	"context"
	"crypto/rand"
	"errors"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"  
)

const maxTournamentParticipants = 11

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

	collection := db.MongoDatabase.Collection("tournaments")


	var tournament models.Tournament
	err = collection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&tournament)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tournament"})
		}
		return
	}

	
	if tournament.HostID != currentUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the host can delete this tournament"})
		return
	}

	
	result, err := collection.DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete tournament"})
		return
	}

	if result.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tournament deleted successfully"})
}