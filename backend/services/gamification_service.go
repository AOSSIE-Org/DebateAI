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

	now := time.Now().UTC()
	newStreak := user.CurrentStreak

	// Daily streak calculation in UTC
	if user.LastActivityDate.IsZero() {
		newStreak = 1
	} else {
		lastActiveUTC := user.LastActivityDate.UTC()
		currentYear, currentMonth, currentDay := now.Date()
		lastYear, lastMonth, lastDay := lastActiveUTC.Date()

		if currentYear != lastYear || currentMonth != lastMonth || currentDay != lastDay {
			yesterday := now.AddDate(0, 0, -1)
			yYear, yMonth, yDay := yesterday.Date()

			if lastYear == yYear && lastMonth == yMonth && lastDay == yDay {
				newStreak++
			} else {
				newStreak = 1
			}
		}
	}
	update := bson.M{
		"$inc": bson.M{"score": pointsToAdd},
		"$set": bson.M{
			"currentStreak":    newStreak,
			"updatedAt":        now,
			"lastActivityDate": now,
		},
	}

	if _, err := userCollection.UpdateOne(ctx, bson.M{"_id": userID}, update); err != nil {
		log.Printf("Error updating user score and streak for user %s: %v", userID.Hex(), err)
		return
	}

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
	if _, err := scoreCollection.InsertOne(ctx, scoreUpdate); err != nil {
		log.Printf("Error saving score update record for user %s: %v", userID.Hex(), err)
	}

	newScore := user.Score + pointsToAdd
	hasBadge := make(map[string]bool)
	for _, badge := range user.Badges {
		hasBadge[badge] = true
	}

	if newScore >= 10 && !hasBadge["Novice"] {
		if _, err := userCollection.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$addToSet": bson.M{"badges": "Novice"}}); err != nil {
			log.Printf("Error awarding Novice badge to user %s: %v", userID.Hex(), err)
		}
	}

	if newStreak >= 5 && !hasBadge["Streak5"] {
		if _, err := userCollection.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$addToSet": bson.M{"badges": "Streak5"}}); err != nil {
			log.Printf("Error awarding Streak5 badge to user %s: %v", userID.Hex(), err)
		}
	}

	if resultStatus == "win" && !hasBadge["FirstWin"] {
		if _, err := userCollection.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$addToSet": bson.M{"badges": "FirstWin"}}); err != nil {
			log.Printf("Error awarding FirstWin badge to user %s: %v", userID.Hex(), err)
		}
	}
}