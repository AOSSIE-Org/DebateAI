package controllers

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"
	"arguehub/utils"
	"arguehub/websocket"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
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

	// Update gamification (score, badges, streaks) after bot debate
	log.Printf("About to call updateGamificationAfterBotDebate for user %s, result: %s, topic: %s",
		userID.Hex(), resultStatus, latestDebate.Topic)

	// Call synchronously but with recover to prevent panics from crashing the request
	func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic in updateGamificationAfterBotDebate: %v", r)
			}
		}()
		updateGamificationAfterBotDebate(userID, resultStatus, latestDebate.Topic)
	}()

	c.JSON(200, JudgeResponse{
		Result: result,
	})
}

// updateGamificationAfterBotDebate updates user score, checks for badges, and updates streaks after a bot debate
func updateGamificationAfterBotDebate(userID primitive.ObjectID, resultStatus, topic string) {
	// Add recover to catch any panics
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Panic recovered in updateGamificationAfterBotDebate: %v", r)
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	log.Printf("Starting gamification update for user %s, result: %s", userID.Hex(), resultStatus)

	// Check if database is initialized
	if db.MongoDatabase == nil {
		log.Printf("ERROR: MongoDatabase is nil! Cannot update gamification.")
		return
	}

	userCollection := db.MongoDatabase.Collection("users")
	log.Printf("User collection retrieved, attempting to find user %s", userID.Hex())

	// Get current user to check existing badges and score
	var user models.User
	err := userCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		log.Printf("ERROR: Failed to get user for gamification update: %v (userID: %s)", err, userID.Hex())
		return
	}

	log.Printf("Successfully retrieved user: %s (email: %s)", userID.Hex(), user.Email)
	log.Printf("Current user score: %d, badges: %v", user.Score, user.Badges)

	if user.Score < 0 {
		user.Score = 0
	}

	// Calculate points based on result
	var pointsToAdd int
	var action string
	switch resultStatus {
	case "win":
		pointsToAdd = 50 // Points for winning against bot
		action = "debate_win"
	case "loss":
		pointsToAdd = 10 // Participation points
		action = "debate_loss"
	case "draw":
		pointsToAdd = 25 // Points for draw
		action = "debate_complete"
	default:
		pointsToAdd = 10 // Default participation points
		action = "debate_complete"
	}

	log.Printf("Adding %d points for result: %s", pointsToAdd, resultStatus)

	update := bson.M{
		"$inc": bson.M{"score": pointsToAdd},
		"$set": bson.M{"updatedAt": time.Now()},
	}

	updateResult, err := userCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		log.Printf("Error updating score with UpdateOne: %v", err)
		return
	}

	if updateResult.MatchedCount == 0 {
		log.Printf("User not found for score update: %s", userID.Hex())
		return
	}

	var updatedUser models.User
	err = userCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&updatedUser)
	if err != nil {
		log.Printf("Error fetching updated user: %v", err)
		return
	}

	log.Printf("Successfully updated score. New score: %d (was %d, added %d)",
		updatedUser.Score, user.Score, pointsToAdd)

	scoreCollection := db.MongoDatabase.Collection("score_updates")
	scoreUpdate := models.ScoreUpdate{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		Points:    pointsToAdd,
		Action:    action,
		CreatedAt: time.Now(),
		Metadata: map[string]interface{}{
			"debateType": "user_vs_bot",
			"topic":      topic,
			"result":     resultStatus,
		},
	}
	if _, err := scoreCollection.InsertOne(ctx, scoreUpdate); err != nil {
		log.Printf("Error saving score update record: %v", err)
	}

	hasBadge := make(map[string]bool)
	for _, badge := range updatedUser.Badges {
		hasBadge[badge] = true
	}

	if resultStatus == "win" && !hasBadge["FirstWin"] {
		badgeUpdate := bson.M{"$addToSet": bson.M{"badges": "FirstWin"}}
		userCollection.UpdateOne(ctx, bson.M{"_id": userID}, badgeUpdate)

		updatedUser.Badges = append(updatedUser.Badges, "FirstWin")
		hasBadge["FirstWin"] = true

		badgeCollection := db.MongoDatabase.Collection("user_badges")
		userBadge := models.UserBadge{
			ID:        primitive.NewObjectID(),
			UserID:    userID,
			BadgeName: "FirstWin",
			EarnedAt:  time.Now(),
			Metadata: map[string]interface{}{
				"debateType": "user_vs_bot",
				"topic":      topic,
			},
		}
		badgeCollection.InsertOne(ctx, userBadge)

		websocket.BroadcastGamificationEvent(models.GamificationEvent{
			Type:      "badge_awarded",
			UserID:    userID.Hex(),
			BadgeName: "FirstWin",
			Timestamp: time.Now(),
		})
		log.Printf("Awarded FirstWin badge to user %s", userID.Hex())
	}

	checkAndAwardAutomaticBadges(ctx, userID, updatedUser)

	websocket.BroadcastGamificationEvent(models.GamificationEvent{
		Type:      "score_updated",
		UserID:    userID.Hex(),
		Points:    pointsToAdd,
		NewScore:  updatedUser.Score,
		Action:    action,
		Timestamp: time.Now(),
	})

	log.Printf("Updated gamification for user %s: +%d points (new score: %d), result: %s",
		userID.Hex(), pointsToAdd, updatedUser.Score, resultStatus)
}

// checkAndAwardAutomaticBadges checks if user qualifies for automatic badges
func checkAndAwardAutomaticBadges(ctx context.Context, userID primitive.ObjectID, user models.User) {
	userCollection := db.MongoDatabase.Collection("users")
	hasBadge := make(map[string]bool)
	for _, badge := range user.Badges {
		hasBadge[badge] = true
	}

	if user.Score >= 10 && !hasBadge["Novice"] {
		update := bson.M{"$addToSet": bson.M{"badges": "Novice"}}
		userCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)

		websocket.BroadcastGamificationEvent(models.GamificationEvent{
			Type:      "badge_awarded",
			UserID:    userID.Hex(),
			BadgeName: "Novice",
			Timestamp: time.Now(),
		})
	}

	if user.CurrentStreak >= 5 && !hasBadge["Streak5"] {
		update := bson.M{"$addToSet": bson.M{"badges": "Streak5"}}
		userCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)

		websocket.BroadcastGamificationEvent(models.GamificationEvent{
			Type:      "badge_awarded",
			UserID:    userID.Hex(),
			BadgeName: "Streak5",
			Timestamp: time.Now(),
		})
	}

	if user.Score >= 500 && !hasBadge["FactMaster"] {
		update := bson.M{"$addToSet": bson.M{"badges": "FactMaster"}}
		userCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)

		websocket.BroadcastGamificationEvent(models.GamificationEvent{
			Type:      "badge_awarded",
			UserID:    userID.Hex(),
			BadgeName: "FactMaster",
			Timestamp: time.Now(),
		})
	}
}
