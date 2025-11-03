package controllers

import (
	"context"
	"net/http"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CreateTeamDebate creates a new team debate between two matched teams
func CreateTeamDebate(c *gin.Context) {
	var req struct {
		Team1ID primitive.ObjectID `json:"team1Id" binding:"required"`
		Team2ID primitive.ObjectID `json:"team2Id" binding:"required"`
		Topic   string            `json:"topic" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	collection := db.GetCollection("teams")
	var team1, team2 models.Team

	// Fetch team 1
	err := collection.FindOne(context.Background(), bson.M{"_id": req.Team1ID}).Decode(&team1)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team 1 not found"})
		return
	}

	// Fetch team 2
	err = collection.FindOne(context.Background(), bson.M{"_id": req.Team2ID}).Decode(&team2)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team 2 not found"})
		return
	}

	// Determine stances
	var team1Stance, team2Stance string
	stances := []string{"for", "against"}
	if time.Now().Unix()%2 == 0 {
		team1Stance = stances[0]
		team2Stance = stances[1]
	} else {
		team1Stance = stances[1]
		team2Stance = stances[0]
	}

	// Create debate
	debate := models.TeamDebate{
		Team1ID:      req.Team1ID,
		Team2ID:      req.Team2ID,
		Team1Name:    team1.Name,
		Team2Name:    team2.Name,
		Team1Members: team1.Members,
		Team2Members: team2.Members,
		Topic:        req.Topic,
		Team1Stance:  team1Stance,
		Team2Stance:  team2Stance,
		Status:       "active",
		CurrentTurn:  "team1",
		TurnCount:    0,
		MaxTurns:     12, // 12 total turns (6 per team)
		Team1Elo:     team1.AverageElo,
		Team2Elo:     team2.AverageElo,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// Insert debate
	debateCollection := db.GetCollection("team_debates")
	result, err := debateCollection.InsertOne(context.Background(), debate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create debate"})
		return
	}

	debate.ID = result.InsertedID.(primitive.ObjectID)

	// Remove teams from matchmaking
	services.RemoveFromMatchmaking(req.Team1ID)
	services.RemoveFromMatchmaking(req.Team2ID)

	c.JSON(http.StatusOK, debate)
}

// GetTeamDebate retrieves a team debate by ID
func GetTeamDebate(c *gin.Context) {
	debateID := c.Param("id")
	objectID, err := primitive.ObjectIDFromHex(debateID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid debate ID"})
		return
	}

	collection := db.GetCollection("team_debates")
	var debate models.TeamDebate
	err = collection.FindOne(context.Background(), bson.M{"_id": objectID}).Decode(&debate)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Debate not found"})
		return
	}

	c.JSON(http.StatusOK, debate)
}

// GetActiveTeamDebate gets the active debate for a team
func GetActiveTeamDebate(c *gin.Context) {
	teamID := c.Param("teamId")
	objectID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	collection := db.GetCollection("team_debates")
	var debate models.TeamDebate
	err = collection.FindOne(context.Background(), bson.M{
		"$or": []bson.M{
			{"team1Id": objectID},
			{"team2Id": objectID},
		},
		"status": "active",
	}).Decode(&debate)
	
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"hasActiveDebate": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"hasActiveDebate": true,
		"debateId":        debate.ID.Hex(),
		"topic":           debate.Topic,
		"status":          debate.Status,
	})
}
