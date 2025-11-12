package controllers

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// LeaderboardData defines the response structure for the frontend
type LeaderboardData struct {
	Debaters []Debater `json:"debaters"`
	Stats    []Stat    `json:"stats"`
}

// Debater represents a leaderboard entry
type Debater struct {
	ID          string  `json:"id"`
	Rank        int     `json:"rank"`
	Name        string  `json:"name"`
	Score       int     `json:"score"`
	Rating      int     `json:"rating"`
	AvatarURL   string  `json:"avatarUrl"`
	CurrentUser bool    `json:"currentUser"`
}

// Stat represents a single statistic
type Stat struct {
	Icon  string `json:"icon"`
	Value string `json:"value"`
	Label string `json:"label"`
}

// GetLeaderboard fetches and returns leaderboard data
func GetLeaderboard(c *gin.Context) {
	// Check for authenticated user
	currentemail, exists := c.Get("email")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Query users sorted by Rating (descending)
	collection := db.MongoDatabase.Collection("users")
	findOptions := options.Find().SetSort(bson.D{{"rating", -1}})
	cursor, err := collection.Find(c, bson.M{}, findOptions)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch leaderboard data"})
		return
	}
	defer cursor.Close(c)

	// Decode users into slice
	var users []models.User
	if err := cursor.All(c, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode leaderboard data"})
		return
	}

	// Build debaters list
	var debaters []Debater
	for i, user := range users {
		name := user.DisplayName
		if name == "" {
			name = utils.ExtractNameFromEmail(user.Email)
		}

		avatarURL := user.AvatarURL
		if avatarURL == "" {
			avatarURL = "https://api.dicebear.com/9.x/adventurer/svg?seed=" + name
		}

		isCurrentUser := user.Email == currentemail
		debaters = append(debaters, Debater{
			ID:          user.ID.Hex(),
			Rank:        i + 1,
			Name:        name,
			Score:       user.Score,
			Rating:      int(user.Rating),
			AvatarURL:   avatarURL,
			CurrentUser: isCurrentUser,
		})
	}

	// Generate stats
	totalUsers := len(users)
	ctx := context.Background()

	// Calculate DEBATES TODAY - count all debates created today
	todayStart := time.Now().Truncate(24 * time.Hour)
	todayEnd := todayStart.Add(24 * time.Hour)

	debatesToday := 0

	// Count from saved_debate_transcripts
	transcriptCollection := db.MongoDatabase.Collection("saved_debate_transcripts")
	transcriptCount, err := transcriptCollection.CountDocuments(ctx, bson.M{
		"createdAt": bson.M{
			"$gte": todayStart,
			"$lt":  todayEnd,
		},
	})
	if err == nil {
		debatesToday += int(transcriptCount)
	}

	// Count from debates_vs_bot (createdAt is int64 timestamp)
	botDebateCollection := db.MongoDatabase.Collection("debates_vs_bot")
	botDebateCount, err := botDebateCollection.CountDocuments(ctx, bson.M{
		"createdAt": bson.M{
			"$gte": todayStart.Unix(),
			"$lt":  todayEnd.Unix(),
		},
	})
	if err == nil {
		debatesToday += int(botDebateCount)
	}

	// Count from team_debates
	teamDebateCollection := db.MongoDatabase.Collection("team_debates")
	teamDebateCount, err := teamDebateCollection.CountDocuments(ctx, bson.M{
		"createdAt": bson.M{
			"$gte": todayStart,
			"$lt":  todayEnd,
		},
	})
	if err == nil {
		debatesToday += int(teamDebateCount)
	}

	// Count from debates collection (uses date field)
	debateCollection := db.MongoDatabase.Collection("debates")
	debateCount, err := debateCollection.CountDocuments(ctx, bson.M{
		"date": bson.M{
			"$gte": todayStart,
			"$lt":  todayEnd,
		},
	})
	if err == nil {
		debatesToday += int(debateCount)
	}

	// Calculate DEBATING NOW - count active debates
	debatingNow := 0

	// Count active team debates
	activeTeamDebates, err := teamDebateCollection.CountDocuments(ctx, bson.M{
		"status": "active",
	})
	if err == nil {
		debatingNow += int(activeTeamDebates)
	}

	// Count debates with pending status (might be in progress)
	pendingDebates, err := transcriptCollection.CountDocuments(ctx, bson.M{
		"result": "pending",
		"updatedAt": bson.M{
			"$gte": time.Now().Add(-2 * time.Hour), // Active within last 2 hours
		},
	})
	if err == nil {
		debatingNow += int(pendingDebates)
	}

	// Calculate EXPERTS ONLINE - users with high rating who have been active recently
	// Consider users with rating >= 1500 as experts, and active within last 30 minutes
	expertThreshold := 1500.0
	activeThreshold := time.Now().Add(-30 * time.Minute)

	expertsOnline, err := collection.CountDocuments(ctx, bson.M{
		"rating": bson.M{"$gte": expertThreshold},
		"$or": []bson.M{
			{"lastActivityDate": bson.M{"$gte": activeThreshold}},
			{"updatedAt": bson.M{"$gte": activeThreshold}},
		},
	})
	if err != nil {
		log.Printf("Error counting experts online: %v", err)
		expertsOnline = 0
	}

	stats := []Stat{
		{Icon: "crown", Value: strconv.Itoa(totalUsers), Label: "REGISTERED DEBATERS"},
		{Icon: "chessQueen", Value: strconv.Itoa(debatesToday), Label: "DEBATES TODAY"},
		{Icon: "medal", Value: strconv.Itoa(debatingNow), Label: "DEBATING NOW"},
		{Icon: "crown", Value: strconv.Itoa(int(expertsOnline)), Label: "EXPERTS ONLINE"},
	}

	// Send response
	response := LeaderboardData{
		Debaters: debaters,
		Stats:    stats,
	}
	c.JSON(http.StatusOK, response)
}
