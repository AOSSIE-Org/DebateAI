package routes

import (
	"context"
	"net/http"
	"time"

	"arguehub/services"
	"arguehub/db"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// UpdateRatingAfterDebateRouteHandler handles rating updates after debates
func UpdateRatingAfterDebateRouteHandler(c *gin.Context) {
	var request struct {
		UserID     primitive.ObjectID `json:"userId"`
		OpponentID primitive.ObjectID `json:"opponentId"`
		Outcome    string             `json:"outcome"` 
		Topic      string             `json:"topic"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	// Convert outcome to numeric value
	var outcome float64
	switch request.Outcome {
	case "win":
		outcome = 1.0
	case "loss":
		outcome = 0.0
	case "draw":
		outcome = 0.5
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid outcome value"})
		return
	}

	// Update ratings
	debate, err := services.UpdateRatings(
		request.UserID,
		request.OpponentID,
		outcome,
		time.Now(),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update ratings"})
		return
	}

	// Set additional debate fields
	debate.Topic = request.Topic
	debate.Result = request.Outcome

	// Save debate record
	collection := db.MongoDatabase.Collection("debates")
	_, err = collection.InsertOne(context.Background(), debate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save debate record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Ratings updated successfully",
		"newRating":    debate.PostRating,
		"ratingChange": debate.RatingChange,
		"newRD":        debate.PostRD,
	})
}