package controllers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"fmt"
)


func GetProfile(c *gin.Context) {
	email := c.GetString("email")
	if email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized", "message": "Missing email in context"})
		return
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Fetch user profile
	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found", "message": "User not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "message": fmt.Sprintf("Failed to fetch user: %v", err)})
		}
		return
	}

	// Avatar fallback
	profileAvatarURL := user.AvatarURL
	displayName := user.DisplayName
	if profileAvatarURL == "" {
		if displayName == "" {
			displayName = extractNameFromEmail(user.Email)
		}
		profileAvatarURL = "https://api.dicebear.com/9.x/adventurer/svg?seed=" + displayName
	}
	if displayName == "" {
		displayName = "Steve"
	}

	// Fetch top leaderboard
	leaderboardCursor, err := db.MongoDatabase.Collection("users").Find(
		dbCtx,
		bson.M{},
		options.Find().SetSort(bson.D{{"eloRating", -1}}).SetLimit(5),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "message": fmt.Sprintf("Failed to fetch leaderboard: %v", err)})
		return
	}
	defer leaderboardCursor.Close(dbCtx)

	var leaderboard []struct {
		Rank        int    `json:"rank"`
		Name        string `json:"name"`
		Score       int    `json:"score"`
		AvatarUrl   string `json:"avatarUrl"`
		CurrentUser bool   `json:"currentUser"`
	}
	rank := 1
	for leaderboardCursor.Next(dbCtx) {
		var lbUser models.User
		if err := leaderboardCursor.Decode(&lbUser); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "message": fmt.Sprintf("Failed to decode leaderboard user: %v", err)})
			return
		}
		lbName := lbUser.DisplayName
		if lbName == "" {
			lbName = extractNameFromEmail(lbUser.Email)
		}
		lbAvatar := lbUser.AvatarURL
		if lbAvatar == "" {
			lbAvatar = "https://api.dicebear.com/9.x/adventurer/svg?seed=" + lbName
		}
		leaderboard = append(leaderboard, struct {
			Rank        int    `json:"rank"`
			Name        string `json:"name"`
			Score       int    `json:"score"`
			AvatarUrl   string `json:"avatarUrl"`
			CurrentUser bool   `json:"currentUser"`
		}{rank, lbName, lbUser.EloRating, lbAvatar, lbUser.Email == email})
		rank++
	}

	// Fetch user's debate history
	debatesCursor, err := db.MongoDatabase.Collection("debates").Find(
		dbCtx,
		bson.M{"email": email},
		options.Find().SetSort(bson.D{{"date", 1}}),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "message": fmt.Sprintf("Failed to fetch debates: %v", err)})
		return
	}
	defer debatesCursor.Close(dbCtx)

	type DebateDoc struct {
		Topic     string    `bson:"topic"`
		Result    string    `bson:"result"`
		EloChange int       `bson:"eloChange"`
		EloRating int       `bson:"eloRating"` 
		Date      time.Time `bson:"date"`
	}

	var debateDocs []DebateDoc
	if err := debatesCursor.All(dbCtx, &debateDocs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "message": fmt.Sprintf("Failed to decode debates: %v", err)})
		return
	}

	// Process debates
	var wins, losses, draws int
	var eloHistory []struct {
		Elo  int       `json:"elo"`
		Date time.Time `json:"date"`
	}
	var debateHistory []struct {
		Topic     string `json:"topic"`
		Result    string `json:"result"`
		EloChange int    `json:"eloChange"`
	}

	for _, doc := range debateDocs {
		eloHistory = append(eloHistory, struct {
			Elo  int       `json:"elo"`
			Date time.Time `json:"date"`
		}{
			Elo:  doc.EloRating,
			Date: doc.Date,
		})

		debateHistory = append(debateHistory, struct {
			Topic     string `json:"topic"`
			Result    string `json:"result"`
			EloChange int    `json:"eloChange"`
		}{
			Topic:     doc.Topic,
			Result:    doc.Result,
			EloChange: doc.EloChange,
		})

		switch doc.Result {
		case "win":
			wins++
		case "loss":
			losses++
		case "draw":
			draws++
		}
	}

	// Final response
	response := gin.H{
		"profile": gin.H{
			"displayName": displayName,
			"email":       user.Email,
			"bio":         user.Bio,
			"eloRating":   user.EloRating,
			"twitter":     user.Twitter,
			"instagram":   user.Instagram,
			"linkedin":    user.LinkedIn,
			"avatarUrl":   profileAvatarURL,
		},
		"leaderboard": leaderboard,
		"stats": gin.H{
			"wins":          wins,
			"losses":        losses,
			"draws":         draws,
			"eloHistory":    eloHistory,
			"debateHistory": debateHistory,
		},
	}
	c.JSON(http.StatusOK, response)
}



