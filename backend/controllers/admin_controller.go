package controllers

import (
	"arguehub/db"
	"arguehub/middlewares"
	"arguehub/models"
	"context"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

// AdminSignupRequest represents the signup request
type AdminSignupRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Role     string `json:"role" binding:"required"` // "admin" or "moderator"
}

// AdminLoginRequest represents the login request
type AdminLoginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// AdminSignup handles admin/moderator signup
func AdminSignup(ctx *gin.Context) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return
	}

	var request AdminSignupRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}

	// Validate role
	if request.Role != "admin" && request.Role != "moderator" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Must be 'admin' or 'moderator'"})
		return
	}

	// Check if admin already exists
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existingAdmin models.Admin
	err := db.MongoDatabase.Collection("admins").FindOne(dbCtx, bson.M{"email": request.Email}).Decode(&existingAdmin)
	if err == nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Admin already exists"})
		return
	}
	if err != mongo.ErrNoDocuments {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "message": err.Error()})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password", "message": err.Error()})
		return
	}

	// Create new admin
	now := time.Now()
	newAdmin := models.Admin{
		Email:     request.Email,
		Password:  string(hashedPassword),
		Role:      request.Role,
		Name:      request.Name,
		CreatedAt: now,
		UpdatedAt: now,
	}

	result, err := db.MongoDatabase.Collection("admins").InsertOne(dbCtx, newAdmin)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create admin", "message": err.Error()})
		return
	}
	newAdmin.ID = result.InsertedID.(primitive.ObjectID)

	// Generate JWT
	token, err := generateJWT(newAdmin.Email, cfg.JWT.Secret, cfg.JWT.Expiry)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token", "message": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":     "Admin signup successful",
		"accessToken": token,
		"admin": gin.H{
			"id":    newAdmin.ID.Hex(),
			"email": newAdmin.Email,
			"name":  newAdmin.Name,
			"role":  newAdmin.Role,
		},
	})
}

// AdminLogin handles admin/moderator login
func AdminLogin(ctx *gin.Context) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return
	}

	var request AdminLoginRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}

	// Find admin in MongoDB
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var admin models.Admin
	err := db.MongoDatabase.Collection("admins").FindOne(dbCtx, bson.M{"email": request.Email}).Decode(&admin)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "message": err.Error()})
		return
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(request.Password))
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Generate JWT
	token, err := generateJWT(admin.Email, cfg.JWT.Secret, cfg.JWT.Expiry)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token", "message": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":     "Admin login successful",
		"accessToken": token,
		"admin": gin.H{
			"id":    admin.ID.Hex(),
			"email": admin.Email,
			"name":  admin.Name,
			"role":  admin.Role,
		},
	})
}

