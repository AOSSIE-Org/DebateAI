package controllers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
	"os"
)

// SubmitTranscriptsRequest represents the request to submit debate transcripts
type SubmitTranscriptsRequest struct {
	RoomID              string            `json:"roomId" binding:"required"`
	Role                string            `json:"role" binding:"required"`
	Transcripts         map[string]string `json:"transcripts" binding:"required"`
	OpponentRole        string            `json:"opponentRole"`
	OpponentID          string            `json:"opponentId"`
	OpponentEmail       string            `json:"opponentEmail"`
	OpponentTranscripts map[string]string `json:"opponentTranscripts"`
}

// SaveTranscriptRequest represents the request to save a debate transcript
type SaveTranscriptRequest struct {
	DebateType  string            `json:"debateType" binding:"required"`
	Topic       string            `json:"topic" binding:"required"`
	Opponent    string            `json:"opponent" binding:"required"`
	Result      string            `json:"result"`
	Messages    []models.Message  `json:"messages"`
	Transcripts map[string]string `json:"transcripts,omitempty"`
}

// SubmitTranscripts handles the submission of debate transcripts
func SubmitTranscripts(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
 	if err != nil || !valid || email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	var req SubmitTranscriptsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	result, err := services.SubmitTranscripts(
		req.RoomID,
		req.Role,
		email,
		req.Transcripts,
		req.OpponentRole,
		req.OpponentID,
		req.OpponentEmail,
		req.OpponentTranscripts,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// SaveDebateTranscriptHandler handles saving a debate transcript
func SaveDebateTranscriptHandler(c *gin.Context) {
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

	var req SaveTranscriptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	// Get user ID from database using email
	userID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(401, gin.H{"error": "Failed to get user ID"})
		return
	}

	err = services.SaveDebateTranscript(
		userID,
		email,
		req.DebateType,
		req.Topic,
		req.Opponent,
		req.Result,
		"", // roomID unknown for manual saves
		req.Messages,
		req.Transcripts,
	)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to save transcript"})
		return
	}

	c.JSON(200, gin.H{"message": "Transcript saved successfully"})
}

// GetUserTranscriptsHandler retrieves all saved transcripts for a user
func GetUserTranscriptsHandler(c *gin.Context) {
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

	transcripts, err := services.GetUserDebateTranscripts(userID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to retrieve transcripts"})
		return
	}

	c.JSON(200, gin.H{"transcripts": transcripts})
}

// GetTranscriptByIDHandler retrieves a specific transcript by ID
func GetTranscriptByIDHandler(c *gin.Context) {
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

	// Get transcript ID from URL parameter
	transcriptID := c.Param("id")
	if transcriptID == "" {
		c.JSON(400, gin.H{"error": "Transcript ID required"})
		return
	}

	// Convert transcript ID to ObjectID
	transcriptObjectID, err := primitive.ObjectIDFromHex(transcriptID)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid transcript ID format", "details": err.Error(), "received_id": transcriptID})
		return
	}

	transcript, err := services.GetDebateTranscriptByID(transcriptObjectID, userID)
	if err != nil {
		if err.Error() == "transcript not found" {
			c.JSON(404, gin.H{"error": "Transcript not found"})
			return
		}
		c.JSON(500, gin.H{"error": "Failed to retrieve transcript"})
		return
	}

	c.JSON(200, gin.H{"transcript": transcript})
}

// DeleteTranscriptHandler deletes a saved transcript
func DeleteTranscriptHandler(c *gin.Context) {
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

	// Get transcript ID from URL parameter
	transcriptID := c.Param("id")
	if transcriptID == "" {
		c.JSON(400, gin.H{"error": "Transcript ID required"})
		return
	}

	// Convert transcript ID to ObjectID
	transcriptObjectID, err := primitive.ObjectIDFromHex(transcriptID)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid transcript ID format", "details": err.Error(), "received_id": transcriptID})
		return
	}

	err = services.DeleteDebateTranscript(transcriptObjectID, userID)
	if err != nil {
		if err.Error() == "transcript not found or not authorized to delete" {
			c.JSON(404, gin.H{"error": "Transcript not found"})
			return
		}
		c.JSON(500, gin.H{"error": "Failed to delete transcript"})
		return
	}

	c.JSON(200, gin.H{"message": "Transcript deleted successfully"})
}

