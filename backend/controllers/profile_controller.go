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

	// Fix users with 0 rating by setting them to default rating
	if user.Rating == 0 {
		user.Rating = 1200.0
		user.LastRatingUpdate = time.Now()
		_, err = db.MongoDatabase.Collection("users").UpdateOne(
			dbCtx,
			bson.M{"_id": user.ID},
			bson.M{"$set": bson.M{
				"rating":           user.Rating,
				"lastRatingUpdate": user.LastRatingUpdate,
			}},
		)
		if err != nil {
			fmt.Printf("Failed to update user rating: %v", err)
		} else {
			fmt.Printf("Updated user %s rating from 0 to 1200", email)
		}
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
		options.Find().SetSort(bson.D{{"rating", -1}}).SetLimit(5),
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

	// Get user ID for transcript queries
	userID := user.ID

	// Fetch debate statistics from saved transcripts
	transcriptCursor, err := db.MongoDatabase.Collection("saved_debate_transcripts").Find(
		dbCtx,
		bson.M{"userId": userID},
		options.Find().SetSort(bson.D{{"createdAt", -1}}), // Most recent first
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch debate transcripts"})
		return
	}
	defer transcriptCursor.Close(dbCtx)

	var wins, losses, draws int
	var eloHistory []gin.H
	var debateHistory []gin.H
	var recentDebates []gin.H

	for transcriptCursor.Next(dbCtx) {
		var transcript models.SavedDebateTranscript
		if err := transcriptCursor.Decode(&transcript); err != nil {
			continue
		}

		// Add to recent debates (last 10)
		if len(recentDebates) < 10 {
			recentDebates = append(recentDebates, gin.H{
				"id":          transcript.ID.Hex(),
				"topic":       transcript.Topic,
				"result":      transcript.Result,
				"opponent":    transcript.Opponent,
				"debateType":  transcript.DebateType,
				"date":        transcript.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
				"eloChange":   0, // TODO: Add actual Elo change tracking
			})
		}

		// Add to Elo history (for chart)
		eloHistory = append(eloHistory, gin.H{"elo": int(user.Rating), "date": transcript.CreatedAt.Format("2006-01-02T15:04:05Z07:00")})

		// Count results
		switch transcript.Result {
		case "win":
			wins++
		case "loss":
			losses++
		case "draw":
			draws++
		}
	}

	// Calculate win rate
	winRate := 0.0
	totalDebates := wins + losses + draws
	if totalDebates > 0 {
		winRate = float64(wins) / float64(totalDebates) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"profile": gin.H{
			"id":          user.ID.Hex(),
			"displayName": displayName,
			"email":       user.Email,
			"bio":         user.Bio,
			"rating":   int(user.Rating),
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
			"winRate":       winRate,
			"totalDebates":  totalDebates,
			"eloHistory":    eloHistory,
			"debateHistory": debateHistory,
			"recentDebates": recentDebates,
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
	db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"_id": winnerID}, bson.M{"$set": bson.M{"rating": newWinnerElo}})
	db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"_id": loserID}, bson.M{"$set": bson.M{"rating": newLoserElo}})

	// Log debates
	now := time.Now()
	db.MongoDatabase.Collection("debates").InsertOne(dbCtx, bson.M{
		"email":     winner.Email,
		"topic":     req.Topic,
		"result":    "win",
		"eloChange": winnerChange,
		"rating": newWinnerElo,
		"date":      now,
	})
	db.MongoDatabase.Collection("debates").InsertOne(dbCtx, bson.M{
		"email":     loser.Email,
		"topic":     req.Topic,
		"result":    "loss",
		"eloChange": loserChange,
		"rating": newLoserElo,
		"date":      now,
	})

	ctx.JSON(http.StatusOK, gin.H{
		"winnerNewElo": int(newWinnerElo),
		"loserNewElo":  int(newLoserElo),
	})
}
