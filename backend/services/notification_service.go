package services

import (
	"context"
	"time"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CreateNotification creates a new notification for a user
func CreateNotification(userID primitive.ObjectID, notifType models.NotificationType, title, message, link string) error {
	notification := models.Notification{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		Type:      notifType,
		Title:     title,
		Message:   message,
		Link:      link,
		IsRead:    false,
		CreatedAt: time.Now(),
	}

	collection := db.GetCollection("notifications")
	_, err := collection.InsertOne(context.Background(), notification)
	return err
}
