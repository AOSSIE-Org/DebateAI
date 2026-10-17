package controllers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"arguehub/services"

	"github.com/gin-gonic/gin"
)

type FactCheckRequest struct {
	Statement string `json:"statement" binding:"required"`
	Topic     string `json:"topic" binding:"required"`
	Context   string `json:"context"`
}

func FactCheckDebateStatement(c *gin.Context) {
	var req FactCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: statement and topic are required", "details": err.Error()})
		return
	}

	req.Statement = strings.TrimSpace(req.Statement)
	if len(req.Statement) < 10 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Statement is too short to fact-check (min 10 characters)"})
		return
	}
	if len(req.Statement) > 10000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Statement exceeds maximum length of 10,000 characters"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	report, err := services.CheckDebateFacts(ctx, req.Topic, req.Statement, req.Context)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fact-checking engine failure", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}
