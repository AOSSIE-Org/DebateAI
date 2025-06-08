package services

import (
	"context"
	"log"
	"time"

	"arguehub/config"
	"arguehub/models"
	"arguehub/rating"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

var ratingSystem *rating.Glicko2

func InitRatingService(cfg *config.Config) {
	ratingSystem = rating.New(nil)
}

// UpdateRatings updates ratings after a debate
func UpdateRatings(userID, opponentID primitive.ObjectID, outcome float64, debateTime time.Time) (*models.Debate, error) {
	// Get both players from database
	user, err := getUserByID(userID)
	if err != nil {
		return nil, err
	}

	opponent, err := getUserByID(opponentID)
	if err != nil {
		return nil, err
	}

	// Create player structs for rating calculation
	userPlayer := &rating.Player{
		Rating:     user.Rating,
		RD:         user.RD,
		Volatility: user.Volatility,
		LastUpdate: user.LastRatingUpdate,
	}

	opponentPlayer := &rating.Player{
		Rating:     opponent.Rating,
		RD:         opponent.RD,
		Volatility: opponent.Volatility,
		LastUpdate: opponent.LastRatingUpdate,
	}

	// Save pre-rating state for history
	preUserRating := user.Rating
	preUserRD := user.RD
	preOpponentRating := opponent.Rating
	preOpponentRD := opponent.RD

	// Update ratings
	ratingSystem.UpdateMatch(userPlayer, opponentPlayer, outcome, debateTime)

	// Create debate record
	debate := &models.Debate{
		UserID:      userID,
		UserEmail:   user.Email,
		OpponentID:  opponentID,
		OpponentEmail: opponent.Email,
		Date:        debateTime,
		PreRating:   preUserRating,
		PreRD:       preUserRD,
		PostRating:  userPlayer.Rating,
		PostRD:      userPlayer.RD,
		RatingChange: userPlayer.Rating - preUserRating,
		RDChange:    userPlayer.RD - preUserRD,
	}

	// Update user in database
	if err := updateUserRating(userID, userPlayer); err != nil {
		return nil, err
	}

	// Update opponent in database
	if err := updateUserRating(opponentID, opponentPlayer); err != nil {
		return nil, err
	}

	return debate, nil
}

// Helper function to get user by ID
func getUserByID(id primitive.ObjectID) (*models.User, error) {
	var user models.User
	collection := db.GetCollection("users")
	err := collection.FindOne(context.Background(), bson.M{"_id": id}).Decode(&user)
	return &user, err
}

// Helper function to update user rating
func updateUserRating(id primitive.ObjectID, player *rating.Player) error {
	collection := db.GetCollection("users")
	update := bson.M{
		"$set": bson.M{
			"rating":          player.Rating,
			"rd":             player.RD,
			"volatility":     player.Volatility,
			"lastRatingUpdate": player.LastUpdate,
		},
	}
	_, err := collection.UpdateByID(context.Background(), id, update)
	return err
}