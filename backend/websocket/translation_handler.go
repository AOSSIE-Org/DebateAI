package websocket

import (
	"arguehub/services"
	"net/http"
	"github.com/gin-gonic/gin"
	"arguehub/dto"
)


func TranslationHandler(c *gin.Context) {
	var req TranslationRequest

	// 1. Bind the incoming JSON to our struct
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	// 2. Call the Gemini translation service
	// We assume source is "en" as the bot generates English by default
	sourceLang := req.SourceLang
    if sourceLang == "" {
		sourceLang = "en" // Default to English for bot responses
	}
	translated, err := services.TranslateContent(req.Text, sourceLang, req.TargetLang)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Translation service failed"})
		return
	}

	// 3. Return the result to the React app
	c.JSON(http.StatusOK, TranslationResponse{
		TranslatedText: translated,
	})
}
