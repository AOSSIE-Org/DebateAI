package controllers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"arguehub/models"
	"arguehub/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func performanceReportAuthUser(c *gin.Context) (primitive.ObjectID, string, bool) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		return primitive.NilObjectID, "", false
	}
	emailVal, exists := c.Get("email")
	if !exists {
		return primitive.NilObjectID, "", false
	}
	userID, ok := userIDVal.(primitive.ObjectID)
	if !ok || userID.IsZero() {
		return primitive.NilObjectID, "", false
	}
	email, ok := emailVal.(string)
	if !ok || email == "" {
		return primitive.NilObjectID, "", false
	}
	return userID, email, true
}

func requestIncludesTranscriptPayload(req models.PerformanceReportRequest) bool {
	if len(req.Messages) > 0 {
		return true
	}
	for _, text := range req.Transcripts {
		if strings.TrimSpace(text) != "" {
			return true
		}
	}
	return false
}

// GeneratePerformanceReportHandler handles POST /debate/performance-report
func GeneratePerformanceReportHandler(c *gin.Context) {
	var req models.PerformanceReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	userID, email, ok := performanceReportAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Minute)
	defer cancel()

	if !requestIncludesTranscriptPayload(req) && req.DebateID != "" {
		if !services.UserIsDebateParticipant(ctx, req.DebateID, userID, email) {
			c.JSON(http.StatusForbidden, gin.H{"error": "You are not a participant in this debate"})
			return
		}
	}

	report, err := services.GenerateOrGetPerformanceReport(ctx, req, userID, email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to generate performance report",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Performance report retrieved successfully",
		"report":  report,
	})
}

// GetPerformanceReportByIDHandler handles GET /debate/:id/performance-report
func GetPerformanceReportByIDHandler(c *gin.Context) {
	debateID := c.Param("id")
	if debateID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Debate ID parameter required"})
		return
	}

	userID, email, ok := performanceReportAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Minute)
	defer cancel()

	if !services.UserIsDebateParticipant(ctx, debateID, userID, email) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not a participant in this debate"})
		return
	}

	req := models.PerformanceReportRequest{
		DebateID: debateID,
	}

	report, err := services.GenerateOrGetPerformanceReport(ctx, req, userID, email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to retrieve performance report",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Performance report retrieved successfully",
		"report":  report,
	})
}
