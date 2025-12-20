package services

import (
	"context"
	"math"
	"time"

	"arguehub/config"
	"arguehub/db"
	"arguehub/models"
	"arguehub/rating"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var ratingSystem *rating.Glicko2

func InitRatingService(cfg *config.Config) {
	ratingSystem = rating.New(nil)
}

func GetRatingSystem() *rating.Glicko2 {
	return ratingSystem
}

// UpdateRatings updates ratings after a debate
func UpdateRatings(userID, opponentID primitive.ObjectID, outcome float64, debateTime time.Time) (*models.Debate, *models.Debate, error) {
	// Get both players from database
	user, err := getUserByID(userID)
	if err != nil {
		return nil, nil, err
	}

	opponent, err := getUserByID(opponentID)
	if err != nil {
		return nil, nil, err
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
	sanitizePlayerStats(userPlayer, preUserRating, preUserRD)
	sanitizePlayerStats(opponentPlayer, preOpponentRating, preOpponentRD)

	// Sanitize rating outputs to avoid NaN/Inf values
	sanitizePlayerMetrics := func(player *rating.Player) {
		initialRating := ratingSystem.Config.InitialRating
		initialRD := ratingSystem.Config.InitialRD
		initialVol := ratingSystem.Config.InitialVol

		if math.IsNaN(player.Rating) || math.IsInf(player.Rating, 0) {
			player.Rating = initialRating
		}
		if math.IsNaN(player.RD) || math.IsInf(player.RD, 0) {
			player.RD = initialRD
		}
		if math.IsNaN(player.Volatility) || math.IsInf(player.Volatility, 0) {
			player.Volatility = initialVol
		}
		if player.RD <= 0 {
			player.RD = initialRD
		}
		if player.Volatility <= 0 {
			player.Volatility = initialVol
		}
	}
	sanitizePlayerMetrics(userPlayer)
	sanitizePlayerMetrics(opponentPlayer)

	// Create debate record
	debate := &models.Debate{
		UserID:        userID,
		Email:         user.Email,
		OpponentID:    opponentID,
		OpponentEmail: opponent.Email,
		Date:          debateTime,
		PreRating:     preUserRating,
		PreRD:         preUserRD,
		PostRating:    userPlayer.Rating,
		PostRD:        userPlayer.RD,
		RatingChange:  sanitizeFloatMetric(userPlayer.Rating - preUserRating),
		RDChange:      sanitizeFloatMetric(userPlayer.RD - preUserRD),
	}

	// Update user in database
	if err := updateUserRating(userID, userPlayer); err != nil {
		return nil, nil, err
	}

	// Update opponent in database
	if err := updateUserRating(opponentID, opponentPlayer); err != nil {
		return nil, nil, err
	}

	opponentDebate := &models.Debate{
		UserID:        opponentID,
		Email:         opponent.Email,
		OpponentID:    userID,
		OpponentEmail: user.Email,
		Date:          debateTime,
		PreRating:     preOpponentRating,
		PreRD:         preOpponentRD,
		PostRating:    opponentPlayer.Rating,
		PostRD:        opponentPlayer.RD,
		RatingChange:  sanitizeFloatMetric(opponentPlayer.Rating - preOpponentRating),
		RDChange:      sanitizeFloatMetric(opponentPlayer.RD - preOpponentRD),
	}

	return debate, opponentDebate, nil
}

func sanitizeFloatMetric(value float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return 0
	}
	return value
}

// Helper function to get user by ID
func getUserByID(id primitive.ObjectID) (*models.User, error) {
	var user models.User
	collection := db.MongoDatabase.Collection("users")
	err := collection.FindOne(context.Background(), bson.M{"_id": id}).Decode(&user)
	return &user, err
}

// Helper function to update user rating
func updateUserRating(id primitive.ObjectID, player *rating.Player) error {
	collection := db.MongoDatabase.Collection("users")
	sanitizePlayerStats(player, 1200.0, 350.0)
	update := bson.M{
		"$set": bson.M{
			"rating":           player.Rating,
			"rd":               player.RD,
			"volatility":       player.Volatility,
			"lastRatingUpdate": player.LastUpdate,
		},
	}
	_, err := collection.UpdateByID(context.Background(), id, update)
	return err
}

func sanitizePlayerStats(player *rating.Player, fallbackRating, fallbackRD float64) {
	if math.IsNaN(player.Rating) || math.IsInf(player.Rating, 0) {
		player.Rating = fallbackRating
	}
	if math.IsNaN(player.RD) || math.IsInf(player.RD, 0) {
		player.RD = fallbackRD
	}
	if math.IsNaN(player.Volatility) || math.IsInf(player.Volatility, 0) || player.Volatility <= 0 {
		player.Volatility = 0.06
	}
	if player.LastUpdate.IsZero() {
		player.LastUpdate = time.Now()
	}
}
