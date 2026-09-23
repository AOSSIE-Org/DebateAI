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

// GeneratePerformanceReportHandler handles POST /debate/performance-report
func GeneratePerformanceReportHandler(c *gin.Context) {
	var req models.PerformanceReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	var userID primitive.ObjectID
	var email string

	// Extract user details from Authorization token if provided
	token := c.GetHeader("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
		valid, userEmail, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
		if err == nil && valid && userEmail != "" {
			email = userEmail
			if db.MongoDatabase != nil {
				var user models.User
				if errUser := db.MongoDatabase.Collection("users").FindOne(context.Background(), bson.M{"email": email}).Decode(&user); errUser == nil {
					userID = user.ID
				}
			}
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

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

	var userID primitive.ObjectID
	var email string

	token := c.GetHeader("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
		valid, userEmail, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
		if err == nil && valid && userEmail != "" {
			email = userEmail
			if db.MongoDatabase != nil {
				var user models.User
				if errUser := db.MongoDatabase.Collection("users").FindOne(context.Background(), bson.M{"email": email}).Decode(&user); errUser == nil {
					userID = user.ID
				}
			}
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

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
