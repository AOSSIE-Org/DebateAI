package controllers

import (
	"context"
	"fmt"
	"time"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// updateStreakAndActivity recalculates the user's daily streak and last-activity
// timestamp on verified activity completion, persists it, and — only if the write
// succeeds — mutates the passed user so callers see the fresh streak for badge checks.
// Calendar days are compared in UTC to avoid DST duration skew.
func updateStreakAndActivity(ctx context.Context, userID primitive.ObjectID, user *models.User) error {
	now := time.Now().UTC()
	newStreak := 1

	if !user.LastActivityDate.IsZero() {
		lastDay := user.LastActivityDate.UTC().Truncate(24 * time.Hour)
		today := now.Truncate(24 * time.Hour)
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

	res, err := db.MongoDatabase.Collection("users").UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{"$set": bson.M{"currentStreak": newStreak, "lastActivityDate": now}},
	)
	if err != nil {
		return fmt.Errorf("failed to persist streak/activity: %w", err)
	}
	if res.MatchedCount == 0 {
		return fmt.Errorf("failed to persist streak/activity: user %s not found", userID.Hex())
	}

	// only mutate in-memory user after a successful, matched write
	user.CurrentStreak = newStreak
	user.LastActivityDate = now
	return nil
}
