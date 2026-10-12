package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"arguehub/models"
	"arguehub/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestCreateTeamDebate_Validation(t *testing.T) {
	sameTeamID := primitive.NewObjectID()

	// 1. Same team on both sides
	reqBody, _ := json.Marshal(map[string]interface{}{
		"team1Id": sameTeamID.Hex(),
		"team2Id": sameTeamID.Hex(),
		"topic":   "AI Ethics",
	})

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodPost, "/team-debates/", bytes.NewBuffer(reqBody))
	c.Request.Header.Set("Content-Type", "application/json")

	CreateTeamDebate(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("Expected status 400 for identical teams, got %d", w.Code)
	}

	// 2. Missing authentication
	team1ID := primitive.NewObjectID()
	team2ID := primitive.NewObjectID()
	reqBodyDiff, _ := json.Marshal(map[string]interface{}{
		"team1Id": team1ID.Hex(),
		"team2Id": team2ID.Hex(),
		"topic":   "AI Ethics",
	})

	wUnauth := httptest.NewRecorder()
	cUnauth, _ := gin.CreateTestContext(wUnauth)
	cUnauth.Request, _ = http.NewRequest(http.MethodPost, "/team-debates/", bytes.NewBuffer(reqBodyDiff))
	cUnauth.Request.Header.Set("Content-Type", "application/json")

	CreateTeamDebate(cUnauth)

	if wUnauth.Code != http.StatusUnauthorized {
		t.Fatalf("Expected status 401 for unauthenticated request, got %d", wUnauth.Code)
	}

	// 3. Invalid user ID type in context
	wInvalidUser := httptest.NewRecorder()
	cInvalidUser, _ := gin.CreateTestContext(wInvalidUser)
	cInvalidUser.Request, _ = http.NewRequest(http.MethodPost, "/team-debates/", bytes.NewBuffer(reqBodyDiff))
	cInvalidUser.Request.Header.Set("Content-Type", "application/json")
	cInvalidUser.Set("userID", "not-an-object-id")

	CreateTeamDebate(cInvalidUser)

	if wInvalidUser.Code != http.StatusUnauthorized {
		t.Fatalf("Expected status 401 for invalid user ID format, got %d", wInvalidUser.Code)
	}

	// 4. Authenticated user, but neither team in matchmaking pool
	services.ClearMatchmakingPool()
	wNoPool := httptest.NewRecorder()
	cNoPool, _ := gin.CreateTestContext(wNoPool)
	cNoPool.Request, _ = http.NewRequest(http.MethodPost, "/team-debates/", bytes.NewBuffer(reqBodyDiff))
	cNoPool.Request.Header.Set("Content-Type", "application/json")
	cNoPool.Set("userID", primitive.NewObjectID())

	CreateTeamDebate(cNoPool)

	if wNoPool.Code != http.StatusBadRequest {
		t.Fatalf("Expected status 400 when teams are absent from matchmaking pool, got %d", wNoPool.Code)
	}

	// 5. Authenticated user, but mismatched team sizes in pool
	services.ClearMatchmakingPool()
	team1 := models.Team{
		ID:         team1ID,
		Name:       "Alpha",
		MaxSize:    2,
		AverageElo: 1200,
	}
	team2Mismatched := models.Team{
		ID:         team2ID,
		Name:       "Beta",
		MaxSize:    4,
		AverageElo: 1200,
	}
	services.AddTeamToMatchmakingPoolDirect(team1)
	services.AddTeamToMatchmakingPoolDirect(team2Mismatched)

	wMismatchedSize := httptest.NewRecorder()
	cMismatchedSize, _ := gin.CreateTestContext(wMismatchedSize)
	cMismatchedSize.Request, _ = http.NewRequest(http.MethodPost, "/team-debates/", bytes.NewBuffer(reqBodyDiff))
	cMismatchedSize.Request.Header.Set("Content-Type", "application/json")
	cMismatchedSize.Set("userID", primitive.NewObjectID())

	CreateTeamDebate(cMismatchedSize)

	if wMismatchedSize.Code != http.StatusBadRequest {
		t.Fatalf("Expected status 400 when team sizes mismatch, got %d", wMismatchedSize.Code)
	}

	// 6. Authenticated user, but Elo difference > 200 in pool
	services.ClearMatchmakingPool()
	team2HighElo := models.Team{
		ID:         team2ID,
		Name:       "Beta",
		MaxSize:    2,
		AverageElo: 1500,
	}
	services.AddTeamToMatchmakingPoolDirect(team1)
	services.AddTeamToMatchmakingPoolDirect(team2HighElo)

	wEloDiff := httptest.NewRecorder()
	cEloDiff, _ := gin.CreateTestContext(wEloDiff)
	cEloDiff.Request, _ = http.NewRequest(http.MethodPost, "/team-debates/", bytes.NewBuffer(reqBodyDiff))
	cEloDiff.Request.Header.Set("Content-Type", "application/json")
	cEloDiff.Set("userID", primitive.NewObjectID())

	CreateTeamDebate(cEloDiff)

	if wEloDiff.Code != http.StatusBadRequest {
		t.Fatalf("Expected status 400 when Elo difference exceeds 200, got %d", wEloDiff.Code)
	}
}
