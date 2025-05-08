package routes

import (
	"arguehub/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetWeakStatement generates a weak statement based on the user-provided topic and stance
func GetWeakStatement(c *gin.Context) {
	topic := c.Query("topic")
	stance := c.Query("stance")

	if topic == "" || stance == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both topic and stance are required"})
		return
	}

	weakStatement, err := services.GenerateWeakStatement(topic, stance)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate weak statement"})
		return
	}
	c.JSON(http.StatusOK, weakStatement)
}

// EvaluateStrengthenedArgument evaluates the user's improved statement
func EvaluateStrengthenedArgument(c *gin.Context) {
	var req struct {
		Topic             string `json:"topic" binding:"required"`
		Stance            string `json:"stance" binding:"required"`
		WeakStatementText string `json:"weakStatementText" binding:"required"`
		UserResponse      string `json:"userResponse" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	// Evaluate the argument using the Gemini API with all required arguments
	evaluation, err := services.EvaluateArgument(req.Topic, req.Stance, req.WeakStatementText, req.UserResponse)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate argument"})
		return
	}

	// Calculate points (score * 10)
	pointsEarned := evaluation.Score * 10

	// Update user's points
	userID := c.GetString("user_id")
	if err := services.UpdateUserPoints(userID, pointsEarned); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user points"})
		return
	}

	// Return feedback and points
	c.JSON(http.StatusOK, gin.H{
		"feedback":     evaluation.Feedback,
		"pointsEarned": pointsEarned,
	})
}
