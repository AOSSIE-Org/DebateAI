package utils

import (
	"context"
	"log"
	"time"

	"arguehub/config"
	"arguehub/db"
	"arguehub/models"
	"arguehub/services"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PopulateTestUsers creates test users with Glicko-2 ratings
func PopulateTestUsers() {
	collection := db.GetCollection("users")
	count, _ := collection.CountDocuments(context.Background(), bson.M{})

	if count > 0 {
		return
	}

	// Initialize rating system
	ratingSystem := services.GetRatingSystem()

	testUsers := []models.User{
		{
			Email:       "user1@example.com",
			DisplayName: "DebateMaster",
			Bio:         "Experienced debater",
			Rating:      ratingSystem.config.InitialRating,
			RD:          ratingSystem.config.InitialRD,
			Volatility:  ratingSystem.config.InitialVol,
			CreatedAt:   time.Now(),
		},
		{
			Email:       "user2@example.com",
			DisplayName: "LogicLord",
			Bio:         "Lover of logical arguments",
			Rating:      ratingSystem.config.InitialRating,
			RD:          ratingSystem.config.InitialRD,
			Volatility:  ratingSystem.config.InitialVol,
			CreatedAt:   time.Now(),
		},
		// Add more test users as needed
	}

	var documents []interface{}
	for _, user := range testUsers {
		documents = append(documents, user)
	}

	_, err := collection.InsertMany(context.Background(), documents)
	if err != nil {
		log.Printf("Failed to insert test users: %v", err)
	} else {
		log.Println("Inserted test users")
	}
}