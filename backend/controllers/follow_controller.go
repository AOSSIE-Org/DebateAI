package controllers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// FollowUserHandler follows a user
func FollowUserHandler(c *gin.Context) {
	if db.RedisClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Redis not available for rate limiting"})
		return
	}

	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	followerID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to get user ID"})
		return
	}

	userIDParam := c.Param("userId")
	followingID, err := primitive.ObjectIDFromHex(userIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if followerID == followingID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot follow yourself"})
		return
	}

	// Rate limiting (5 seconds)
	rateKey := "follow:rate:" + followerID.Hex()
	exists, _ := db.RedisClient.Exists(c, rateKey).Result()
	if exists > 0 {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Please wait 5 seconds before following again"})
		return
	}
	db.RedisClient.Set(c, rateKey, "1", 5*time.Second)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	followCollection := db.MongoDatabase.Collection("user_follows")

	// Check if already following
	var existing models.UserFollow
	err = followCollection.FindOne(ctx, bson.M{"followerId": followerID, "followingId": followingID}).Decode(&existing)
	if err == nil {
		c.JSON(http.StatusOK, gin.H{"message": "Already following"})
		return
	}

	follow := models.UserFollow{
		ID:          primitive.NewObjectID(),
		FollowerID:  followerID,
		FollowingID: followingID,
		CreatedAt:   time.Now(),
	}

	_, err = followCollection.InsertOne(ctx, follow)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to follow user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User followed successfully"})
}

// UnfollowUserHandler unfollows a user
func UnfollowUserHandler(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
		return
	}

	token = strings.TrimPrefix(token, "Bearer ")
	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	followerID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to get user ID"})
		return
	}

	userIDParam := c.Param("userId")
	followingID, err := primitive.ObjectIDFromHex(userIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	followCollection := db.MongoDatabase.Collection("user_follows")
	result, err := followCollection.DeleteOne(ctx, bson.M{"followerId": followerID, "followingId": followingID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unfollow user"})
		return
	}

	if result.DeletedCount == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "Not following this user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User unfollowed successfully"})
}

// GetFollowersHandler gets followers of a user
func GetFollowersHandler(c *gin.Context) {
	userIDParam := c.Param("userId")
	userID, err := primitive.ObjectIDFromHex(userIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	followCollection := db.MongoDatabase.Collection("user_follows")
	cursor, err := followCollection.Find(ctx, bson.M{"followingId": userID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch followers"})
		return
	}
	defer cursor.Close(ctx)

	var follows []models.UserFollow
	if err := cursor.All(ctx, &follows); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch followers"})
		return
	}

	var followerIDs []primitive.ObjectID
	for _, f := range follows {
		followerIDs = append(followerIDs, f.FollowerID)
	}

	var users []models.User
	if len(followerIDs) > 0 {
		userCollection := db.MongoDatabase.Collection("users")
		detailsCursor, err := userCollection.Find(ctx, bson.M{"_id": bson.M{"$in": followerIDs}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load follower details"})
			return
		}
		defer detailsCursor.Close(ctx)
		if err := detailsCursor.All(ctx, &users); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load follower details"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"followers": users})
}

// GetFollowingHandler gets users that a user is following
func GetFollowingHandler(c *gin.Context) {
	userIDParam := c.Param("userId")
	userID, err := primitive.ObjectIDFromHex(userIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	followCollection := db.MongoDatabase.Collection("user_follows")
	cursor, err := followCollection.Find(ctx, bson.M{"followerId": userID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch following"})
		return
	}
	defer cursor.Close(ctx)

	var follows []models.UserFollow
	if err := cursor.All(ctx, &follows); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch following"})
		return
	}

	var followingIDs []primitive.ObjectID
	for _, f := range follows {
		followingIDs = append(followingIDs, f.FollowingID)
	}

	var users []models.User
	if len(followingIDs) > 0 {
		userCollection := db.MongoDatabase.Collection("users")
		detailsCursor, err := userCollection.Find(ctx, bson.M{"_id": bson.M{"$in": followingIDs}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load following details"})
			return
		}
		defer detailsCursor.Close(ctx)
		if err := detailsCursor.All(ctx, &users); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load following details"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"following": users})
}
