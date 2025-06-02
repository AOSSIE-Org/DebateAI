package controllers

import (
	"context"
	"net/http"
	"time"

	"arguehub/db"
	"arguehub/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// calculateEloRating computes new Elo ratings after a match
func calculateEloRating(ratingA, ratingB int, scoreA float64) (newRatingA, newRatingB int) {
	const K = 32
	expectedA := 1.0 / (1.0 + pow(10, float64(ratingB-ratingA)/400.0))
	scoreB := 1.0 - scoreA
	expectedB := 1.0 - expectedA

	newRatingA = ratingA + int(float64(K)*(scoreA-expectedA))
	newRatingB = ratingB + int(float64(K)*(scoreB-expectedB))
	return newRatingA, newRatingB
}

// pow computes base^exponent as a simple helper
func pow(base, exponent float64) float64 {
	result := 1.0
	for i := 0; i < int(exponent); i++ {
		result *= base
	}
	return result
}

// GetProfile retrieves and returns user profile data
func GetProfile(ctx *gin.Context) {
	email := ctx.GetString("email")

	if email == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Fetch user profile
	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		} else {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		}
		return
	}

	// Set avatar URL with DiceBear fallback
	profileAvatarURL := user.AvatarURL
	if profileAvatarURL == "" {
		profileName := user.DisplayName
		if profileName == "" {
			profileName = extractNameFromEmail(email)
		}
		profileAvatarURL = "https://api.dicebear.com/9.x/adventurer/svg?seed=" + profileName
	}

	// Fetch leaderboard
	leaderboardCursor, err := db.MongoDatabase.Collection("users").Find(
		dbCtx,
		bson.M{},
		options.Find().SetSort(bson.M{"eloRating": -1}).SetLimit(10),
	)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching leaderboard"})
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
		leaderboardCursor.Decode(&lbUser)
		lbAvatarURL := lbUser.AvatarURL
		if lbAvatarURL == "" {
			lbName := lbUser.DisplayName
			if lbName == "" {
				lbName = extractNameFromEmail(lbUser.Email)
			}
			lbAvatarURL = "https://api.dicebear.com/9.x/adventurer/svg?seed=" + lbName
		}
		leaderboard = append(leaderboard, struct {
			Rank        int    `json:"rank"`
			Name        string `json:"name"`
			Score       int    `json:"score"`
			AvatarUrl   string `json:"avatarUrl"`
			CurrentUser bool   `json:"currentUser"`
		}{rank, lbUser.DisplayName, lbUser.EloRating, lbAvatarURL, lbUser.Email == email})
		rank++
	}

	// Fetch debate history
	debateCursor, err := db.MongoDatabase.Collection("debates").Find(
		dbCtx,
		bson.M{"email": email},
		options.Find().SetSort(bson.M{"date": -1}).SetLimit(5),
	)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching debate history"})
		return
	}
	defer debateCursor.Close(dbCtx)

	var debates []struct {
		Topic     string    `bson:"topic" json:"topic"`
		Result    string    `bson:"result" json:"result"`
		EloChange int       `bson:"eloChange" json:"eloChange"`
		Date      time.Time `bson:"date" json:"date"`
	}
	if err := debateCursor.All(dbCtx, &debates); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error decoding debate history"})
		return
	}

	// Aggregate stats (wins, losses, draws)
	pipeline := mongo.Pipeline{
		bson.D{{"$match", bson.M{"email": email}}},
		bson.D{{"$group", bson.M{
			"_id":    nil,
			"wins":   bson.M{"$sum": bson.M{"$cond": bson.M{"if": bson.M{"$eq": []string{"$result", "win"}}, "then": 1, "else": 0}}},
			"losses": bson.M{"$sum": bson.M{"$cond": bson.M{"if": bson.M{"$eq": []string{"$result", "loss"}}, "then": 1, "else": 0}}},
			"draws":  bson.M{"$sum": bson.M{"$cond": bson.M{"if": bson.M{"$eq": []string{"$result", "draw"}}, "then": 1, "else": 0}}},
		}}},
	}
	statsCursor, err := db.MongoDatabase.Collection("debates").Aggregate(dbCtx, pipeline)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error aggregating stats"})
		return
	}
	defer statsCursor.Close(dbCtx)

	var stats struct {
		Wins   int `json:"wins"`
		Losses int `json:"losses"`
		Draws  int `json:"draws"`
	}
	if statsCursor.Next(dbCtx) {
		statsCursor.Decode(&stats)
	}

	// Build Elo history
	eloCursor, err := db.MongoDatabase.Collection("debates").Find(
		dbCtx,
		bson.M{"email": email},
		options.Find().SetSort(bson.M{"date": 1}),
	)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching Elo history"})
		return
	}
	defer eloCursor.Close(dbCtx)

	var eloHistory []struct {
		Month string `json:"month"`
		Elo   int    `json:"elo"`
	}
	currentElo := user.EloRating
	for eloCursor.Next(dbCtx) {
		var debate struct {
			Date      time.Time `bson:"date"`
			EloChange int       `bson:"eloChange"`
		}
		eloCursor.Decode(&debate)
		currentElo -= debate.EloChange
		eloHistory = append([]struct {
			Month string `json:"month"`
			Elo   int    `json:"elo"`
		}{{debate.Date.Format("January"), currentElo}}, eloHistory...)
	}
	eloHistory = append(eloHistory, struct {
		Month string `json:"month"`
		Elo   int    `json:"elo"`
	}{time.Now().Format("January"), user.EloRating})

	// Construct response
	response := gin.H{
		"profile": gin.H{
			"displayName": user.DisplayName,
			"email":       user.Email,
			"bio":         user.Bio,
			"eloRating":   user.EloRating,
			"avatarUrl":   profileAvatarURL,
		},
		"leaderboard":   leaderboard,
		"debateHistory": debates,
		"stats": gin.H{
			"wins":       stats.Wins,
			"losses":     stats.Losses,
			"draws":      stats.Draws,
			"eloHistory": eloHistory,
		},
	}
	ctx.JSON(http.StatusOK, response)
}

// UpdateProfile modifies user display name and bio
func UpdateProfile(ctx *gin.Context) {
	email := ctx.GetString("email")
	if email == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized", "message": "Missing user email in context"})
		return
	}

	var updateData struct {
		DisplayName string `json:"displayName"`
		Bio         string `json:"bio"`
	}
	if err := ctx.ShouldBindJSON(&updateData); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "message": err.Error()})
		return
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"email": email}
	update := bson.M{"$set": bson.M{
		"displayName": updateData.DisplayName,
		"bio":         updateData.Bio,
	}}
	_, err := db.MongoDatabase.Collection("users").UpdateOne(dbCtx, filter, update)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
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
