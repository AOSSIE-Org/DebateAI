package controllers

import (
	"context"
	"net/http"
	"time"

	"arguehub/db"
	"arguehub/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// SubmitVote handles a spectator's vote on a debate
func SubmitVote(c *gin.Context) {
	debateIDHex := c.Param("id")
	debateID, err := primitive.ObjectIDFromHex(debateIDHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid debate ID"})
		return
	}

	var req struct {
		Vote string `json:"vote" binding:"required"` // "User" or "Bot"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	// Validate debate exists and is in a votable state (has an outcome)
	var debate models.DebateVsBot
	err = db.DebateVsBotCollection.FindOne(context.Background(), bson.M{"_id": debateID}).Decode(&debate)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Debate not found"})
		return
	}

	if debate.Outcome == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Debate must be finalized before voting"})
		return
	}

	// Basic duplicate prevention using IP
	voterID := c.ClientIP()

	// Check if this voter has already voted for this debate
	count, err := db.VotesCollection.CountDocuments(context.Background(), bson.M{
		"debateId": debateID,
		"voterId":  voterID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check existing votes"})
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "You have already voted on this debate"})
		return
	}

	vote := models.Vote{
		ID:        primitive.NewObjectID(),
		DebateID:  debateID,
		Vote:      req.Vote,
		VoterID:   voterID,
		Timestamp: time.Now(),
	}

	_, err = db.VotesCollection.InsertOne(context.Background(), vote)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit vote"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vote submitted successfully"})
}

// GetVerdicts combines AI and People's Choice verdicts
func GetVerdicts(c *gin.Context) {
	debateIDHex := c.Param("id")
	debateID, err := primitive.ObjectIDFromHex(debateIDHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid debate ID"})
		return
	}

	// Fetch debate for AI outcome
	var debate models.DebateVsBot
	err = db.DebateVsBotCollection.FindOne(context.Background(), bson.M{"_id": debateID}).Decode(&debate)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Debate not found"})
		return
	}

	// Aggregate People's Choice votes
	cursor, err := db.VotesCollection.Find(context.Background(), bson.M{"debateId": debateID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch votes"})
		return
	}
	defer cursor.Close(context.Background())

	userVotes := 0
	botVotes := 0
	for cursor.Next(context.Background()) {
		var vote models.Vote
		if err := cursor.Decode(&vote); err == nil {
			if vote.Vote == "User" {
				userVotes++
			} else if vote.Vote == "Bot" {
				botVotes++
			}
		}
	}

	peoplesChoice := "Draw"
	if userVotes > botVotes {
		peoplesChoice = "User"
	} else if botVotes > userVotes {
		peoplesChoice = "Bot"
	}

	c.JSON(http.StatusOK, gin.H{
		"debateId":  debateIDHex,
		"aiVerdict": debate.Outcome,
		"peoplesChoice": gin.H{
			"winner": peoplesChoice,
			"counts": gin.H{
				"user": userVotes,
				"bot":  botVotes,
			},
		},
	})
}
