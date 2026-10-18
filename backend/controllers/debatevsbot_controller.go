package controllers

import (
	"context"
	"encoding/json"
	"errors"
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
	"go.mongodb.org/mongo-driver/mongo"
)

type DebateRequest struct {
	DebateId     string           `json:"debateId"`
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
	DebateId string           `json:"debateId" binding:"required"`
	History  []models.Message `json:"history" binding:"required"`
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

type BotDebateSettlement struct {
	Debate         models.DebateVsBot
	ResultStatus   string
	AlreadySettled bool
}

var judgeDebateFunc = services.JudgeDebateWithError
var validateDebateTokenFunc = utils.ValidateTokenAndFetchEmail
var getDebateUserIDFunc = utils.GetUserIDFromEmail
var updateBotDebateGamificationFunc = updateGamificationAfterBotDebate
var updateBotDebateOutcomeFunc = db.UpdateDebateVsBotOutcome
var getLatestBotDebateFunc = db.GetLatestDebateVsBot
var saveBotDebateTranscriptFunc = services.SaveDebateTranscript
var settleBotDebateFunc = db.SettleBotDebate

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
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authorization token required",
		})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	valid, email, err := utils.ValidateTokenAndFetchEmail(
		"./config/config.prod.yml",
		token,
		c,
	)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid or expired token",
		})
		return
	}

	var req DebateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request payload: " + err.Error(),
		})
		return
	}

	// Validate the existing debate ID.
	debateID, err := primitive.ObjectIDFromHex(req.DebateId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid or missing debate ID",
		})
		return
	}

	// Verify ownership and ensure the debate is unsettled.
	var debate models.DebateVsBot

	lookupCtx, lookupCancel := context.WithTimeout(
		c.Request.Context(),
		10*time.Second,
	)

	err = db.DebateVsBotCollection.FindOne(
		lookupCtx,
		bson.M{
			"_id":     debateID,
			"email":   email,
			"outcome": bson.M{"$in": []string{"", "pending"}},
		},
	).Decode(&debate)

	lookupCancel()

	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Debate not found, not owned by you, or already settled",
			})
			return
		}

		log.Printf("Failed to fetch debate: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to load debate",
		})
		return
	}

	// Generate the bot response without holding a database timeout open.
	botResponse := services.GenerateBotResponse(
		debate.BotName,
		debate.BotLevel,
		debate.Topic,
		req.History,
		debate.Stance,
		req.Context,
		150,
	)

	// Do not persist a failed or empty bot response.
	if strings.TrimSpace(botResponse) == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "The bot could not generate a response. Please try again.",
		})
		return
	}

	updatedHistory := append(
		append([]models.Message(nil), req.History...),
		models.Message{
			Sender: "Bot",
			Text:   botResponse,
		},
	)

	// Use a fresh context for the database update.
	updateCtx, updateCancel := context.WithTimeout(
		c.Request.Context(),
		10*time.Second,
	)

	result, err := db.DebateVsBotCollection.UpdateOne(
		updateCtx,
		bson.M{
			"_id":     debateID,
			"email":   email,
			"outcome": bson.M{"$in": []string{"", "pending"}},
		},
		bson.M{
			"$set": bson.M{
				"history": updatedHistory,
			},
		},
	)

	updateCancel()

	if err != nil {
		log.Printf("Failed to update debate history: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to save debate message",
		})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Debate has already been settled",
		})
		return
	}

	c.JSON(http.StatusOK, DebateMessageResponse{
		DebateId: debateID.Hex(),
		BotName:  debate.BotName,
		BotLevel: debate.BotLevel,
		Topic:    debate.Topic,
		Stance:   debate.Stance,
		Response: botResponse,
	})
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
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	valid, email, err := validateDebateTokenFunc(
		"./config/config.prod.yml",
		token,
		c,
	)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	var req JudgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request payload: " + err.Error(),
		})
		return
	}

	debateID, err := primitive.ObjectIDFromHex(req.DebateId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid debate ID"})
		return
	}

	userID, err := getDebateUserIDFunc(email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to get user ID"})
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

	if !isValidJudgmentResult(result) {
		c.JSON(http.StatusBadGateway, gin.H{
			"error": "Unable to generate a valid debate judgment. Please try again.",
		})
		return
	}

	var judgment judgmentResult
	if err := json.Unmarshal([]byte(result), &judgment); err != nil ||
		judgment.Verdict == nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"error": "Unable to generate a valid debate judgment. Please try again.",
		})
		return
	}

	var resultStatus string
	switch strings.ToLower(strings.TrimSpace(judgment.Verdict.Winner)) {
	case "user":
		resultStatus = "win"
	case "bot":
		resultStatus = "loss"
	case "draw":
		resultStatus = "draw"
	default:
		c.JSON(http.StatusBadGateway, gin.H{
			"error": "The judgment contains an invalid winner.",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	settlement, err := settleBotDebateFunc(
		ctx,
		debateID,
		email,
		resultStatus,
		result,
	)
	if err != nil {
		switch {
		case errors.Is(err, db.ErrDebateNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "Debate not found"})
		case errors.Is(err, db.ErrDebateAlreadySettled):
			c.JSON(http.StatusConflict, gin.H{
				"error": "This debate has already been settled with a different result",
			})
		default:
			log.Printf("Failed to settle debate %s: %v", debateID.Hex(), err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to save debate judgment",
			})
		}
		return
	}

	// A retry of the same judgment returns the stored result without
	// awarding points or repeating gamification side effects.
	if settlement.AlreadySettled {
		c.JSON(http.StatusOK, JudgeResponse{
			Result: settlement.Debate.Judgment,
		})
		return
	}

	debate := settlement.Debate

	if err := saveBotDebateTranscriptFunc(
		userID,
		email,
		"user_vs_bot",
		debate.Topic,
		debate.BotName,
		resultStatus,
		req.History,
		nil,
	); err != nil {
		log.Printf("Failed to save debate transcript: %v", err)
	}

	func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic in post-settlement gamification: %v", r)
			}
		}()

		updateBotDebateGamificationFunc(userID, resultStatus, debate.Topic)
	}()

	c.JSON(http.StatusOK, JudgeResponse{Result: result})
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

	log.Println("[DEBUG] Fetching debate before generating bot response")
	// Get current user to check existing badges and score
	var user models.User
	err := userCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		log.Printf("ERROR: Failed to get user for gamification update: %v (userID: %s)", err, userID.Hex())
		log.Printf("[DEBUG] Debate lookup failed: %v", err)
		return
	}

	log.Printf("Successfully retrieved user: %s (email: %s)", userID.Hex(), user.Email)

	log.Printf("Current user score: %d, badges: %v", user.Score, user.Badges)

	// Ensure score field exists - if it's 0 or not set, initialize it
	// Points were already awarded atomically by db.SettleBotDebate.
	// This function now handles only post-settlement gamification effects.
	var pointsToAdd int
	var action string

	switch resultStatus {
	case "win":
		pointsToAdd = 50
		action = "debate_win"
	case "loss":
		pointsToAdd = 10
		action = "debate_loss"
	case "draw":
		pointsToAdd = 25
		action = "debate_complete"
	default:
		log.Printf("Invalid result status for gamification: %s", resultStatus)
		return
	}

	// The score was committed by the settlement transaction.
	// Do not increment it or insert another score_updates record here.
	updatedUser := user

	log.Printf(
		"Running post-settlement gamification for user %s: result=%s, score=%d",
		userID.Hex(),
		resultStatus,
		updatedUser.Score,
	)
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
		log.Println("[DEBUG] Saving updated debate history")
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
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authorization token required",
		})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	valid, email, err := validateDebateTokenFunc(
		"./config/config.prod.yml",
		token,
		c,
	)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid or expired token",
		})
		return
	}

	var req ConcedeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request payload: " + err.Error(),
		})
		return
	}

	debateID, err := primitive.ObjectIDFromHex(req.DebateId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid debate ID",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	settlement, err := settleBotDebateFunc(
		ctx,
		debateID,
		email,
		"loss",
		"", // Empty judgment means concession.
	)
	if err != nil {
		switch {
		case errors.Is(err, db.ErrDebateNotFound):
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Debate not found",
			})
		case errors.Is(err, db.ErrDebateAlreadySettled):
			c.JSON(http.StatusConflict, gin.H{
				"error": "This debate has already been settled",
			})
		default:
			log.Printf("Failed to settle conceded debate %s: %v", debateID.Hex(), err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to settle debate",
			})
		}
		return
	}

	// A repeated concession is successful, but must not repeat side effects.
	if settlement.AlreadySettled {
		c.JSON(http.StatusOK, gin.H{
			"message": "Debate conceded successfully",
		})
		return
	}

	debate := settlement.Debate

	historyToSave := debate.History
	if len(req.History) > 0 {
		historyToSave = req.History
	}

	userID, err := getDebateUserIDFunc(email)
	if err != nil {
		log.Printf("Could not get user ID for concession transcript: %v", err)
	} else {
		if err := saveBotDebateTranscriptFunc(
			userID,
			email,
			"user_vs_bot",
			debate.Topic,
			debate.BotName,
			"loss",
			historyToSave,
			nil,
		); err != nil {
			log.Printf("Failed to save concession transcript: %v", err)
		}

		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Panic in post-settlement gamification (concede): %v", r)
				}
			}()

			updateBotDebateGamificationFunc(userID, "loss", debate.Topic)
		}()
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Debate conceded successfully",
	})
}
