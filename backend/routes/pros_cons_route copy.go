package routes

import (
	"arguehub/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetProsConsTopic generates a debate topic based on a default skill level
func GetProsConsTopic(c *gin.Context) {
	// Use a default skill level of "beginner" since SkillLevel is not available
	skillLevel := "intermediate"

	topic, err := services.GenerateDebateTopic(skillLevel)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"topic": topic})
}

// SubmitProsCons evaluates the user's arguments
func SubmitProsCons(c *gin.Context) {
	var req struct {
		Topic string   `json:"topic" binding:"required"`
		Pros  []string `json:"pros" binding:"required,max=5"`
		Cons  []string `json:"cons" binding:"required,max=5"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	evaluation, err := services.EvaluateProsCons(req.Topic, req.Pros, req.Cons)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update user points (score * 2 for simplicity)
	userID := c.GetString("user_id")
	if err := services.UpdateUserPoints(userID, evaluation.Score*2); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update points"})
		return
	}

	c.JSON(http.StatusOK, evaluation)
}
