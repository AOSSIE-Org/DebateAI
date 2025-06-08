package routes

import (
	"context"
	"net/http"
	
	"arguehub/db"
	"arguehub/models"
	"arguehub/controllers"
	
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetLeaderboardRouteHandler(c *gin.Context) {
	controllers.GetLeaderboard(c)
}


// GetLeaderboardRouteHandler fetches the leaderboard
func GetLeaderboardRouteHandler(c *gin.Context) {
	collection := db.GetCollection("users")
	
	// Sort by rating descending, then by RD ascending (more certain ratings first)
	opts := options.Find().SetSort(bson.D{
		{Key: "rating", Value: -1},
		{Key: "rd", Value: 1},
	}).SetLimit(100)
	
	cursor, err := collection.Find(context.Background(), bson.M{}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch leaderboard"})
		return
	}
	defer cursor.Close(context.Background())
	
	var users []models.User
	if err = cursor.All(context.Background(), &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode leaderboard"})
		return
	}
	
	// Return minimal data for leaderboard
	type LeaderboardEntry struct {
		DisplayName string  `json:"displayName"`
		Rating      float64 `json:"rating"`
		RD          float64 `json:"rd"`
		AvatarURL   string  `json:"avatarUrl"`
	}
	
	var entries []LeaderboardEntry
	for _, user := range users {
		entries = append(entries, LeaderboardEntry{
			DisplayName: user.DisplayName,
			Rating:      user.Rating,
			RD:          user.RD,
			AvatarURL:   user.AvatarURL,
		})
	}
	
	c.JSON(http.StatusOK, entries)
}