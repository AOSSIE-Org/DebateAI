package controllers

import (
	"context"
	"encoding/json"
	"log"
	"math"
	"net/http"
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

var judgeDebateFunc = services.JudgeDebateWithError
var validateDebateTokenFunc = utils.ValidateTokenAndFetchEmail
var getDebateUserIDFunc = utils.GetUserIDFromEmail
var updateBotDebateGamificationFunc = updateGamificationAfterBotDebate
var updateBotDebateOutcomeFunc = db.UpdateDebateVsBotOutcome
var getLatestBotDebateFunc = db.GetLatestDebateVsBot
var saveBotDebateTranscriptFunc = services.SaveDebateTranscript

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

type judgmentScore struct {
	Score  *float64 `json:"score"`
	Reason string   `json:"reason"`
}

type judgmentSection struct {
	User *judgmentScore `json:"user"`
	Bot  *judgmentScore `json:"bot"`
}

type judgmentTotal struct {
	User *float64 `json:"user"`
	Bot  *float64 `json:"bot"`
}

type judgmentVerdict struct {
	Winner string `json:"winner"`
}

type judgmentResult struct {
	OpeningStatement *judgmentSection `json:"opening_statement"`
	CrossExamination *judgmentSection `json:"cross_examination"`
	Answers          *judgmentSection `json:"answers"`
	Closing          *judgmentSection `json:"closing"`
	Total            *judgmentTotal   `json:"total"`
	Verdict          *judgmentVerdict `json:"verdict"`
}

func isValidJudgmentResult(result string) bool {
	if strings.TrimSpace(result) == "" {
		return false
	}

	var judgment judgmentResult
	if err := json.Unmarshal([]byte(result), &judgment); err != nil {
		return false
	}

	sections := []*judgmentSection{
		judgment.OpeningStatement,
		judgment.CrossExamination,
		judgment.Answers,
		judgment.Closing,
	}

	for _, section := range sections {
		if section == nil ||
			!validJudgmentScore(section.User) ||
			!validJudgmentScore(section.Bot) {
			return false
		}
	}

	if judgment.Total == nil ||
		judgment.Total.User == nil ||
		judgment.Total.Bot == nil ||
		judgment.Verdict == nil {
		return false
	}
	userTotal := *judgment.Total.User
	botTotal := *judgment.Total.Bot

	var calculatedUserTotal float64
	var calculatedBotTotal float64

	for _, section := range sections {
		calculatedUserTotal += *section.User.Score
		calculatedBotTotal += *section.Bot.Score
	}

	const scoreTolerance = 1e-9

	if userTotal < 0 || userTotal > 40 ||
		botTotal < 0 || botTotal > 40 ||
		math.Abs(userTotal-calculatedUserTotal) > scoreTolerance ||
		math.Abs(botTotal-calculatedBotTotal) > scoreTolerance {
		return false
	}
	switch judgment.Verdict.Winner {
	case "User", "Bot", "Draw":
		return true
	default:
		return false
	}
}

func validJudgmentScore(score *judgmentScore) bool {
	return score != nil &&
		score.Score != nil &&
		*score.Score >= 0 &&
		*score.Score <= 10 &&
		strings.TrimSpace(score.Reason) != ""
}

func JudgeDebate(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(401, gin.H{"error": "Authorization token required"})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	valid, email, err := validateDebateTokenFunc(
		"./config/config.prod.yml",
		token,
		c,
	)
	if err != nil || !valid {
		c.JSON(401, gin.H{"error": "Invalid or expired token"})
		return
	}

	userID, err := getDebateUserIDFunc(email)
	if err != nil {
		c.JSON(401, gin.H{"error": "Failed to get user ID"})
		return
	}

	var req JudgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{
			"error": "Invalid request payload: " + err.Error(),
		})
		return
	}
	result, err := judgeDebateFunc(req.History)
	if err != nil {
		log.Printf("Debate judgment failed: %v", err)

		c.JSON(http.StatusBadGateway, gin.H{
			"error": "Unable to generate a debate judgment. Please try again later.",
		})
		return
	}

	log.Printf("JudgeDebate returned %d characters", len(result))

	// Validate the complete judgment before performing side effects.
	if !isValidJudgmentResult(result) {
		c.JSON(502, gin.H{
			"error": "Unable to generate a valid debate judgment. Please try again.",
		})
		return
	}

	// Determine the result from the validated judgment.
	var judgment judgmentResult
	if err := json.Unmarshal([]byte(result), &judgment); err != nil {
		// Defensive check; validation above should already guarantee this.
		c.JSON(502, gin.H{
			"error": "Unable to generate a valid debate judgment. Please try again.",
		})
		return
	}

	resultStatus := "pending"

	switch judgment.Verdict.Winner {
	case "User":
		resultStatus = "win"
	case "Bot":
		resultStatus = "loss"
	case "Draw":
		resultStatus = "draw"
	}

	// Persist the judgment before saving the transcript or awarding points.
	if err := updateBotDebateOutcomeFunc(email, result); err != nil {
		log.Printf("Failed to update debate outcome: %v", err)
		c.JSON(500, gin.H{
			"error": "Failed to save debate judgment",
		})
		return
	}

	// Get the latest debate information.
	latestDebate, err := getLatestBotDebateFunc(email)
	if err != nil || latestDebate == nil {
		log.Printf("Failed to get latest debate information for %s: %v", email, err)

		latestDebate = &models.DebateVsBot{
			Topic:   "Debate vs Bot",
			BotName: "AI Bot",
		}
	}

	// Save the transcript and report failures instead of silently ignoring them.
	if err := saveBotDebateTranscriptFunc(
		userID,
		email,
		"user_vs_bot",
		latestDebate.Topic,
		latestDebate.BotName,
		resultStatus,
		req.History,
		nil,
	); err != nil {
		log.Printf("Failed to save debate transcript: %v", err)
	}

	// Update gamification after a valid judgment.
	log.Printf(
		"About to call updateGamificationAfterBotDebate for user %s, result: %s, topic: %s",
		userID.Hex(),
		resultStatus,
		latestDebate.Topic,
	)

	func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic in updateGamificationAfterBotDebate: %v", r)
			}
		}()

		updateBotDebateGamificationFunc(
			userID,
			resultStatus,
			latestDebate.Topic,
		)
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

	// Ensure score field exists - if it's 0 or not set, initialize it
	// Note: MongoDB's $inc will create the field if it doesn't exist, but we'll ensure it's set
	if user.Score < 0 {
		// If score is negative (shouldn't happen), reset it to 0
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

	// Update user score atomically - $inc will create the field if it doesn't exist
	update := bson.M{
		"$inc": bson.M{"score": pointsToAdd},
		"$set": bson.M{"updatedAt": time.Now()},
	}

	// Use UpdateOne first to ensure the update happens
	updateResult, err := userCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		log.Printf("Error updating score with UpdateOne: %v", err)
		return
	}

	if updateResult.MatchedCount == 0 {
		log.Printf("User not found for score update: %s", userID.Hex())
		return
	}

	// Now fetch the updated user
	var updatedUser models.User
	err = userCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&updatedUser)
	if err != nil {
		log.Printf("Error fetching updated user: %v", err)
		return
	}

	log.Printf("Successfully updated score. New score: %d (was %d, added %d)",
		updatedUser.Score, user.Score, pointsToAdd)

	// Save score update record
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
	_, err = scoreCollection.InsertOne(ctx, scoreUpdate)
	if err != nil {
		log.Printf("Error saving score update record: %v", err)
		// Don't fail, continue with badge checks
	}

	// Update streak/activity on this verified debate completion before badge checks.
	if err := updateStreakAndActivity(ctx, userID, &updatedUser); err != nil {
		log.Printf("Error updating streak/activity for user %s: %v", userID.Hex(), err)
		return
	}

	// Check for badges (FirstWin, etc.)
	hasBadge := make(map[string]bool)
	for _, badge := range updatedUser.Badges {
		hasBadge[badge] = true
	}

	// Check for FirstWin badge (first win against bot)
	if resultStatus == "win" && !hasBadge["FirstWin"] {
		badgeUpdate := bson.M{"$addToSet": bson.M{"badges": "FirstWin"}}
		userCollection.UpdateOne(ctx, bson.M{"_id": userID}, badgeUpdate)

		// Update the updatedUser object to include the new badge
		updatedUser.Badges = append(updatedUser.Badges, "FirstWin")
		hasBadge["FirstWin"] = true

		// Save badge record
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

		// Broadcast badge award via WebSocket
		websocket.BroadcastGamificationEvent(models.GamificationEvent{
			Type:      "badge_awarded",
			UserID:    userID.Hex(),
			BadgeName: "FirstWin",
			Timestamp: time.Now(),
		})
		log.Printf("Awarded FirstWin badge to user %s", userID.Hex())
	}

	// Check for automatic badges (Novice, Streak5, FactMaster, etc.)
	checkAndAwardAutomaticBadges(ctx, userID, updatedUser)

	// Broadcast score update via WebSocket
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

	// Check for Novice badge (first debate completed)
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

	// Check for Streak5 badge (5 day streak)
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

	// Check for FactMaster badge (high score threshold)
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

	// Check for Debater10 badge (10 debates completed)
	// Note: This would require tracking debate count, which might need to be added
}