// GetDebates fetches all debates with pagination
func GetDebates(ctx *gin.Context) {
	page := 1
	limit := 20

	if pageStr := ctx.Query("page"); pageStr != "" {
		fmt.Sscanf(pageStr, "%d", &page)
	}
	if limitStr := ctx.Query("limit"); limitStr != "" {
		fmt.Sscanf(limitStr, "%d", &limit)
	}

	skip := (page - 1) * limit

	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get debates from debates collection
	collection := db.MongoDatabase.Collection("debates")

	opts := options.Find().SetSkip(int64(skip)).SetLimit(int64(limit)).SetSort(bson.M{"date": -1})
	cursor, err := collection.Find(dbCtx, bson.M{}, opts)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch debates", "message": err.Error()})
		return
	}
	defer cursor.Close(dbCtx)

	var debates []models.Debate
	if err := cursor.All(dbCtx, &debates); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode debates", "message": err.Error()})
		return
	}

	// Sanitize any NaN or Inf values to avoid JSON encoding errors
	for i := range debates {
		debates[i].PreRating = sanitizeFloat64(debates[i].PreRating)
		debates[i].PreRD = sanitizeFloat64(debates[i].PreRD)
		debates[i].PostRating = sanitizeFloat64(debates[i].PostRating)
		debates[i].PostRD = sanitizeFloat64(debates[i].PostRD)
		debates[i].RatingChange = sanitizeFloat64(debates[i].RatingChange)
		debates[i].RDChange = sanitizeFloat64(debates[i].RDChange)
	}

	// Get total count
	total, err := collection.CountDocuments(dbCtx, bson.M{})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count debates", "message": err.Error()})
		return
	}

	// Also get debates from debates_vs_bot collection
	botCollection := db.MongoDatabase.Collection("debates_vs_bot")
	botCursor, err := botCollection.Find(dbCtx, bson.M{}, options.Find().SetSkip(int64(skip)).SetLimit(int64(limit)).SetSort(bson.M{"createdAt": -1}))
	if err == nil {
		defer botCursor.Close(dbCtx)
		var botDebates []models.DebateVsBot
		botCursor.All(dbCtx, &botDebates)
		// Merge results if needed
	}

	ctx.JSON(http.StatusOK, gin.H{
		"debates": debates,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

func sanitizeFloat64(value float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return 0
	}
	return value
}

// DeleteDebate deletes a debate (admin only)
func DeleteDebate(ctx *gin.Context) {
	debateID := ctx.Param("id")
	objID, err := primitive.ObjectIDFromHex(debateID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid debate ID"})
		return
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Try to delete from debates collection
	collection := db.MongoDatabase.Collection("debates")
	result, err := collection.DeleteOne(dbCtx, bson.M{"_id": objID})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete debate", "message": err.Error()})
		return
	}

	// If not found in debates, try debates_vs_bot
	if result.DeletedCount == 0 {
		botCollection := db.MongoDatabase.Collection("debates_vs_bot")
		result, err = botCollection.DeleteOne(dbCtx, bson.M{"_id": objID})
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete debate", "message": err.Error()})
			return
		}
	}

	// Log the action
	middlewares.LogAdminAction(ctx, "delete_debate", "debate", objID, map[string]interface{}{
		"debateId": debateID,
	})

	ctx.JSON(http.StatusOK, gin.H{"message": "Debate deleted successfully", "deletedCount": result.DeletedCount})
}

