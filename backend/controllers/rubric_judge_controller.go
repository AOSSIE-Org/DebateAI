package controllers

import (
	"context"
	"net/http"
	"time"

	"arguehub/services"

	"github.com/gin-gonic/gin"
)

type RubricJudgeRequest struct {
	Topic  string                `json:"topic" binding:"required"`
	Format string                `json:"format"`
	Turns  []services.DebateTurn `json:"turns" binding:"required"`
}

func JudgeDebateWithRubric(c *gin.Context) {
	var req RubricJudgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	if len(req.Turns) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Debate must have at least 2 speaker turns to be adjudicated"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 45*time.Second)
	defer cancel()

	report, err := services.EvaluateDebateRubric(ctx, req.Topic, req.Format, req.Turns)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate debate rubric", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}