type ConcedeRequest struct {
	DebateId string           `json:"debateId" binding:"required"`
	History  []models.Message `json:"history"`
}

func ConcedeDebate(c *gin.Context) {
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

	var req ConcedeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	objID, err := primitive.ObjectIDFromHex(req.DebateId)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid debate ID"})
		return
	}

	// Fetch the debate to get details
	var debate models.DebateVsBot
	err = db.DebateVsBotCollection.FindOne(context.Background(), bson.M{"_id": objID}).Decode(&debate)
	if err != nil {
		c.JSON(404, gin.H{"error": "Debate not found"})
		return
	}

	// Update debate outcome
	filter := bson.M{"_id": objID}
	update := bson.M{"$set": bson.M{"outcome": "User conceded"}}

	_, err = db.DebateVsBotCollection.UpdateOne(context.Background(), filter, update)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to update debate: " + err.Error()})
		return
	}

	// Get user ID from email
	userCollection := db.GetCollection("users")
	var user models.User
	err = userCollection.FindOne(context.Background(), bson.M{"email": email}).Decode(&user)
	if err != nil {
		// Log error but don't fail the request as the main action succeeded
		log.Printf("Error finding user for concede updates: %v", err)
		c.JSON(200, gin.H{"message": "Debate conceded successfully"})
		return
	}

	// Save transcript to history
	// We treat concession as a loss
	// Use history from request if available, otherwise fall back to debate record history
	historyToSave := debate.History
	if len(req.History) > 0 {
		historyToSave = req.History
	}

	_ = services.SaveDebateTranscript(
		user.ID,
		email,
		"user_vs_bot",
		debate.Topic,
		debate.BotName,
		"loss",
		historyToSave,
		nil,
	)

	// Update gamification (score, badges, streaks)
	// Call synchronously but with recover to prevent panics
	func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic in updateGamificationAfterBotDebate (concede): %v", r)
			}
		}()
		updateGamificationAfterBotDebate(user.ID, "loss", debate.Topic)
	}()

	c.JSON(200, gin.H{"message": "Debate conceded successfully"})
}
