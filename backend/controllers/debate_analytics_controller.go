package controllers

import (
	"strings"

	"arguehub/models"
	"arguehub/services"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
)

// AnalyzeDebateRequest represents the request body for debate analytics
type AnalyzeDebateRequest struct {
	History   []models.Message `json:"history" binding:"required"`
	Topic     string           `json:"topic" binding:"required"`
	UserStance string          `json:"userStance" binding:"required"`
	BotName   string           `json:"botName" binding:"required"`
}

// AnalyzeDebateResponse represents the analytics response
type AnalyzeDebateResponse struct {
	Analytics string `json:"analytics"`
}

// AnalyzeDebate handles the POST /vsbot/analyze endpoint.
// It accepts a debate transcript and returns a comprehensive AI-powered
// analytics report including fallacy detection, 4-pillar scoring,
// argument matrix analysis, and personalized coaching tips.
func AnalyzeDebate(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(401, gin.H{"error": "Authorization token required"})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	valid, _, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(401, gin.H{"error": "Invalid or expired token"})
		return
	}

	var req AnalyzeDebateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	if len(req.History) == 0 {
		c.JSON(400, gin.H{"error": "Debate history cannot be empty"})
		return
	}

	analytics, err := services.AnalyzeDebateTranscript(req.History, req.Topic, req.UserStance, req.BotName)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to analyze debate: " + err.Error()})
		return
	}

	c.JSON(200, AnalyzeDebateResponse{
		Analytics: analytics,
	})
}
