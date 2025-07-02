package utils

import (
	"context"
	"time"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PopulateTestUsers inserts sample users into the database
func PopulateTestUsers1() {
	collection := db.MongoDatabase.Collection("users")

	// Define sample users
	users := []models.User{
		{
			ID:          primitive.NewObjectID(),
			Email:       "alice@example.com",
			DisplayName: "Alice Johnson",
			Bio:         "Debate enthusiast",
			Rating:   2500,
			CreatedAt:   time.Now(),
		},
		{
			ID:          primitive.NewObjectID(),
			Email:       "bob@example.com",
			DisplayName: "Bob Smith",
			Bio:         "Argument master",
			Rating:   2400,
			CreatedAt:   time.Now(),
		},
		{
			ID:          primitive.NewObjectID(),
			Email:       "carol@example.com",
			DisplayName: "Carol Davis",
			Bio:         "Wordsmith",
			Rating:   2350,
			CreatedAt:   time.Now(),
		},
	}

	// Insert users
	for _, user := range users {
		collection.InsertOne(context.Background(), user)
	}
}
