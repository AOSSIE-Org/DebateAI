package services

import (
	"context"
	"log"
	"time"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// UpdateGamificationForUser updates score, streak, badges and persists progression to the database.
func UpdateGamificationForUser(userID primitive.ObjectID, resultStatus, topic, debateType string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Panic recovered in UpdateGamificationForUser: %v", r)
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if db.MongoDatabase == nil {
		log.Printf("ERROR: MongoDatabase is nil! Cannot update gamification.")
		return
	}

	userCollection := db.MongoDatabase.Collection("users")

	var user models.User
	err := userCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		log.Printf("ERROR: Failed to get user for gamification update: %v (userID: %s)", err, userID.Hex())
		return
	}

	if user.Score < 0 {
		user.Score = 0
	}

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
		pointsToAdd = 10
		action = "debate_complete"
	}

	now := time.Now()
	update := bson.M{
		"$inc": bson.M{
			"score":         pointsToAdd,
			"currentStreak": 1,
		},
		"$set": bson.M{
			"updatedAt":        now,
			"lastActivityDate": now,
		},
	}

	_, err = userCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		log.Printf("Error updating score for user %s: %v", userID.Hex(), err)
		return
	}

	// Score update record
	scoreCollection := db.MongoDatabase.Collection("score_updates")
	scoreUpdate := models.ScoreUpdate{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		Points:    pointsToAdd,
		Action:    action,
		CreatedAt: now,
		Metadata: map[string]interface{}{
			"debateType": debateType,
			"topic":      topic,
			"result":     resultStatus,
		},
	}
	_, _ = scoreCollection.InsertOne(ctx, scoreUpdate)

	// Updated state evaluation for badges
	newScore := user.Score + pointsToAdd
	newStreak := user.CurrentStreak + 1

	hasBadge := make(map[string]bool)
	for _, badge := range user.Badges {
		hasBadge[badge] = true
	}

	// Novice badge check
	if newScore >= 10 && !hasBadge["Novice"] {
		_, _ = userCollection.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$addToSet": bson.M{"badges": "Novice"}})
	}

	// Streak5 badge check
	if newStreak >= 5 && !hasBadge["Streak5"] {
		_, _ = userCollection.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$addToSet": bson.M{"badges": "Streak5"}})
	}

	// FirstWin badge check
	if resultStatus == "win" && !hasBadge["FirstWin"] {
		_, _ = userCollection.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$addToSet": bson.M{"badges": "FirstWin"}})
	}
}