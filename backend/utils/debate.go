package utils

import (
	"context"
	"time"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
)

// SeedDebateData populates the debates collection with sample data
func SeedDebateData() {
	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Skip if debates collection already has data
	count, err := db.MongoDatabase.Collection("debates").CountDocuments(dbCtx, bson.M{})
	if err != nil || count > 0 {
		return
	}

	// Define sample debates
	sampleDebates := []models.Debate{
		{
			UserEmail: "irishittiwari@gmail.com",
			Topic:     "Global Warming",
			Result:    "win",
			EloChange: 12,
			Date:      time.Now().Add(-time.Hour * 24 * 30),
		},
		{
			UserEmail: "irishittiwari@gmail.com",
			Topic:     "Universal Healthcare",
			Result:    "loss",
			EloChange: -5,
			Date:      time.Now().Add(-time.Hour * 24 * 20),
		},
		{
			UserEmail: "irishittiwari@gmail.com",
			Topic:     "Social Media Regulation",
			Result:    "draw",
			EloChange: 0,
			Date:      time.Now().Add(-time.Hour * 24 * 10),
		},
		{
			UserEmail: "irishittiwari@gmail.com",
			Topic:     "Renewable Energy",
			Result:    "win",
			EloChange: 10,
			Date:      time.Now().Add(-time.Hour * 24 * 5),
		},
		{
			UserEmail: "irishittiwari@gmail.com",
			Topic:     "Space Exploration",
			Result:    "loss",
			EloChange: -7,
			Date:      time.Now().Add(-time.Hour * 24 * 2),
		},
	}

	// Insert sample debates
	for _, debate := range sampleDebates {
		db.MongoDatabase.Collection("debates").InsertOne(dbCtx, debate)
	}
}
