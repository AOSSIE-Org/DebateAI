package controllers

import (
	"net/http"

	"arguehub/services"

	"github.com/gin-gonic/gin"
)

type SubmitTranscriptsRequest struct {
	RoomID      string            `json:"roomId" binding:"required"`
	Role        string            `json:"role" binding:"required,oneof=for against"`
	Transcripts map[string]string `json:"transcripts" binding:"required"`
}

func SubmitTranscripts(c *gin.Context) {
	var req SubmitTranscriptsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	result, err := services.SubmitTranscripts(req.RoomID, req.Role, req.Transcripts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}