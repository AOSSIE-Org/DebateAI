package controllers

import (
	"log"
	"net/http"
	"strings"

	"arguehub/models"
	"arguehub/services"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
)

const (
	// maxAnalyticsBodyBytes caps the request body at 1 MB to prevent abuse.
	maxAnalyticsBodyBytes = 1 << 20 // 1 MB
	// maxHistoryMessages is the maximum number of messages allowed in a single analytics request.
	maxHistoryMessages = 200
	// maxTotalTextLength is the maximum cumulative character count across all messages.
	maxTotalTextLength = 500_000
)

// AnalyzeDebateRequest represents the request body for debate analytics
type AnalyzeDebateRequest struct {
	History    []models.Message `json:"history" binding:"required"`
	Topic      string           `json:"topic" binding:"required"`
	UserStance string           `json:"userStance" binding:"required"`
	BotName    string           `json:"botName" binding:"required"`
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

	// Cap the request body size to prevent abuse
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAnalyticsBodyBytes)

	var req AnalyzeDebateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request payload"})
		return
	}

	if len(req.History) == 0 {
		c.JSON(400, gin.H{"error": "Debate history cannot be empty"})
		return
	}

	// Validate message count and total text length
	if len(req.History) > maxHistoryMessages {
		c.JSON(400, gin.H{"error": "Debate history exceeds the maximum allowed message count"})
		return
	}
	totalLen := 0
	for _, msg := range req.History {
		totalLen += len(msg.Content)
	}
	if totalLen > maxTotalTextLength {
		c.JSON(400, gin.H{"error": "Debate transcript exceeds the maximum allowed text length"})
		return
	}

	analytics, err := services.AnalyzeDebateTranscript(req.History, req.Topic, req.UserStance, req.BotName)
	if err != nil {
		log.Printf("AnalyzeDebate error: %v", err)
		c.JSON(500, gin.H{"error": "Failed to analyze debate"})
		return
	}

	c.JSON(200, AnalyzeDebateResponse{
		Analytics: analytics,
	})
}