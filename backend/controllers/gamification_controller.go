package controllers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"
	"arguehub/websocket"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// AwardBadgeRequest represents the request to award a badge
type AwardBadgeRequest struct {
	BadgeName string                 `json:"badgeName" binding:"required"`
	UserID    string                 `json:"userId,omitempty"` // Optional, defaults to current user
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateScoreRequest represents the request to update a user's score
type UpdateScoreRequest struct {
	Points   int                    `json:"points" binding:"required"`
	Action   string                 `json:"action" binding:"required"` // "debate_complete", "win", "streak", etc.
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// Valid actions for score updates
var validActions = map[string]bool{
	"debate_complete": true,
	"debate_win":      true,
	"debate_loss":     true,
	"streak":          true,
	"first_debate":    true,
	"participation":   true,
}

// Rate limit configuration: max requests per minute per action
const rateLimitWindow = 1 * time.Minute
const maxRequestsPerWindow = 10

// AwardBadge awards a badge to a user after validation
func AwardBadge(c *gin.Context) {
	var req AwardBadgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Get current user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	currentUserID := userID.(primitive.ObjectID)
	var targetUserID primitive.ObjectID

	// If userId is provided in request, validate it's the same user (or admin)
	if req.UserID != "" {
		var err error
		targetUserID, err = primitive.ObjectIDFromHex(req.UserID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
			return
		}
		// Users can only award badges to themselves unless they're admin
		if targetUserID != currentUserID {
			isAdmin, _ := c.Get("isAdmin")
			if isAdmin != true {
				c.JSON(http.StatusForbidden, gin.H{"error": "Cannot award badges to other users"})
				return
			}
		}
	} else {
		targetUserID = currentUserID
	}

	// Validate badge name
	validBadges := map[string]bool{
		"Novice":     true,
		"Streak5":    true,
		"FactMaster": true,
		"FirstWin":   true,
		"Debater10":  true,
	}

	if !validBadges[req.BadgeName] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid badge name"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if user already has this badge
	userCollection := db.MongoDatabase.Collection("users")
	var user models.User
	err := userCollection.FindOne(ctx, bson.M{"_id": targetUserID}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Check if badge already exists
	for _, badge := range user.Badges {
		if badge == req.BadgeName {
			c.JSON(http.StatusConflict, gin.H{"error": "User already has this badge"})
			return
		}
	}

	// Add badge to user
	update := bson.M{
		"$push": bson.M{"badges": req.BadgeName},
		"$set":  bson.M{"updatedAt": time.Now()},
	}

	_, err = userCollection.UpdateOne(ctx, bson.M{"_id": targetUserID}, update)
	if err != nil {
		log.Printf("Error awarding badge: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to award badge"})
		return
	}

	// Save badge record
	badgeCollection := db.MongoDatabase.Collection("user_badges")
	userBadge := models.UserBadge{
		ID:        primitive.NewObjectID(),
		UserID:    targetUserID,
		BadgeName: req.BadgeName,
		EarnedAt:  time.Now(),
		Metadata:  req.Metadata,
	}
	_, err = badgeCollection.InsertOne(ctx, userBadge)
	if err != nil {
		log.Printf("Error saving badge record: %v", err)
		// Don't fail the request, badge was already awarded
	}

	// Create notification for the badge
	go func() {
		services.CreateNotification(
			targetUserID,
			models.NotificationTypeBadge,
			"New Badge Earned!",
			fmt.Sprintf("You have earned the %s badge!", req.BadgeName),
			"/profile",
		)
	}()

	// Broadcast badge award via WebSocket
	websocket.BroadcastGamificationEvent(models.GamificationEvent{
		Type:      "badge_awarded",
		UserID:    targetUserID.Hex(),
		BadgeName: req.BadgeName,
		Timestamp: time.Now(),
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "Badge awarded successfully",
		"badge":   req.BadgeName,
		"userId":  targetUserID.Hex(),
	})
}

// UpdateScore updates a user's score when they complete valid actions
func UpdateScore(c *gin.Context) {
	var req UpdateScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	// Validate action
	if !validActions[req.Action] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action"})
		return
	}

	// Get current user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	currentUserID := userID.(primitive.ObjectID)

	// Rate limiting check
	if !checkRateLimit(currentUserID, req.Action) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded. Please try again later."})
		return
	}

	// Validate points (anti-cheat: reasonable limits)
	if req.Points < 0 || req.Points > 1000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid points value"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userCollection := db.MongoDatabase.Collection("users")

	// Update user score atomically
	update := bson.M{
		"$inc": bson.M{"score": req.Points},
		"$set": bson.M{"updatedAt": time.Now()},
	}

	result := userCollection.FindOneAndUpdate(
		ctx,
		bson.M{"_id": currentUserID},
		update,
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	)

	var updatedUser models.User
	if err := result.Decode(&updatedUser); err != nil {
		log.Printf("Error updating score: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update score"})
		return
	}

	// Save score update record
	scoreCollection := db.MongoDatabase.Collection("score_updates")
	scoreUpdate := models.ScoreUpdate{
		ID:        primitive.NewObjectID(),
		UserID:    currentUserID,
		Points:    req.Points,
		Action:    req.Action,
		CreatedAt: time.Now(),
		Metadata:  req.Metadata,
	}
	_, err := scoreCollection.InsertOne(ctx, scoreUpdate)
	if err != nil {
		log.Printf("Error saving score update record: %v", err)
		// Don't fail the request
	}

	// Check for automatic badge awards
	checkAndAwardBadges(ctx, currentUserID, updatedUser)

	// Broadcast score update via WebSocket
	websocket.BroadcastGamificationEvent(models.GamificationEvent{
		Type:      "score_updated",
		UserID:    currentUserID.Hex(),
		Points:    req.Points,
		NewScore:  updatedUser.Score,
		Action:    req.Action,
		Timestamp: time.Now(),
	})

	c.JSON(http.StatusOK, gin.H{
		"message":  "Score updated successfully",
		"points":   req.Points,
		"newScore": updatedUser.Score,
	})
}

