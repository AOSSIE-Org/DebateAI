package utils

import (
	"context"
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

	// Seed a couple of saved debate transcripts with analytics for UI testing
	seedSavedTranscripts()
}

func seedSavedTranscripts() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := db.MongoDatabase.Collection("users")
	savedColl := db.MongoDatabase.Collection("saved_debate_transcripts")

	// If already seeded, skip
	c, _ := savedColl.CountDocuments(ctx, bson.M{})
	if c > 0 {
		return
	}

	// Find test users
	var user1 models.User
	var user2 models.User
	_ = usersColl.FindOne(ctx, bson.M{"email": "user1@example.com"}).Decode(&user1)
	_ = usersColl.FindOne(ctx, bson.M{"email": "user2@example.com"}).Decode(&user2)

	now := time.Now()

	transcripts := []models.SavedDebateTranscript{
		{
			ID:         primitive.NewObjectID(),
			UserID:     user1.ID,
			Email:      user1.Email,
			DebateType: "user_vs_user",
			Topic:      "Climate Change Action",
			Opponent:   user2.Email,
			Result:     "win",
			Messages: []models.Message{
				{Sender: "User", Text: "We need action now", Phase: "openingFor"},
				{Sender: "User", Text: "Evidence A", Phase: "rebuttal"},
			},
			Transcripts: map[string]string{"openingFor": "We need action now", "rebuttal": "Evidence A"},
			RoomID:      "room-sample-1",
			Analytics: &models.DebateAnalytics{
				TotalArguments:       6,
				TotalDurationSeconds: 240,
				AvgResponseTimeSecs:  40.0,
				TotalRebuttals:       2,
				AvgArgumentLength:    64.5,
			},
			CreatedAt: now.Add(-48 * time.Hour),
			UpdatedAt: now.Add(-48 * time.Hour),
		},
		{
			ID:         primitive.NewObjectID(),
			UserID:     user2.ID,
			Email:      user2.Email,
			DebateType: "user_vs_user",
			Topic:      "Climate Change Action",
			Opponent:   user1.Email,
			Result:     "loss",
			Messages: []models.Message{
				{Sender: "User", Text: "We should wait", Phase: "openingAgainst"},
			},
			Transcripts: map[string]string{"openingAgainst": "We should wait"},
			RoomID:      "room-sample-1",
			Analytics: &models.DebateAnalytics{
				TotalArguments:       4,
				TotalDurationSeconds: 240,
				AvgResponseTimeSecs:  60.0,
				TotalRebuttals:       1,
				AvgArgumentLength:    52.0,
			},
			CreatedAt: now.Add(-48 * time.Hour),
			UpdatedAt: now.Add(-48 * time.Hour),
		},
	}

	var docs []interface{}
	for _, t := range transcripts {
		docs = append(docs, t)
	}
	_, _ = savedColl.InsertMany(ctx, docs)
}
