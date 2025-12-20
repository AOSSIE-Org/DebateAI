package controllers

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type transcriptPreview struct {
	Messages    []models.Message  `json:"messages"`
	Transcripts map[string]string `json:"transcripts,omitempty"`
}

type postWithTranscript struct {
	models.DebatePost `json:",inline"`
	Transcript        *transcriptPreview `json:"transcript,omitempty"`
	IsOwnPost         bool               `json:"isOwnPost,omitempty"`
}

// CreatePostHandler creates a new post from a saved transcript
func CreatePostHandler(c *gin.Context) {
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

	var req struct {
		TranscriptID string `json:"transcriptId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Get user ID
	userID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to get user ID"})
		return
	}

	// Convert transcript ID
	transcriptObjectID, err := primitive.ObjectIDFromHex(req.TranscriptID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transcript ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Fetch the transcript
	transcriptCollection := db.MongoDatabase.Collection("saved_debate_transcripts")
	var transcript models.SavedDebateTranscript
	err = transcriptCollection.FindOne(ctx, bson.M{"_id": transcriptObjectID, "userId": userID}).Decode(&transcript)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transcript not found"})
		return
	}

	// Get user details
	userCollection := db.MongoDatabase.Collection("users")
	var user models.User
	err = userCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user"})
		return
	}

	// Check if post already exists for this transcript
	postCollection := db.MongoDatabase.Collection("debate_posts")
	var existingPost models.DebatePost
	err = postCollection.FindOne(ctx, bson.M{"transcriptId": transcriptObjectID}).Decode(&existingPost)
	if err == nil {
		c.JSON(http.StatusOK, gin.H{"post": existingPost, "message": "Post already exists"})
		return
	}
	if err != mongo.ErrNoDocuments {
		log.Printf("Failed to check existing post: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create post"})
		return
	}

	// Create the post
	now := time.Now()
	post := models.DebatePost{
		ID:           primitive.NewObjectID(),
		TranscriptID: transcriptObjectID,
		UserID:       userID,
		Email:        email,
		DisplayName:  user.DisplayName,
		AvatarURL:    user.AvatarURL,
		Topic:        transcript.Topic,
		DebateType:   transcript.DebateType,
		Opponent:     transcript.Opponent,
		Result:       transcript.Result,
		IsPublic:     true,
		LikeCount:    0,
		CommentCount: 0,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	result, err := postCollection.InsertOne(ctx, post)
	if err != nil {
		log.Printf("Failed to create post: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create post"})
		return
	}

	log.Printf("Post created successfully with ID: %v", result.InsertedID)
	c.JSON(http.StatusCreated, gin.H{"post": post, "message": "Post created successfully"})
}

// GetFeedHandler returns paginated posts for the feed
func GetFeedHandler(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if limit < 1 {
		limit = 20
	}
	if page < 1 {
		page = 1
	}

	skip := (page - 1) * limit

	var currentUserID primitive.ObjectID
	hasCurrentUser := false
	token := c.GetHeader("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
		valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
		if err == nil && valid {
			if userID, err := utils.GetUserIDFromEmail(email); err == nil {
				currentUserID = userID
				hasCurrentUser = true
			}
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	postCollection := db.MongoDatabase.Collection("debate_posts")

	// Count total posts
	total, err := postCollection.CountDocuments(ctx, bson.M{"isPublic": true})
	if err != nil {
		log.Printf("Failed to count posts: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}
	log.Printf("Total public posts: %d", total)

	// Fetch posts with pagination
	findOptions := options.Find().
		SetSort(bson.D{{"createdAt", -1}}).
		SetLimit(int64(limit)).
		SetSkip(int64(skip))

	cursor, err := postCollection.Find(ctx, bson.M{"isPublic": true}, findOptions)
	if err != nil {
		log.Printf("Failed to fetch posts: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}
	defer cursor.Close(ctx)

	var posts []models.DebatePost
	if err = cursor.All(ctx, &posts); err != nil {
		log.Printf("Failed to decode posts: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode posts"})
		return
	}

	transcriptCollection := db.MongoDatabase.Collection("saved_debate_transcripts")
	transcriptCache := make(map[primitive.ObjectID]*models.SavedDebateTranscript)

	postResponses := make([]postWithTranscript, 0, len(posts))
	for _, post := range posts {
		response := postWithTranscript{
			DebatePost: post,
			IsOwnPost:  hasCurrentUser && post.UserID == currentUserID,
		}

		if cached, ok := transcriptCache[post.TranscriptID]; ok {
			if cached != nil {
				response.Transcript = &transcriptPreview{
					Messages:    cached.Messages,
					Transcripts: cached.Transcripts,
				}
			}
		} else {
			log.Printf("Fetching transcript %s for post %s", post.TranscriptID.Hex(), post.ID.Hex())
			var transcript models.SavedDebateTranscript
			err := transcriptCollection.FindOne(ctx, bson.M{"_id": post.TranscriptID}).Decode(&transcript)
			if err != nil {
				if err == mongo.ErrNoDocuments {
					log.Printf("Transcript %s not found for post %s", post.TranscriptID.Hex(), post.ID.Hex())
				} else {
					log.Printf("Failed to fetch transcript %s for post %s: %v", post.TranscriptID.Hex(), post.ID.Hex(), err)
				}
				transcriptCache[post.TranscriptID] = nil
			} else {
				log.Printf("Loaded transcript %s for post %s: messages=%d transcripts=%d",
					transcript.ID.Hex(),
					post.ID.Hex(),
					len(transcript.Messages),
					len(transcript.Transcripts))
				transcriptCache[post.TranscriptID] = &transcript
				response.Transcript = &transcriptPreview{
					Messages:    transcript.Messages,
					Transcripts: transcript.Transcripts,
				}
			}
		}
		postResponses = append(postResponses, response)
	}

	log.Printf("Fetched %d posts for feed (page %d, limit %d)", len(posts), page, limit)
	c.JSON(http.StatusOK, gin.H{
		"posts": postResponses,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetPostHandler retrieves a single post by ID
func GetPostHandler(c *gin.Context) {
	postID := c.Param("id")
	postObjectID, err := primitive.ObjectIDFromHex(postID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	postCollection := db.MongoDatabase.Collection("debate_posts")
	var post models.DebatePost
	err = postCollection.FindOne(ctx, bson.M{"_id": postObjectID}).Decode(&post)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"post": post})
}

// DeletePostHandler deletes a post
func DeletePostHandler(c *gin.Context) {
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

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	postCollection := db.MongoDatabase.Collection("debate_posts")
	var post models.DebatePost
	err = postCollection.FindOne(ctx, bson.M{"_id": postObjectID, "userId": userID}).Decode(&post)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusForbidden, gin.H{"error": "Post not found or you don't have permission"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch post"})
		return
	}

	result, err := postCollection.DeleteOne(ctx, bson.M{"_id": postObjectID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete post"})
		return
	}

	if result.DeletedCount == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Post not found or you don't have permission"})
		return
	}

	// Delete related comments tied to the post's transcript
	commentsCollection := db.MongoDatabase.Collection("comments")
	if _, err := commentsCollection.DeleteMany(ctx, bson.M{"transcriptId": post.TranscriptID}); err != nil {
		log.Printf("Failed to delete comments for transcript %s: %v", post.TranscriptID.Hex(), err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Post deleted, but failed to delete associated comments"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Post deleted successfully"})
}

// GetTopLikedPostsHandler returns top liked posts
func GetTopLikedPostsHandler(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit < 1 {
		limit = 10
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	postCollection := db.MongoDatabase.Collection("debate_posts")

	findOptions := options.Find().
		SetSort(bson.D{{"likeCount", -1}}).
		SetLimit(int64(limit))

	cursor, err := postCollection.Find(ctx, bson.M{"isPublic": true}, findOptions)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}
	defer cursor.Close(ctx)

	var posts []models.DebatePost
	if err = cursor.All(ctx, &posts); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode posts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"posts": posts})
}
