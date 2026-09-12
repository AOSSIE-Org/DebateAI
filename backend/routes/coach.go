package routes

import (
	"arguehub/services"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// SetupCoachRoutes registers all coach-related routes on the given router group
func SetupCoachRoutes(router *gin.RouterGroup) {
	coach := router.Group("/coach")
	{
		coach.GET("/strengthen-argument/weak-statement", GetWeakStatement)
		coach.POST("/strengthen-argument/evaluate", EvaluateStrengthenedArgument)
		coach.GET("/pros-cons/topic", GetProsConsTopic)
		coach.POST("/pros-cons/submit", SubmitProsCons)
	}
}

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
	userID, _ := c.Get("userID")
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

// GetProsConsTopic generates a debate topic for the pros & cons challenge
func GetProsConsTopic(c *gin.Context) {
	ratingValue, exists := c.Get("rating")
	rating, isFloat := ratingValue.(float64)

	skillLevel := "beginner"

	if exists && isFloat {
		if rating < 1400 {
			skillLevel = "beginner"
		} else if rating <= 1800 {
			skillLevel = "intermediate"
		} else {
			skillLevel = "advanced"
		}
	}

	topic, err := services.GenerateDebateTopic(skillLevel)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate topic: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"topic": topic})
}

type SubmitProsConsRequest struct {
	Topic string   `json:"topic" binding:"required"`
	Pros  []string `json:"pros" binding:"required"`
	Cons  []string `json:"cons" binding:"required"`
}

// SubmitProsCons evaluates the pros and cons submitted by the user
func SubmitProsCons(c *gin.Context) {
	var req SubmitProsConsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	var validPros []string
	for _, p := range req.Pros {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			validPros = append(validPros, trimmed)
		}
	}

	var validCons []string
	for _, con := range req.Cons {
		trimmed := strings.TrimSpace(con)
		if trimmed != "" {
			validCons = append(validCons, trimmed)
		}
	}

	if len(validPros) == 0 || len(validCons) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide at least one pro and one con"})
		return
	}

	if len(validPros) > 5 || len(validCons) > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Maximum of 5 pros and 5 cons allowed"})
		return
	}

	evaluation, err := services.EvaluateProsCons(req.Topic, validPros, validCons)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate arguments: " + err.Error()})
		return
	}

	// Update user points if authenticated
	userID, _ := c.Get("userID")
	if err := services.UpdateUserPoints(userID, evaluation.Score); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user points"})
		return
	}

	c.JSON(http.StatusOK, evaluation)
}
