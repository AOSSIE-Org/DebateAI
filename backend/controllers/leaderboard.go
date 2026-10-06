package controllers

import (
	"context"
	"fmt"
	"log"
	"math"
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
	Debaters   []Debater             `json:"debaters"`
	Stats      []Stat                `json:"stats"`
	Pagination LeaderboardPagination `json:"pagination"`
}

type LeaderboardPagination struct {
	Page       int64 `json:"page"`
	Limit      int64 `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int64 `json:"totalPages"`
}

const maxLeaderboardLimit int64 = 100

func leaderboardPage(c *gin.Context) (page, limit, skip int64, err error) {
	page, limit = 1, maxLeaderboardLimit
	if value := c.Query("page"); value != "" {
		page, err = strconv.ParseInt(value, 10, 64)
		if err != nil || page < 1 {
			return 0, 0, 0, fmt.Errorf("page must be a positive integer")
		}
	}
	if value := c.Query("limit"); value != "" {
		limit, err = strconv.ParseInt(value, 10, 64)
		if err != nil || limit < 1 || limit > maxLeaderboardLimit {
			return 0, 0, 0, fmt.Errorf("limit must be an integer between 1 and %d", maxLeaderboardLimit)
		}
	}
	if page-1 > math.MaxInt64/limit {
		return 0, 0, 0, fmt.Errorf("page is too large")
	}
	return page, limit, (page - 1) * limit, nil
}

// Debater represents a leaderboard entry
type Debater struct {
	ID          string `json:"id"`
	Rank        int    `json:"rank"`
	Name        string `json:"name"`
	Score       int    `json:"score"`
	Rating      int    `json:"rating"`
	AvatarURL   string `json:"avatarUrl"`
	CurrentUser bool   `json:"currentUser"`
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
	page, limit, skip, err := leaderboardPage(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	collection := db.MongoDatabase.Collection("users")
	// Count independently so global statistics do not shrink to the page size.
	totalUsers, err := collection.CountDocuments(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count leaderboard users"})
		return
	}
	findOptions := options.Find().
		SetSort(bson.D{{"rating", -1}, {"_id", 1}}).
		SetLimit(limit).SetSkip(skip).
		SetProjection(bson.M{"_id": 1, "email": 1, "displayName": 1, "rating": 1, "score": 1, "avatarUrl": 1})
	cursor, err := collection.Find(ctx, bson.M{}, findOptions)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch leaderboard data"})
		return
	}
	defer cursor.Close(ctx)

	// Decode users into slice
	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode leaderboard data"})
		return
	}

	// Build debaters list
	debaters := make([]Debater, 0, len(users))
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
			Rank:        int(skip) + i + 1,
			Name:        name,
			Score:       user.Score,
			Rating:      int(user.Rating),
			AvatarURL:   avatarURL,
			CurrentUser: isCurrentUser,
		})
	}

	// Generate stats

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
		{Icon: "crown", Value: strconv.FormatInt(totalUsers, 10), Label: "REGISTERED DEBATERS"},
		{Icon: "chessQueen", Value: strconv.Itoa(debatesToday), Label: "DEBATES TODAY"},
		{Icon: "medal", Value: strconv.Itoa(debatingNow), Label: "DEBATING NOW"},
		{Icon: "crown", Value: strconv.Itoa(int(expertsOnline)), Label: "EXPERTS ONLINE"},
	}

	// Send response
	response := LeaderboardData{
		Debaters:   debaters,
		Stats:      stats,
		Pagination: LeaderboardPagination{Page: page, Limit: limit, Total: totalUsers, TotalPages: totalUsers / limit},
	}
	if totalUsers%limit != 0 {
		response.Pagination.TotalPages++
	}
	c.JSON(http.StatusOK, response)
}
