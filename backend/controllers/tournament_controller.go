package controllers

import (
	"net/http"

	"arguehub/models"
	"arguehub/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type CreateTournamentRequest struct {
	Title           string                  `json:"title" binding:"required"`
	Description     string                  `json:"description"`
	Topic           string                  `json:"topic" binding:"required"`
	TopicsPool      []string                `json:"topics_pool"`
	Format          models.TournamentFormat `json:"format"`
	MaxParticipants int                     `json:"max_participants"`
}

func CreateTournament(c *gin.Context) {
	var req CreateTournamentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters", "details": err.Error()})
		return
	}

	var creatorID primitive.ObjectID
	if userIDVal, exists := c.Get("userID"); exists {
		if uid, ok := userIDVal.(primitive.ObjectID); ok {
			creatorID = uid
		}
	}

	t := &models.Tournament{
		Title:           req.Title,
		Description:     req.Description,
		Topic:           req.Topic,
		TopicsPool:      req.TopicsPool,
		Format:          req.Format,
		MaxParticipants: req.MaxParticipants,
		CreatedBy:       creatorID,
	}

	created, err := services.CreateTournament(c.Request.Context(), t)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tournament", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, created)
}

func GetTournament(c *gin.Context) {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	tournament, err := services.GetTournament(c.Request.Context(), objID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
		return
	}

	c.JSON(http.StatusOK, tournament)
}

func ListTournaments(c *gin.Context) {
	status := models.TournamentStatus(c.Query("status"))
	list, err := services.ListTournaments(c.Request.Context(), status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list tournaments", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tournaments": list, "count": len(list)})
}

func RegisterTournament(c *gin.Context) {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	var p models.TournamentParticipant
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid participant details", "details": err.Error()})
		return
	}

	if userIDVal, exists := c.Get("userID"); exists {
		if uid, ok := userIDVal.(primitive.ObjectID); ok && p.UserID.IsZero() {
			p.UserID = uid
		}
	}

	if p.UserID.IsZero() {
		p.UserID = primitive.NewObjectID()
	}

	if err := services.RegisterParticipant(c.Request.Context(), objID, p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully registered for tournament", "participant": p})
}

func StartTournament(c *gin.Context) {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	tournament, err := services.StartTournament(c.Request.Context(), objID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tournament started successfully", "tournament": tournament})
}

type ReportMatchRequest struct {
	WinnerID primitive.ObjectID `json:"winner_id" binding:"required"`
	Score1   float64            `json:"score1"`
	Score2   float64            `json:"score2"`
}

func ReportTournamentMatch(c *gin.Context) {
	idStr := c.Param("id")
	matchID := c.Param("matchId")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	var req ReportMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "winner_id is required", "details": err.Error()})
		return
	}

	updated, err := services.ReportMatchResult(c.Request.Context(), objID, matchID, req.WinnerID, req.Score1, req.Score2)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Match result recorded", "tournament": updated})
}
