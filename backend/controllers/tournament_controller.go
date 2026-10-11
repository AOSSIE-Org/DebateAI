package controllers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func GetTournaments(c *gin.Context) {
	status := c.Query("status")

	filter := bson.M{}

	if status != "" {
		switch status {
		case models.StatusLive,
			models.StatusUpcoming,
			models.StatusCompleted:
			filter["status"] = status

		default:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid tournament status",
			})
			return
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

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

	c.JSON(http.StatusOK, tournaments)
}

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

	collection := db.MongoDatabase.Collection("tournaments")

	var tournament models.Tournament
	err = collection.FindOne(
		ctx,
		bson.M{"_id": tournamentID},
	).Decode(&tournament)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Tournament not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to fetch tournament",
			})
		}
		return
	}

	// 6. Only the host can update the tournament.
	if tournament.HostID != currentUserID {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Only the host can update this tournament",
		})
		return
	}

	// 7. Update only supplied fields.
	result, err := collection.UpdateOne(
		ctx,
		bson.M{
			"_id":    tournamentID,
			"hostId": currentUserID,
		},
		bson.M{"$set": updates},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update tournament",
		})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Tournament not found",
		})
		return
	}

	// 8. Return the updated tournament.
	err = collection.FindOne(
		ctx,
		bson.M{"_id": tournamentID},
	).Decode(&tournament)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Tournament updated, but failed to retrieve it",
		})
		return
	}

	c.JSON(http.StatusOK, tournament)
}
