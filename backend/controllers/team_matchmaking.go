package controllers

import (
	"context"
	"net/http"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// JoinMatchmaking adds a team to the matchmaking pool
func JoinMatchmaking(c *gin.Context) {
	teamID := c.Param("teamId")
	objectID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	// Get user from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get team
	collection := db.GetCollection("teams")
	var team models.Team
	err = collection.FindOne(context.Background(), bson.M{"_id": objectID}).Decode(&team)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team not found"})
		return
	}

	// Check if user is captain
	if team.CaptainID != userID.(primitive.ObjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the captain can join matchmaking"})
		return
	}

	// Check if team is full
	if len(team.Members) < team.MaxSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team is not full yet"})
		return
	}

	// Add to matchmaking
	err = services.StartTeamMatchmaking(objectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join matchmaking"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Team added to matchmaking pool",
		"teamInfo": gin.H{
			"id":           team.ID.Hex(),
			"averageElo":   team.AverageElo,
			"maxSize":      team.MaxSize,
			"membersCount": len(team.Members),
		},
	})
}

// LeaveMatchmaking removes a team from matchmaking
func LeaveMatchmaking(c *gin.Context) {
	teamID := c.Param("teamId")
	objectID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	services.RemoveFromMatchmaking(objectID)
	c.JSON(http.StatusOK, gin.H{"message": "Team removed from matchmaking"})
}

// GetMatchmakingPool returns the current matchmaking pool for debugging
func GetMatchmakingPool(c *gin.Context) {
	pool := services.GetMatchmakingPool()
	
	// Convert to a more readable format
	var poolInfo []gin.H
	for teamID, entry := range pool {
		poolInfo = append(poolInfo, gin.H{
			"teamId":     teamID,
			"teamName":   entry.Team.Name,
			"captainId":  entry.Team.CaptainID.Hex(),
			"maxSize":    entry.MaxSize,
			"averageElo": entry.AverageElo,
			"membersCount": len(entry.Team.Members),
			"timestamp":  entry.Timestamp.Format("2006-01-02 15:04:05"),
		})
	}
	
	c.JSON(http.StatusOK, gin.H{
		"poolSize": len(pool),
		"teams":    poolInfo,
	})
}

// GetMatchmakingStatus returns the matchmaking pool status
func GetMatchmakingStatus(c *gin.Context) {
	teamID := c.Param("teamId")
	objectID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	// Try to find a match
	matchingTeam, err := services.FindMatchingTeam(objectID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"matched": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"matched":   true,
		"team":      matchingTeam,
		"matchId":   matchingTeam.ID.Hex(),
	})
}