func UpdateProfile(ctx *gin.Context) {
	email := ctx.GetString("email")
	if email == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized", "message": "Missing user email in context"})
		return
	}

	var updateData struct {
		DisplayName string `json:"displayName"`
		Bio         string `json:"bio"`
		Twitter     string `json:"twitter"`
		Instagram   string `json:"instagram"`
		LinkedIn    string `json:"linkedin"`
	}
	if err := ctx.ShouldBindJSON(&updateData); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "message": err.Error()})
		return
	}

	// Trim whitespace from input fields
	updateData.DisplayName = strings.TrimSpace(updateData.DisplayName)
	updateData.Bio = strings.TrimSpace(updateData.Bio)
	updateData.Twitter = strings.TrimSpace(updateData.Twitter)
	updateData.Instagram = strings.TrimSpace(updateData.Instagram)
	updateData.LinkedIn = strings.TrimSpace(updateData.LinkedIn)

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"email": email}
	update := bson.M{
		"$set": bson.M{
			"displayName": updateData.DisplayName,
			"bio":         updateData.Bio,
			"twitter":     updateData.Twitter,
			"instagram":   updateData.Instagram,
			"linkedin":    updateData.LinkedIn,
			"updatedAt":   time.Now(),
		},
	}
	result, err := db.MongoDatabase.Collection("users").UpdateOne(dbCtx, filter, update)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error", "message": "Failed to update profile"})
		return
	}

	if result.MatchedCount == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Not found", "message": "User not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}

// UpdateEloAfterDebate updates Elo ratings for winner and loser
func UpdateEloAfterDebate(ctx *gin.Context) {
	var req struct {
		WinnerID string `json:"winnerId"`
		LoserID  string `json:"loserId"`
		Topic    string `json:"topic"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "message": err.Error()})
		return
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	winnerObjID, err := primitive.ObjectIDFromHex(req.WinnerID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid winnerId"})
		return
	}
	loserObjID, err := primitive.ObjectIDFromHex(req.LoserID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid loserId"})
		return
	}

	var winner, loser models.User
	if err = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"_id": winnerObjID}).Decode(&winner); err != nil {
		if err == mongo.ErrNoDocuments {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Winner not found"})
		} else {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching winner from DB"})
		}
		return
	}

	if err = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"_id": loserObjID}).Decode(&loser); err != nil {
		if err == mongo.ErrNoDocuments {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Loser not found"})
		} else {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching loser from DB"})
		}
		return
	}

	// Calculate new Elo ratings
	newWinnerElo, newLoserElo := calculateEloRating(winner.EloRating, loser.EloRating, 1.0)
	winnerEloChange := newWinnerElo - winner.EloRating
	loserEloChange := newLoserElo - loser.EloRating

	// Update user Elo ratings
	_, err = db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"_id": winnerObjID}, bson.M{"$set": bson.M{"eloRating": newWinnerElo}})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	_, err = db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"_id": loserObjID}, bson.M{"$set": bson.M{"eloRating": newLoserElo}})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Record debate results
	now := time.Now()
	winnerDebate := models.Debate{
		Email:     winner.Email,
		Topic:     req.Topic,
		Result:    "win",
		EloChange: winnerEloChange,
		Date:      now,
	}
	loserDebate := models.Debate{
		Email:     loser.Email,
		Topic:     req.Topic,
		Result:    "loss",
		EloChange: loserEloChange,
		Date:      now,
	}

	db.MongoDatabase.Collection("debates").InsertOne(dbCtx, winnerDebate)
	db.MongoDatabase.Collection("debates").InsertOne(dbCtx, loserDebate)

	ctx.JSON(http.StatusOK, gin.H{
		"winnerNewElo": newWinnerElo,
		"loserNewElo":  newLoserElo,
	})
}

// extractNameFromEmail extracts the name from an email address
func extractNameFromEmail(email string) string {
	for i, char := range email {
		if char == '@' {
			return email[:i]
		}
	}
	return email
}