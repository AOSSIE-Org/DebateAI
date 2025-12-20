package routes

import (
	"context"
	"net/http"
	"time"

	"arguehub/db"
	"arguehub/services"

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
	debate, opponentDebate, err := services.UpdateRatings(
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

	opponentOutcome := "draw"
	switch request.Outcome {
	case "win":
		opponentOutcome = "loss"
	case "loss":
		opponentOutcome = "win"
	}

	if opponentDebate != nil {
		opponentDebate.Topic = request.Topic
		opponentDebate.Result = opponentOutcome
	}

	// Save debate records
	records := []interface{}{debate}
	if opponentDebate != nil {
		records = append(records, opponentDebate)
	}

	collection := db.MongoDatabase.Collection("debates")
	if _, err = collection.InsertMany(context.Background(), records); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save debate record"})
		return
	}

	opponentSummary := gin.H{}
	if opponentDebate != nil {
		opponentSummary = gin.H{
			"rating": opponentDebate.PostRating,
			"change": opponentDebate.RatingChange,
			"rd":     opponentDebate.PostRD,
			"result": opponentOutcome,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Ratings updated successfully",
		"ratingSummary": gin.H{
			"user": gin.H{
				"rating": debate.PostRating,
				"change": debate.RatingChange,
				"rd":     debate.PostRD,
			},
			"opponent": opponentSummary,
		},
	})
}
