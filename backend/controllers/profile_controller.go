package controllers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Calculate new Elo ratings using float64
func calculateEloRating(ratingA, ratingB float64, scoreA float64) (newRatingA, newRatingB float64) {
	const K = 32.0
	expectedA := 1.0 / (1.0 + math.Pow(10, (ratingB-ratingA)/400.0))
	expectedB := 1.0 - expectedA
	scoreB := 1.0 - scoreA

	newRatingA = ratingA + K*(scoreA-expectedA)
	newRatingB = ratingB + K*(scoreB-expectedB)
	return newRatingA, newRatingB
}

func extractNameFromEmail(email string) string {
	for i, char := range email {
		if char == '@' {
			return email[:i]
		}
	}
	return email
}


func GetProfile(c *gin.Context) {
	email := c.GetString("email")
	if email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized", "message": "Missing email in context"})
		return
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "message": fmt.Sprintf("Failed to fetch user: %v", err)})
		return
	}

	displayName := user.DisplayName
	if displayName == "" {
		displayName = extractNameFromEmail(user.Email)
	}
	avatar := user.AvatarURL
	if avatar == "" {
		avatar = "https://api.dicebear.com/9.x/adventurer/svg?seed=" + displayName
	}

	// Leaderboard top 5
	cursor, err := db.MongoDatabase.Collection("users").Find(
		dbCtx,
		bson.M{},
		options.Find().SetSort(bson.D{{"eloRating", -1}}).SetLimit(5),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "message": "Failed to fetch leaderboard"})
		return
	}
	defer cursor.Close(dbCtx)

	type LeaderboardEntry struct {
		Rank        int    `json:"rank"`
		Name        string `json:"name"`
		Score       int    `json:"score"`
		AvatarUrl   string `json:"avatarUrl"`
		CurrentUser bool   `json:"currentUser"`
	}
	var leaderboard []LeaderboardEntry
	rank := 1
	for cursor.Next(dbCtx) {
		var u models.User
		if err := cursor.Decode(&u); err != nil {
			continue
		}
		name := u.DisplayName
		if name == "" {
			name = extractNameFromEmail(u.Email)
		}
		url := u.AvatarURL
		if url == "" {
			url = "https://api.dicebear.com/9.x/adventurer/svg?seed=" + name
		}
		leaderboard = append(leaderboard, LeaderboardEntry{
			Rank:        rank,
			Name:        name,
			Score:       int(u.Rating),
			AvatarUrl:   url,
			CurrentUser: u.Email == email,
		})
		rank++
	}

	// Debate history
	debateCursor, err := db.MongoDatabase.Collection("debates").Find(
		dbCtx,
		bson.M{"email": email},
		options.Find().SetSort(bson.D{{"date", 1}}),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch debates"})
		return
	}
	defer debateCursor.Close(dbCtx)

	type DebateDoc struct {
		Topic        string    `bson:"topic"`
		Result       string    `bson:"result"`
		RatingChange float64   `bson:"eloChange"`
		Rating       float64   `bson:"eloRating"`
		Date         time.Time `bson:"date"`
	}

	var wins, losses, draws int
	var eloHistory []gin.H
	var debateHistory []gin.H

	for debateCursor.Next(dbCtx) {
		var doc DebateDoc
		if err := debateCursor.Decode(&doc); err != nil {
			continue
		}

		eloHistory = append(eloHistory, gin.H{"elo": int(doc.Rating), "date": doc.Date})
		debateHistory = append(debateHistory, gin.H{"topic": doc.Topic, "result": doc.Result, "eloChange": int(doc.RatingChange)})

		switch doc.Result {
		case "win":
			wins++
		case "loss":
			losses++
		case "draw":
			draws++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"profile": gin.H{
			"displayName": displayName,
			"email":       user.Email,
			"bio":         user.Bio,
			"eloRating":   int(user.Rating),
			"twitter":     user.Twitter,
			"instagram":   user.Instagram,
			"linkedin":    user.LinkedIn,
			"avatarUrl":   avatar,
		},
		"leaderboard": leaderboard,
		"stats": gin.H{
			"wins":          wins,
			"losses":        losses,
			"draws":         draws,
			"eloHistory":    eloHistory,
			"debateHistory": debateHistory,
		},
	})
}

func UpdateProfile(ctx *gin.Context) {
	email := ctx.GetString("email")
	if email == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var updateData struct {
		DisplayName string `json:"displayName"`
		Bio         string `json:"bio"`
		Twitter     string `json:"twitter"`
		Instagram   string `json:"instagram"`
		LinkedIn    string `json:"linkedin"`
		AvatarURL   string `json:"avatarUrl"` // Added AvatarURL
	}
	if err := ctx.ShouldBindJSON(&updateData); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid body"})
		return
	}

	update := bson.M{"$set": bson.M{
		"displayName": strings.TrimSpace(updateData.DisplayName),
		"bio":         strings.TrimSpace(updateData.Bio),
		"twitter":     strings.TrimSpace(updateData.Twitter),
		"instagram":   strings.TrimSpace(updateData.Instagram),
		"linkedin":    strings.TrimSpace(updateData.LinkedIn),
		"avatarUrl":   strings.TrimSpace(updateData.AvatarURL), // Added avatarUrl
		"updatedAt":   time.Now(),
	}}

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"email": email}, update)
	if err != nil || result.MatchedCount == 0 {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}

func UpdateEloAfterDebate(ctx *gin.Context) {
	var req struct {
		WinnerID string `json:"winnerId"`
		LoserID  string `json:"loserId"`
		Topic    string `json:"topic"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	winnerID, _ := primitive.ObjectIDFromHex(req.WinnerID)
	loserID, _ := primitive.ObjectIDFromHex(req.LoserID)

	var winner, loser models.User
	_ = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"_id": winnerID}).Decode(&winner)
	_ = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"_id": loserID}).Decode(&loser)

	newWinnerElo, newLoserElo := calculateEloRating(winner.Rating, loser.Rating, 1.0)

	winnerChange := newWinnerElo - winner.Rating
	loserChange := newLoserElo - loser.Rating

	// Update users
	db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"_id": winnerID}, bson.M{"$set": bson.M{"eloRating": newWinnerElo}})
	db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"_id": loserID}, bson.M{"$set": bson.M{"eloRating": newLoserElo}})

	// Log debates
	now := time.Now()
	db.MongoDatabase.Collection("debates").InsertOne(dbCtx, bson.M{
		"email":     winner.Email,
		"topic":     req.Topic,
		"result":    "win",
		"eloChange": winnerChange,
		"eloRating": newWinnerElo,
		"date":      now,
	})
	db.MongoDatabase.Collection("debates").InsertOne(dbCtx, bson.M{
		"email":     loser.Email,
		"topic":     req.Topic,
		"result":    "loss",
		"eloChange": loserChange,
		"eloRating": newLoserElo,
		"date":      now,
	})

	ctx.JSON(http.StatusOK, gin.H{
		"winnerNewElo": int(newWinnerElo),
		"loserNewElo":  int(newLoserElo),
	})
}
