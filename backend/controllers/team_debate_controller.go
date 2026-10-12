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
	"go.mongodb.org/mongo-driver/mongo"
)

// CreateTeamDebate handles POST /team-debates/ to initiate a team debate between two matched teams.
// It verifies captain authorization, atomically claims matched teams from the matchmaking pool,
// and ensures neither team is currently in an active debate.
func CreateTeamDebate(c *gin.Context) {
	var req struct {
		Team1ID primitive.ObjectID `json:"team1Id" binding:"required"`
		Team2ID primitive.ObjectID `json:"team2Id" binding:"required"`
		Topic   string             `json:"topic" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Team1ID == req.Team2ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot create a debate with the same team on both sides"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userObjectID, ok := userID.(primitive.ObjectID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := services.ValidateTeamsMatch(req.Team1ID, req.Team2ID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Teams must be in the matchmaking pool and matched to create a debate: " + err.Error()})
		return
	}

	collection := db.GetCollection("teams")
	if collection == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not available"})
		return
	}

	var team1, team2 models.Team

	if err := collection.FindOne(context.Background(), bson.M{"_id": req.Team1ID}).Decode(&team1); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team 1 not found"})
		return
	}

	if err := collection.FindOne(context.Background(), bson.M{"_id": req.Team2ID}).Decode(&team2); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team 2 not found"})
		return
	}

	if team1.CaptainID != userObjectID && team2.CaptainID != userObjectID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the captain of a participating team can initiate a debate"})
		return
	}

	claim, err := services.ClaimMatchedTeams(req.Team1ID, req.Team2ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Teams must be in the matchmaking pool and matched to create a debate: " + err.Error()})
		return
	}

	debateCollection := db.GetCollection("team_debates")
	if debateCollection == nil {
		services.RestoreClaimedTeams(claim)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not available"})
		return
	}

	var activeDebate models.TeamDebate
	err = debateCollection.FindOne(context.Background(), bson.M{
		"$or": []bson.M{
			{"team1Id": req.Team1ID},
			{"team2Id": req.Team1ID},
			{"team1Id": req.Team2ID},
			{"team2Id": req.Team2ID},
		},
		"status": "active",
	}).Decode(&activeDebate)
	if err == nil {
		services.RestoreClaimedTeams(claim)
		c.JSON(http.StatusBadRequest, gin.H{"error": "One or both teams already have an active debate"})
		return
	}
	if err != mongo.ErrNoDocuments {
		services.RestoreClaimedTeams(claim)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check active debates"})
		return
	}

	var team1Stance, team2Stance string
	stances := []string{"for", "against"}
	if time.Now().Unix()%2 == 0 {
		team1Stance = stances[0]
		team2Stance = stances[1]
	} else {
		team1Stance = stances[1]
		team2Stance = stances[0]
	}

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
		MaxTurns:     12,
		Team1Elo:     team1.AverageElo,
		Team2Elo:     team2.AverageElo,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	insertResult, insertErr := debateCollection.InsertOne(context.Background(), debate)
	if insertErr != nil {
		services.RestoreClaimedTeams(claim)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create debate"})
		return
	}

	debate.ID = insertResult.InsertedID.(primitive.ObjectID)

	// Notify all members of both teams
	go func() {
		allMembers := append(team1.Members, team2.Members...)
		for _, member := range allMembers {
			services.CreateNotification(
				member.UserID,
				models.NotificationTypeTournament,
				"Team Debate Started",
				"Your team debate on '"+req.Topic+"' has started!",
				"/team-debate/"+debate.ID.Hex(),
			)
		}
	}()

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
