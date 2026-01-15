package controllers

import (
	"net/http"

	"arguehub/services"

	"github.com/gin-gonic/gin"
)

// GetDebateAssumptions retrieves or generates assumptions for a debate
func GetDebateAssumptions(c *gin.Context) {
	debateID := c.Param("debateId")

	if debateID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "debateId is required",
		})
		return
	}

	// Extract assumptions (will use cache if available)
	assumptions, err := services.ExtractAssumptions(debateID)
	if err != nil {
		// Determine appropriate error code
		statusCode := http.StatusInternalServerError
		errorMessage := err.Error()

		// Provide user-friendly messages for common errors
		if err.Error() == "AI service not available - Gemini client not initialized" {
			statusCode = http.StatusServiceUnavailable
			errorMessage = "AI analysis service is currently unavailable. Please ensure the Gemini API is configured."
		} else if err.Error() == "no transcript found for this debate" {
			statusCode = http.StatusNotFound
			errorMessage = "No debate transcript found for this debate ID."
		}

		c.JSON(statusCode, gin.H{
			"error": errorMessage,
		})
		return
	}

	// Return assumptions (even if empty)
	c.JSON(http.StatusOK, gin.H{
		"assumptions": assumptions,
		"count":       len(assumptions),
	})
}