// checkRateLimit verifies if a request should be rate limited
func checkRateLimit(userID primitive.ObjectID, action string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	rateLimitCollection := db.MongoDatabase.Collection("rate_limits")
	now := time.Now()
	windowStart := now.Truncate(rateLimitWindow)

	// Find or create rate limit entry
	filter := bson.M{
		"userId":      userID,
		"action":      action,
		"windowStart": windowStart,
	}

	var entry models.RateLimitEntry
	err := rateLimitCollection.FindOne(ctx, filter).Decode(&entry)

	if err != nil {
		// No entry exists, create one
		newEntry := models.RateLimitEntry{
			UserID:      userID,
			Action:      action,
			Count:       1,
			WindowStart: windowStart,
		}
		rateLimitCollection.InsertOne(ctx, newEntry)
		return true
	}

	// Check if limit exceeded
	if entry.Count >= maxRequestsPerWindow {
		return false
	}

	// Increment count
	update := bson.M{"$inc": bson.M{"count": 1}}
	rateLimitCollection.UpdateOne(ctx, filter, update)

	// Clean up old entries (background operation)
	go cleanupOldRateLimits()

	return true
}

// cleanupOldRateLimits removes rate limit entries older than the window
func cleanupOldRateLimits() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cutoff := time.Now().Add(-rateLimitWindow * 2)
	rateLimitCollection := db.MongoDatabase.Collection("rate_limits")
	rateLimitCollection.DeleteMany(ctx, bson.M{"windowStart": bson.M{"$lt": cutoff}})
}

// checkAndAwardBadges checks if user qualifies for automatic badges
func checkAndAwardBadges(ctx context.Context, userID primitive.ObjectID, user models.User) {
	userCollection := db.MongoDatabase.Collection("users")
	hasBadge := make(map[string]bool)
	for _, badge := range user.Badges {
		hasBadge[badge] = true
	}

	// Check for Novice badge (first debate completed)
	if user.Score >= 10 && !hasBadge["Novice"] {
		update := bson.M{"$push": bson.M{"badges": "Novice"}}
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
		update := bson.M{"$push": bson.M{"badges": "Streak5"}}
		userCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)

		websocket.BroadcastGamificationEvent(models.GamificationEvent{
			Type:      "badge_awarded",
			UserID:    userID.Hex(),
			BadgeName: "Streak5",
			Timestamp: time.Now(),
		})
	}

	// Check for FactMaster badge (high score threshold, example: 500 points)
	if user.Score >= 500 && !hasBadge["FactMaster"] {
		update := bson.M{"$push": bson.M{"badges": "FactMaster"}}
		userCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)

		websocket.BroadcastGamificationEvent(models.GamificationEvent{
			Type:      "badge_awarded",
			UserID:    userID.Hex(),
			BadgeName: "FactMaster",
			Timestamp: time.Now(),
		})
	}
}

// GetLeaderboard returns the top users based on their scores
func GetGamificationLeaderboard(c *gin.Context) {
	// Check for authenticated user
	currentemail, exists := c.Get("email")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get limit from query params (default 50)
	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsed, err := parseInt(limitStr); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Query users sorted by Score (descending)
	collection := db.MongoDatabase.Collection("users")
	findOptions := options.Find().SetSort(bson.D{{"score", -1}}).SetLimit(int64(limit))
	cursor, err := collection.Find(ctx, bson.M{}, findOptions)
	if err != nil {
		log.Printf("Failed to fetch users: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch leaderboard data"})
		return
	}
	defer cursor.Close(ctx)

	// Decode users into slice
	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		log.Printf("Failed to decode users: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode leaderboard data"})
		return
	}

	// Build debaters list
	var debaters []Debater
	for i, user := range users {
		name := user.DisplayName
		if name == "" {
			name = user.Email // Fallback to email
		}

		avatarURL := user.AvatarURL
		if avatarURL == "" {
			avatarURL = "https://api.dicebear.com/9.x/adventurer/svg?seed=" + name
		}

		isCurrentUser := user.Email == currentemail
		debaters = append(debaters, Debater{
			ID:          user.ID.Hex(),
			Rank:        i + 1,
			Name:        name,
			Score:       user.Score,
			Rating:      int(user.Rating),
			AvatarURL:   avatarURL,
			CurrentUser: isCurrentUser,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"debaters": debaters,
		"total":    len(debaters),
	})
}

// Helper function to parse int
func parseInt(s string) (int, error) {
	var result int
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}
