package controllers

import (
	"log"
	"net/http"
	"strconv"

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
	ID          string `json:"id"`
	Rank        int    `json:"rank"`
	Name        string `json:"name"`
	Score       int    `json:"score"`
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

	// Query users sorted by EloRating (descending)
	collection := db.MongoDatabase.Collection("users")
	findOptions := options.Find().SetSort(bson.D{{"eloRating", -1}})
	cursor, err := collection.Find(c, bson.M{}, findOptions)
	if err != nil {
		log.Printf("Failed to fetch users: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch leaderboard data"})
		return
	}
	defer cursor.Close(c)

	// Decode users into slice
	var users []models.User
	if err := cursor.All(c, &users); err != nil {
		log.Printf("Failed to decode users: %v", err)
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
			Score:       user.EloRating,
			AvatarURL:   avatarURL,
			CurrentUser: isCurrentUser,
		})
	}

	// Generate stats
	totalUsers := len(users)
	stats := []Stat{
		{Icon: "crown", Value: strconv.Itoa(totalUsers), Label: "REGISTERED DEBATERS"},
		{Icon: "chessQueen", Value: "430", Label: "DEBATES TODAY"}, // Placeholder
		{Icon: "medal", Value: "98", Label: "DEBATING NOW"},        // Placeholder
		{Icon: "crown", Value: "37", Label: "EXPERTS ONLINE"},      // Placeholder
	}

	// Send response
	response := LeaderboardData{
		Debaters: debaters,
		Stats:    stats,
	}
	c.JSON(http.StatusOK, response)
}
