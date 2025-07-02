package utils

import (
	"context"
	"log"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"
	"arguehub/config"

	"go.mongodb.org/mongo-driver/bson"
)

// PopulateTestUsers creates test users with Glicko-2 ratings
func PopulateTestUsers() {
	cfg, err := config.LoadConfig("./config/config.prod.yml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
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
		log.Printf("Failed to insert test users: %v", err)
	} else {
		log.Println("Inserted test users")
	}
}