// BulkDeleteDebates deletes multiple debates
func BulkDeleteDebates(ctx *gin.Context) {
	var request struct {
		IDs []string `json:"ids" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}

	var objIDs []primitive.ObjectID
	for _, id := range request.IDs {
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid ID: %s", id)})
			return
		}
		objIDs = append(objIDs, objID)
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Delete from debates collection
	collection := db.MongoDatabase.Collection("debates")
	result1, err := collection.DeleteMany(dbCtx, bson.M{"_id": bson.M{"$in": objIDs}})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete debates", "message": err.Error()})
		return
	}

	// Delete from debates_vs_bot collection
	botCollection := db.MongoDatabase.Collection("debates_vs_bot")
	result2, err := botCollection.DeleteMany(dbCtx, bson.M{"_id": bson.M{"$in": objIDs}})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete bot debates", "message": err.Error()})
		return
	}

	// Log the action
	for _, objID := range objIDs {
		middlewares.LogAdminAction(ctx, "bulk_delete_debate", "debate", objID, map[string]interface{}{
			"debateId":  objID.Hex(),
			"bulkCount": len(objIDs),
		})
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":      "Debates deleted successfully",
		"deletedCount": result1.DeletedCount + result2.DeletedCount,
	})
}

// GetComments fetches all comments with pagination
func GetComments(ctx *gin.Context) {
	page := 1
	limit := 20

	if pageStr := ctx.Query("page"); pageStr != "" {
		fmt.Sscanf(pageStr, "%d", &page)
	}
	if limitStr := ctx.Query("limit"); limitStr != "" {
		fmt.Sscanf(limitStr, "%d", &limit)
	}

	skip := (page - 1) * limit

	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Changed to AdminComment to match fields
	var comments []models.AdminComment

	// Get team debate messages
	teamDebateCollection := db.MongoDatabase.Collection("team_debate_messages")
	cursor1, err := teamDebateCollection.Find(dbCtx, bson.M{}, options.Find().SetSkip(int64(skip)).SetLimit(int64(limit)).SetSort(bson.M{"timestamp": -1}))
	if err == nil {
		defer cursor1.Close(dbCtx)
		var messages []models.TeamDebateMessage
		if err := cursor1.All(dbCtx, &messages); err == nil {
			for _, msg := range messages {
				// Using AdminComment struct
				comments = append(comments, models.AdminComment{
					ID:          msg.ID,
					Type:        "team_debate_message",
					Content:     msg.Message,
					UserID:      msg.UserID,
					UserEmail:   msg.Email,
					DisplayName: msg.DisplayName,
					DebateID:    msg.DebateID,
					TeamID:      msg.TeamID,
					CreatedAt:   msg.Timestamp,
					IsDeleted:   false,
				})
			}
		}
	}

	// Get team chat messages
	teamChatCollection := db.MongoDatabase.Collection("team_chat_messages")
	cursor2, err := teamChatCollection.Find(dbCtx, bson.M{}, options.Find().SetSkip(int64(skip)).SetLimit(int64(limit)).SetSort(bson.M{"timestamp": -1}))
	if err == nil {
		defer cursor2.Close(dbCtx)
		var chatMessages []models.TeamChatMessage
		if err := cursor2.All(dbCtx, &chatMessages); err == nil {
			for _, msg := range chatMessages {
				// Using AdminComment struct
				comments = append(comments, models.AdminComment{
					ID:          msg.ID,
					Type:        "team_chat_message",
					Content:     msg.Message,
					UserID:      msg.UserID,
					UserEmail:   msg.Email,
					DisplayName: msg.DisplayName,
					TeamID:      msg.TeamID,
					CreatedAt:   msg.Timestamp,
					IsDeleted:   false,
				})
			}
		}
	}

	// Get total count (simplified)
	total := int64(len(comments))

	ctx.JSON(http.StatusOK, gin.H{
		"comments": comments,
		"total":    total,
		"page":     page,
		"limit":    limit,
	})
}

// DeleteComment deletes a comment (admin or moderator)
func DeleteComment(ctx *gin.Context) {
	commentID := ctx.Param("id")
	objID, err := primitive.ObjectIDFromHex(commentID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	commentType := ctx.Query("type") // "team_debate_message" or "team_chat_message"
	if commentType == "" {
		commentType = "team_debate_message" // default
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var collectionName string
	switch commentType {
	case "team_debate_message":
		collectionName = "team_debate_messages"
	case "team_chat_message":
		collectionName = "team_chat_messages"
	default:
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment type"})
		return
	}

	collection := db.MongoDatabase.Collection(collectionName)
	result, err := collection.DeleteOne(dbCtx, bson.M{"_id": objID})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment", "message": err.Error()})
		return
	}

	// Log the action
	middlewares.LogAdminAction(ctx, "delete_comment", "comment", objID, map[string]interface{}{
		"commentId":   commentID,
		"commentType": commentType,
	})

	ctx.JSON(http.StatusOK, gin.H{"message": "Comment deleted successfully", "deletedCount": result.DeletedCount})
}

// BulkDeleteComments deletes multiple comments
func BulkDeleteComments(ctx *gin.Context) {
	var request struct {
		IDs  []string `json:"ids" binding:"required"`
		Type string   `json:"type" binding:"required"` // "team_debate_message" or "team_chat_message"
	}

	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}

	var objIDs []primitive.ObjectID
	for _, id := range request.IDs {
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid ID: %s", id)})
			return
		}
		objIDs = append(objIDs, objID)
	}

	var collectionName string
	switch request.Type {
	case "team_debate_message":
		collectionName = "team_debate_messages"
	case "team_chat_message":
		collectionName = "team_chat_messages"
	default:
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment type"})
		return
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.MongoDatabase.Collection(collectionName)
	result, err := collection.DeleteMany(dbCtx, bson.M{"_id": bson.M{"$in": objIDs}})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comments", "message": err.Error()})
		return
	}

	// Log the action
	for _, objID := range objIDs {
		middlewares.LogAdminAction(ctx, "bulk_delete_comment", "comment", objID, map[string]interface{}{
			"commentId":   objID.Hex(),
			"commentType": request.Type,
			"bulkCount":   len(objIDs),
		})
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":      "Comments deleted successfully",
		"deletedCount": result.DeletedCount,
	})
}