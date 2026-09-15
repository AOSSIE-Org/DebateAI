package controllers

import (
	"context"
	"time"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// updateStreakAndActivity recalculates the user's daily streak and last-activity
// timestamp on activity completion, persists it, and mutates the passed user so
// callers see the fresh streak immediately (e.g. for the Streak5 badge check).
func updateStreakAndActivity(ctx context.Context, userID primitive.ObjectID, user *models.User) {
	now := time.Now()
	newStreak := 1

	if !user.LastActivityDate.IsZero() {
		last := user.LastActivityDate
		lastDay := time.Date(last.Year(), last.Month(), last.Day(), 0, 0, 0, 0, last.Location())
		today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		daysApart := int(today.Sub(lastDay).Hours() / 24)

		switch daysApart {
		case 0:
			newStreak = user.CurrentStreak // already counted today
		case 1:
			newStreak = user.CurrentStreak + 1 // consecutive day
		default:
			newStreak = 1 // missed a day → reset
		}
	}

	user.CurrentStreak = newStreak
	user.LastActivityDate = now

	db.MongoDatabase.Collection("users").UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{"$set": bson.M{"currentStreak": newStreak, "lastActivityDate": now}},
	)
}
