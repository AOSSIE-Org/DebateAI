package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestCreateTeamDebate_Validation(t *testing.T) {
	sameTeamID := primitive.NewObjectID()

	// 1. Test same team on both sides
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

	// 2. Test missing authentication
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

	// 3. Test invalid user ID type in context
	wInvalidUser := httptest.NewRecorder()
	cInvalidUser, _ := gin.CreateTestContext(wInvalidUser)
	cInvalidUser.Request, _ = http.NewRequest(http.MethodPost, "/team-debates/", bytes.NewBuffer(reqBodyDiff))
	cInvalidUser.Request.Header.Set("Content-Type", "application/json")
	cInvalidUser.Set("userID", "not-an-object-id")

	CreateTeamDebate(cInvalidUser)

	if wInvalidUser.Code != http.StatusUnauthorized {
		t.Fatalf("Expected status 401 for invalid user ID format, got %d", wInvalidUser.Code)
	}
}