// CreateTestTranscriptHandler creates a test transcript for debugging
func CreateTestTranscriptHandler(c *gin.Context) {
	if env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV"))); env == "prod" || env == "production" {
		c.JSON(403, gin.H{"error": "Not available"})
		return
	}
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

	// Create a test transcript
	testMessages := []models.Message{
		{Sender: "User", Text: "Hello, I'd like to debate about climate change."},
		{Sender: "Bot", Text: "Sure! Climate change is a fascinating topic. What's your position?"},
		{Sender: "User", Text: "I believe we need immediate action to address climate change."},
		{Sender: "Bot", Text: "That's an interesting perspective. Let me present a counterargument..."},
	}

	err = services.SaveDebateTranscript(
		userID,
		email,
		"user_vs_bot",
		"Climate Change Action",
		"AI Bot",
		"win",
		"",
		testMessages,
		nil,
	)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to save test transcript"})
		return
	}
	// Attempt to locate the transcript we just created and insert a mock judgement
	ctx2, cancel2 := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel2()

	coll := db.MongoDatabase.Collection("saved_debate_transcripts")
	var saved models.SavedDebateTranscript
	// Find the most recent matching transcript for this user and topic
	if err := coll.FindOne(ctx2, bson.M{"userId": userID, "topic": "Climate Change Action"}, options.FindOne().SetSort(bson.M{"createdAt": -1})).Decode(&saved); err == nil {
		// Insert a mock judgement document so the frontend can display a scorecard
		jColl := db.MongoDatabase.Collection("debate_judgements")
		mockScores := bson.M{
			"logic":      bson.M{"sideA": 8, "sideB": 6},
			"evidence":   bson.M{"sideA": 7, "sideB": 5},
			"persuasion": bson.M{"sideA": 8, "sideB": 7},
			"rebuttal":   bson.M{"sideA": 6, "sideB": 5},
		}
		insertDoc := bson.M{
			"_id":       primitive.NewObjectID(),
			"debateId":  saved.ID,
			"winner":    "Side A",
			"scores":    mockScores,
			"summary":   "Mock judgement: Side A provided stronger reasoning and evidence.",
			"createdAt": time.Now(),
		}
		// Ignore duplicate key errors to be idempotent
		_, _ = jColl.InsertOne(ctx2, insertDoc)
	}

	c.JSON(200, gin.H{"message": "Test transcript created successfully"})
}

// CreateTestBotDebateHandler creates a test bot debate transcript for debugging
func CreateTestBotDebateHandler(c *gin.Context) {
	if env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV"))); env == "prod" || env == "production" {
		c.JSON(403, gin.H{"error": "Not available"})
		return
	}
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

	// Create a test bot debate with realistic conversation
	testMessages := []models.Message{
		{Sender: "User", Text: "I believe that artificial intelligence will ultimately benefit humanity more than harm it.", Phase: "Opening"},
		{Sender: "Bot", Text: "That's an interesting perspective. However, I must point out several potential risks that could outweigh the benefits.", Phase: "Opening"},
		{Sender: "User", Text: "What specific risks are you referring to?", Phase: "Cross-Examination"},
		{Sender: "Bot", Text: "I'm concerned about job displacement, privacy violations, and the potential for AI systems to make biased decisions.", Phase: "Cross-Examination"},
		{Sender: "User", Text: "But AI can also create new jobs and improve efficiency. The benefits outweigh the risks.", Phase: "Rebuttal"},
		{Sender: "Bot", Text: "While AI may create some new jobs, the scale of displacement could be unprecedented.", Phase: "Rebuttal"},
		{Sender: "User", Text: "We need to focus on the positive applications like medical diagnosis and scientific research.", Phase: "Closing"},
		{Sender: "Bot", Text: "The risks of AI outweigh the potential benefits, especially given the current lack of proper regulation.", Phase: "Closing"},
		{Sender: "Judge", Text: "After careful consideration, the user has presented a stronger argument. User wins this debate."},
	}

	err = services.SaveDebateTranscript(
		userID,
		email,
		"user_vs_bot",
		"AI Benefits vs Risks",
		"Expert Emma",
		"win",
		"",
		testMessages,
		nil,
	)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to save test bot debate transcript"})
		return
	}

	c.JSON(200, gin.H{"message": "Test bot debate transcript created successfully"})
}

// GetDebateStatsHandler retrieves debate statistics for a user
func GetDebateStatsHandler(c *gin.Context) {
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

	stats, err := services.GetDebateStats(userID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to retrieve debate stats"})
		return
	}

	c.JSON(200, gin.H{"stats": stats})
}

// UpdatePendingTranscriptsHandler updates any existing transcripts with "pending" results
func UpdatePendingTranscriptsHandler(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(401, gin.H{"error": "Authorization token required"})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	// FIX: Assign email to variable
	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(401, gin.H{"error": "Invalid or expired token"})
		return
	}

	_ = email // Keep compiler happy if email is indeed not used below

	err = services.UpdatePendingTranscripts()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to update pending transcripts"})
		return
	}

	c.JSON(200, gin.H{"message": "Pending transcripts updated successfully"})
}

// UpdateTranscriptResultHandler updates a specific transcript's result
func UpdateTranscriptResultHandler(c *gin.Context) {
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

	// Get transcript ID from URL parameter
	transcriptID := c.Param("id")
	if transcriptID == "" {
		c.JSON(400, gin.H{"error": "Transcript ID required"})
		return
	}

	// Get new result from request body
	var req struct {
		Result string `json:"result" binding:"required,oneof=win loss draw"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// Convert transcript ID to ObjectID
	transcriptObjectID, err := primitive.ObjectIDFromHex(transcriptID)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid transcript ID format"})
		return
	}

	// Update the transcript result
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.MongoDatabase.Collection("saved_debate_transcripts")
	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"result":         req.Result,
			"updatedAt":      now,
			"manualOverride": true,
			"overriddenBy":   userID,
			"overriddenAt":   now,
		},
	}

	result, err := collection.UpdateOne(
		ctx,
		bson.M{"_id": transcriptObjectID, "userId": userID},
		update,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to update transcript result"})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(404, gin.H{"error": "Transcript not found or not authorized to update"})
		return
	}

	c.JSON(200, gin.H{"message": "Transcript result updated successfully"})
}