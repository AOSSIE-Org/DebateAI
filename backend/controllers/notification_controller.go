package controllers

import (
	"context"
	"net/http"
	"strings"

	"arguehub/db"
	"arguehub/models"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// GetNotificationsHandler fetches notifications for the logged-in user
func GetNotificationsHandler(c *gin.Context) {
	token := c.GetHeader("Authorization")
	token = strings.TrimPrefix(token, "Bearer ")

	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	userID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to get user ID"})
		return
	}

	collection := db.GetCollection("notifications")
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
	cursor, err := collection.Find(context.Background(), bson.M{"userId": userID}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notifications"})
		return
	}
	defer cursor.Close(context.Background())

	var notifications []models.Notification
	if err = cursor.All(context.Background(), &notifications); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode notifications"})
		return
	}

	if notifications == nil {
		notifications = []models.Notification{}
	}

	c.JSON(http.StatusOK, notifications)
}

// MarkNotificationAsReadHandler marks a specific notification as read
func MarkNotificationAsReadHandler(c *gin.Context) {
	token := c.GetHeader("Authorization")
	token = strings.TrimPrefix(token, "Bearer ")

	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	userID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to get user ID"})
		return
	}

	notificationID := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(notificationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	collection := db.GetCollection("notifications")
	filter := bson.M{"_id": objID, "userId": userID}
	update := bson.M{"$set": bson.M{"isRead": true}}

	result, err := collection.UpdateOne(context.Background(), filter, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update notification"})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

// MarkAllNotificationsAsReadHandler marks all notifications for the user as read
func MarkAllNotificationsAsReadHandler(c *gin.Context) {
	token := c.GetHeader("Authorization")
	token = strings.TrimPrefix(token, "Bearer ")

	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	userID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to get user ID"})
		return
	}

	collection := db.GetCollection("notifications")
	filter := bson.M{"userId": userID, "isRead": false}
	update := bson.M{"$set": bson.M{"isRead": true}}

	_, err = collection.UpdateMany(context.Background(), filter, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update notifications"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

// DeleteNotificationHandler deletes a specific notification
func DeleteNotificationHandler(c *gin.Context) {
	token := c.GetHeader("Authorization")
	token = strings.TrimPrefix(token, "Bearer ")

	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	userID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to get user ID"})
		return
	}

	notificationID := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(notificationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	collection := db.GetCollection("notifications")
	filter := bson.M{"_id": objID, "userId": userID}

	result, err := collection.DeleteOne(context.Background(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete notification"})
		return
	}

	if result.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification deleted"})
}
