package controllers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CreateCommentHandler creates a new comment
func CreateCommentHandler(c *gin.Context) {
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
		TranscriptID string  `json:"transcriptId" binding:"required"`
		ParentID     *string `json:"parentId,omitempty"`
		Content      string  `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	userID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to get user ID"})
		return
	}

	transcriptObjectID, err := primitive.ObjectIDFromHex(req.TranscriptID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transcript ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Get user details
	var user models.User
	err = db.MongoDatabase.Collection("users").FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user"})
		return
	}

	now := time.Now()
	comment := models.Comment{
		ID:           primitive.NewObjectID(),
		TranscriptID: transcriptObjectID,
		UserID:       userID,
		Email:        email,
		DisplayName:  user.DisplayName,
		AvatarURL:    user.AvatarURL,
		Content:      req.Content,
		Path:         []string{},
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if req.ParentID != nil && *req.ParentID != "" {
		parentObjectID, err := primitive.ObjectIDFromHex(*req.ParentID)
		if err == nil {
			comment.ParentID = &parentObjectID
			// Get parent comment to build path
			var parent models.Comment
			if err := db.MongoDatabase.Collection("comments").FindOne(ctx, bson.M{"_id": parentObjectID}).Decode(&parent); err == nil {
				comment.Path = append(parent.Path, parentObjectID.Hex())
			}
		}
	}

	_, err = db.MongoDatabase.Collection("comments").InsertOne(ctx, comment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create comment"})
		return
	}

	// Notify the owner of the transcript or parent comment
	go func() {
		if req.ParentID != nil && *req.ParentID != "" {
			// Notify parent comment author
			var parent models.Comment
			if err := db.MongoDatabase.Collection("comments").FindOne(context.Background(), bson.M{"_id": comment.ParentID}).Decode(&parent); err == nil {
				if parent.UserID != userID {
					services.CreateNotification(
						parent.UserID,
						models.NotificationTypeComment,
						"New Reply",
						user.DisplayName+" replied to your comment",
						"/debate/"+req.TranscriptID,
					)
				}
			}
		} else {
			// Notify transcript owner
			var transcript models.SavedDebateTranscript
			if err := db.MongoDatabase.Collection("saved_debate_transcripts").FindOne(context.Background(), bson.M{"_id": transcriptObjectID}).Decode(&transcript); err == nil {
				if transcript.UserID != userID {
					// Check if it's a post to customize the message
					var post models.DebatePost
					isPost := false
					if err := db.MongoDatabase.Collection("debate_posts").FindOne(context.Background(), bson.M{"transcriptId": transcriptObjectID}).Decode(&post); err == nil {
						isPost = true
					}

					msg := "commented on your debate"
					if isPost {
						msg = "commented on your post"
					}

					services.CreateNotification(
						transcript.UserID,
						models.NotificationTypeComment,
						"New Comment",
						user.DisplayName+" "+msg,
						"/view-debate/"+req.TranscriptID,
					)
				}
			}
		}
	}()

	// Update comment count
	db.MongoDatabase.Collection("debate_posts").UpdateOne(ctx,
		bson.M{"transcriptId": transcriptObjectID},
		bson.M{"$inc": bson.M{"commentCount": 1}},
	)

	c.JSON(http.StatusCreated, gin.H{"comment": comment})
}

// GetCommentsHandler gets all comments for a transcript
func GetCommentsHandler(c *gin.Context) {
	transcriptID := c.Param("transcriptId")
	transcriptObjectID, err := primitive.ObjectIDFromHex(transcriptID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transcript ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := db.MongoDatabase.Collection("comments").Find(ctx, bson.M{"transcriptId": transcriptObjectID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comments"})
		return
	}
	defer cursor.Close(ctx)

	var comments []models.Comment
	if err := cursor.All(ctx, &comments); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode comments"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"comments": comments})
}

// DeleteCommentHandler deletes a comment
func DeleteCommentHandler(c *gin.Context) {
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

	commentID := c.Param("id")
	commentObjectID, err := primitive.ObjectIDFromHex(commentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	userID, err := utils.GetUserIDFromEmail(email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to get user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := db.MongoDatabase.Collection("comments").DeleteOne(ctx, bson.M{"_id": commentObjectID, "userId": userID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
		return
	}

	if result.DeletedCount == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Comment not found or you don't have permission"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Comment deleted successfully"})
}
