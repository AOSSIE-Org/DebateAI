package utils

import (
	"context"
	"time"

	"arguehub/config"
	"arguehub/db"
	"arguehub/models"
	"arguehub/services"

	"go.mongodb.org/mongo-driver/bson"
)

// PopulateTestUsers creates test users with Glicko-2 ratings
func PopulateTestUsers() {
	cfg, err := config.LoadConfig("./config/config.prod.yml")
	if err != nil {
		panic("Failed to load config: " + err.Error())
	}

	collection := db.MongoDatabase.Collection("users")
	count, _ := collection.CountDocuments(context.Background(), bson.M{})

	if count > 0 {
		return
	}

	// Initialize rating system (no return value)
	services.InitRatingService(cfg)
	ratingSystem := services.GetRatingSystem() // <- add a getter in services package

	testUsers := []models.User{
		{
			Email:       "user1@example.com",
			DisplayName: "DebateMaster",
			Bio:         "Experienced debater",
			Rating:      ratingSystem.Config.InitialRating,
			RD:          ratingSystem.Config.InitialRD,
			Volatility:  ratingSystem.Config.InitialVol,
			CreatedAt:   time.Now(),
		},
		{
			Email:       "user2@example.com",
			DisplayName: "LogicLord",
			Bio:         "Lover of logical arguments",
			Rating:      ratingSystem.Config.InitialRating,
			RD:          ratingSystem.Config.InitialRD,
			Volatility:  ratingSystem.Config.InitialVol,
			CreatedAt:   time.Now(),
		},
	}

	var documents []interface{}
	for _, user := range testUsers {
		documents = append(documents, user)
	}

	_, err = collection.InsertMany(context.Background(), documents)
	if err != nil {
		return
	}
}
