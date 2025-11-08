package controllers

import (
	"encoding/json"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type DebateRequest struct {
	BotName      string           `json:"botName" binding:"required"`
	BotLevel     string           `json:"botLevel" binding:"required"`
	Topic        string           `json:"topic" binding:"required"`
	Stance       string           `json:"stance" binding:"required"`
	History      []models.Message `json:"history"`
	PhaseTimings []PhaseTiming    `json:"phaseTimings"`
	Context      string           `json:"context"`
}

type PhaseTiming struct {
	Name string `json:"name" binding:"required"`
	Time int    `json:"time" binding:"required"` // Single time value in seconds
}

type JudgeRequest struct {
	History []models.Message `json:"history" binding:"required"`
}

type DebateResponse struct {
	DebateId     string               `json:"debateId"`
	BotName      string               `json:"botName"`
	BotLevel     string               `json:"botLevel"`
	Topic        string               `json:"topic"`
	Stance       string               `json:"stance"`
	PhaseTimings []models.PhaseTiming `json:"phaseTimings,omitempty"` // Backend format
}

type DebateMessageResponse struct {
	DebateId string `json:"debateId"`
	BotName  string `json:"botName"`
	BotLevel string `json:"botLevel"`
	Topic    string `json:"topic"`
	Stance   string `json:"stance"`
	Response string `json:"response"`
}

type JudgeResponse struct {
	Result string `json:"result"`
}

func CreateDebate(c *gin.Context) {
	// Extract token from request header
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(401, gin.H{"error": "Authorization token required"})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	// Validate token and get user email
	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(401, gin.H{"error": "Invalid or expired token"})
		return
	}

	var req DebateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	// Convert PhaseTimings to backend model format
	backendPhaseTimings := make([]models.PhaseTiming, len(req.PhaseTimings))
	for i, pt := range req.PhaseTimings {
		backendPhaseTimings[i] = models.PhaseTiming{
			Name:     pt.Name,
			UserTime: pt.Time,
			BotTime:  pt.Time,
		}
	}

	debate := models.DebateVsBot{
		Email:        email,
		BotName:      req.BotName,
		BotLevel:     req.BotLevel,
		Topic:        req.Topic,
		Stance:       req.Stance,
		History:      req.History,
		PhaseTimings: backendPhaseTimings,
		CreatedAt:    time.Now().Unix(),
	}

	debateID, err := services.CreateDebateService(&debate, req.Stance)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to create debate: " + err.Error()})
		return
	}

	response := DebateResponse{
		DebateId:     debateID,
		BotName:      req.BotName,
		BotLevel:     req.BotLevel,
		Topic:        req.Topic,
		Stance:       req.Stance,
		PhaseTimings: backendPhaseTimings,
	}
	c.JSON(200, response)
}

func SendDebateMessage(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(401, gin.H{"error": "Authorization token required"})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(401, gin.H{"error": "Invalid or expired token"})
		return
	}

	var req DebateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	// Generate bot response with the additional context field.
	botResponse := services.GenerateBotResponse(req.BotName, req.BotLevel, req.Topic, req.History, req.Stance, req.Context, 150)

	// Update debate history with the bot's response.
	updatedHistory := append(req.History, models.Message{
		Sender: "Bot",
		Text:   botResponse,
		// You can also store the phase if needed.
	})

	debate := models.DebateVsBot{
		Email:     email,
		BotName:   req.BotName,
		BotLevel:  req.BotLevel,
		Topic:     req.Topic,
		Stance:    req.Stance,
		History:   updatedHistory,
		CreatedAt: time.Now().Unix(),
	}

	// Save to database (assuming ID is generated in service or here)
	if debate.ID.IsZero() {
		debate.ID = primitive.NewObjectID()
	}
	if err := db.SaveDebateVsBot(debate); err != nil {
	}

	response := DebateMessageResponse{
		DebateId: debate.ID.Hex(),
		BotName:  req.BotName,
		BotLevel: req.BotLevel,
		Topic:    req.Topic,
		Stance:   req.Stance,
		Response: botResponse,
	}
	c.JSON(200, response)
}

func JudgeDebate(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(401, gin.H{"error": "Authorization token required"})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(401, gin.H{"error": "Invalid or expired token"})
		return
	}

	// Get user ID from database using email
	userID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(401, gin.H{"error": "Failed to get user ID"})
		return
	}

	var req JudgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	// Judge the debate
	result := services.JudgeDebate(req.History)

	// Update debate outcome
	if err := db.UpdateDebateVsBotOutcome(email, result); err != nil {
	}

	// Get the latest debate information to extract proper details
	latestDebate, err := db.GetLatestDebateVsBot(email)
	if err != nil {
		// Use defaults if we can't get the debate info
		latestDebate = &models.DebateVsBot{
			Topic:   "Debate vs Bot",
			BotName: "AI Bot",
		}
	}

	// Determine result from judge's response
	resultStatus := "pending"

	// Try to parse JSON response first
	var judgeResponse map[string]interface{}
	if err := json.Unmarshal([]byte(result), &judgeResponse); err == nil {
		// If JSON parsing succeeds, extract winner from verdict
		if verdict, ok := judgeResponse["verdict"].(map[string]interface{}); ok {
			if winner, ok := verdict["winner"].(string); ok {
				if strings.EqualFold(winner, "User") {
					resultStatus = "win"
				} else if strings.EqualFold(winner, "Bot") {
					resultStatus = "loss"
				} else if strings.EqualFold(winner, "Draw") {
					resultStatus = "draw"
				} else {
					// If winner is not clearly "User", "Bot", or "Draw", default to loss
					resultStatus = "loss"
				}
			} else {
				// Default to loss if we can't determine winner
				resultStatus = "loss"
			}
		} else {
			// Default to loss if we can't determine winner
			resultStatus = "loss"
		}
	} else {
		// Fallback to string matching if JSON parsing fails
		resultLower := strings.ToLower(result)
		if strings.Contains(resultLower, "user win") || strings.Contains(resultLower, "user wins") ||
			strings.Contains(resultLower, "user") && strings.Contains(resultLower, "win") {
			resultStatus = "win"
		} else if strings.Contains(resultLower, "bot win") || strings.Contains(resultLower, "bot wins") ||
			strings.Contains(resultLower, "lose") || strings.Contains(resultLower, "loss") ||
			strings.Contains(resultLower, "bot") && strings.Contains(resultLower, "win") {
			resultStatus = "loss"
		} else if strings.Contains(resultLower, "draw") {
			resultStatus = "draw"
		} else {
			// If no clear pattern is found, default to loss
			resultStatus = "loss"
		}
	}

	// Save transcript with proper debate information
	_ = services.SaveDebateTranscript(
		userID,
		email,
		"user_vs_bot",
		latestDebate.Topic,
		latestDebate.BotName,
		resultStatus,
		req.History,
		nil,
	)

	c.JSON(200, JudgeResponse{
		Result: result,
	})
}
