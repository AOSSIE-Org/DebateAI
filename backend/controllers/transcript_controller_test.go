package controllers

import (
	"bytes"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSaveTranscriptRequest_JSONBinding(t *testing.T) {
	gin.SetMode(gin.TestMode)

	jsonData := `{
		"debateType": "user_vs_user",
		"topic": "Universal Basic Income",
		"opponent": "opponent@example.com",
		"result": "win",
		"eloChange": 14.25,
		"messages": [
			{"sender": "User", "text": "UBI reduces poverty.", "phase": "Opening"}
		]
	}`

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodPost, "/save-transcript", bytes.NewBufferString(jsonData))
	c.Request.Header.Set("Content-Type", "application/json")

	var req SaveTranscriptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		t.Fatalf("Expected valid binding, got err: %v", err)
	}

	if req.DebateType != "user_vs_user" {
		t.Errorf("Expected debateType 'user_vs_user', got %s", req.DebateType)
	}
	if req.Topic != "Universal Basic Income" {
		t.Errorf("Expected topic 'Universal Basic Income', got %s", req.Topic)
	}
	if req.EloChange != 14.25 {
		t.Errorf("Expected EloChange 14.25, got %v", req.EloChange)
	}

	// Verify rounding precision logic as used in GetDebateStats
	rounded := math.Round(req.EloChange*10) / 10
	if rounded != 14.3 {
		t.Errorf("Expected rounded EloChange to be 14.3, got %v", rounded)
	}
}

func TestSaveTranscriptRequest_ZeroEloDefault(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// JSON payload without eloChange field
	jsonData := `{
		"debateType": "user_vs_bot",
		"topic": "Space Exploration",
		"opponent": "AI Bot",
		"result": "loss"
	}`

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodPost, "/save-transcript", bytes.NewBufferString(jsonData))
	c.Request.Header.Set("Content-Type", "application/json")

	var req SaveTranscriptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		t.Fatalf("Expected valid binding, got err: %v", err)
	}

	if req.EloChange != 0 {
		t.Errorf("Expected default EloChange 0, got %v", req.EloChange)
	}
}
