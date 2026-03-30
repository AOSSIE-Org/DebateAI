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

type ImpromptuRequest struct {
	Topic      string `json:"topic" binding:"required"`
	Transcript string `json:"transcript" binding:"required"`
}

func GetRandomTopicHandler(c *gin.Context) {
	// Extract and validate token
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	
	valid, _, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	// Fetch random topic from service layer
	topic := services.GetRandomImpromptuTopic()

	c.JSON(http.StatusOK, gin.H{
		"topic": topic,
	})
}

func EvaluateImpromptuHandler(c *gin.Context) {
	// Validate token and extract user information
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	userID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to get user ID"})
		return
	}

	var req ImpromptuRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	log.Printf("Evaluating impromptu speech for user %s on topic '%s'", email, req.Topic)

	// Evaluate transcript using AI service
	eval, err := services.EvaluateImpromptuSpeech(req.Topic, req.Transcript)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate speech: " + err.Error()})
		return
	}

	// Determine win/loss based on total score (>= 70 is a win)
	resultStr := "loss"
	if eval.Total.User >= 70 { 
		resultStr = "win"
	}

	// Save transcript to database history
	history := []models.Message{
		{Sender: "User", Text: req.Transcript, Phase: "Impromptu Speech"},
		{Sender: "Judge", Text: eval.Verdict.Reason, Phase: "AI Evaluation"},
	}

	_ = services.SaveDebateTranscript(
		userID,
		email,
		"impromptu",        
		req.Topic,
		"AI Evaluator",     
		resultStr,          
		history,
		nil,
	)

	// Update gamification scores asynchronously
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic in updateGamification (impromptu): %v", r)
			}
		}()
		updateGamificationAfterBotDebate(userID, resultStr, req.Topic)
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Evaluation successful",
		"data":    eval,
	})
}