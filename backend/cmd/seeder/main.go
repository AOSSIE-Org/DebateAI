package main

import (
	"context"
	"log"
	"time"

	"arguehub/config"
	"arguehub/db"
	"arguehub/models"
	"arguehub/services"

	"go.mongodb.org/mongo-driver/bson"
)

func main() {
	cfg, err := config.LoadConfig("../../config/config.prod.yml")
	if err != nil {
		log.Fatal("Failed to load config: " + err.Error())
	}

	// Initialize DB
	err = db.ConnectMongoDB(cfg.Database.URI)
	if err != nil {
		log.Fatal("Failed to connect to DB: " + err.Error())
	}

	collection := db.MongoDatabase.Collection("users")
	count, _ := collection.CountDocuments(context.Background(), bson.M{})

	if count > 0 {
		log.Println("Users already exist, skipping seed.")
		return
	}

	// Initialize rating system
	services.InitRatingService(cfg)
	ratingSystem := services.GetRatingSystem()

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
		log.Fatal("Failed to seed users: " + err.Error())
	}
	log.Println("Seeded users successfully.")
}
