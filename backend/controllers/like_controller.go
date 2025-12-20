package controllers

import (
	"net/http"
	"strings"

	"arguehub/db"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ToggleLikeHandler toggles a like on a post
func ToggleLikeHandler(c *gin.Context) {
	if db.RedisClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Redis not available"})
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

	postID := c.Param("id")
	postObjectID, err := primitive.ObjectIDFromHex(postID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	userID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to get user ID"})
		return
	}

	// Redis key for this post's likes
	key := "post:" + postID + ":likes"
	userKey := "post:" + postID + ":user:" + userID.Hex()

	postCollection := db.MongoDatabase.Collection("debate_posts")
	ctx := c.Request.Context()

	// Check if user already liked using Exists (atomic check)
	exists, err := db.RedisClient.Exists(ctx, userKey).Result()
	alreadyLiked := err == nil && exists > 0

	if alreadyLiked {
		// Unlike - remove user like and decrement count
		// Use DEL to remove the key atomically
		_, err = db.RedisClient.Del(ctx, userKey).Result()
		if err == nil {
			db.RedisClient.ZIncrBy(ctx, key, -1, postID)

			// Update MongoDB like count (decrement)
			postCollection.UpdateOne(ctx, bson.M{"_id": postObjectID}, bson.M{"$inc": bson.M{"likeCount": -1}})
		}

		// Get updated count
		var post struct {
			LikeCount int64 `bson:"likeCount"`
		}
		postCollection.FindOne(ctx, bson.M{"_id": postObjectID}).Decode(&post)

		c.JSON(http.StatusOK, gin.H{
			"liked":   false,
			"count":   post.LikeCount,
			"message": "Unliked",
		})
		return
	}

	// Like - add user like and increment count
	// Use SetNX to ensure atomic operation - only set if not exists
	// This prevents race conditions where multiple requests try to like simultaneously
	set, err := db.RedisClient.SetNX(ctx, userKey, "1", 0).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to like post"})
		return
	}

	// Only increment if we successfully set the key (user hasn't liked before)
	if set {
		db.RedisClient.ZIncrBy(ctx, key, 1, postID)

		// Update MongoDB like count (increment)
		postCollection.UpdateOne(ctx, bson.M{"_id": postObjectID}, bson.M{"$inc": bson.M{"likeCount": 1}})

		// Get updated count
		var post struct {
			LikeCount int64 `bson:"likeCount"`
		}
		postCollection.FindOne(ctx, bson.M{"_id": postObjectID}).Decode(&post)

		c.JSON(http.StatusOK, gin.H{
			"liked":   true,
			"count":   post.LikeCount,
			"message": "Liked",
		})
	} else {
		// Race condition: Another request already liked it between our Exists check and SetNX
		// Get current count and return already liked status
		var post struct {
			LikeCount int64 `bson:"likeCount"`
		}
		postCollection.FindOne(ctx, bson.M{"_id": postObjectID}).Decode(&post)

		c.JSON(http.StatusOK, gin.H{
			"liked":   true,
			"count":   post.LikeCount,
			"message": "Already liked",
		})
	}
}

// GetLikesHandler gets like count and user like status for a post
func GetLikesHandler(c *gin.Context) {
	postID := c.Param("id")
	postObjectID, err := primitive.ObjectIDFromHex(postID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	postCollection := db.MongoDatabase.Collection("debate_posts")
	ctx := c.Request.Context()
	var post struct {
		LikeCount int64 `bson:"likeCount"`
	}
	err = postCollection.FindOne(ctx, bson.M{"_id": postObjectID}).Decode(&post)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	// Check if user is authenticated and liked the post
	liked := false
	token := c.GetHeader("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
		valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
		if err == nil && valid && db.RedisClient != nil {
			userID, err := utils.GetUserIDFromEmail(email)
			if err == nil {
				userKey := "post:" + postID + ":user:" + userID.Hex()
				exists, _ := db.RedisClient.Exists(ctx, userKey).Result()
				liked = exists > 0
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"likes": post.LikeCount,
		"liked": liked,
	})
}
