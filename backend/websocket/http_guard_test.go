package websocket

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestWebsocketAndMatchmakingRejectMissingToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/ws", WebsocketHandler)
	router.GET("/ws/matchmaking", MatchmakingHandler)
	server := httptest.NewServer(router)
	t.Cleanup(server.Close)

	resp, err := http.Get(server.URL + "/ws?room=abc")
	if err != nil {
		t.Fatalf("ws request: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("ws status = %d, body %s", resp.StatusCode, body)
	}
	if !strings.Contains(string(body), "Missing token") {
		t.Fatalf("ws body = %s", body)
	}

	resp, err = http.Get(server.URL + "/ws/matchmaking")
	if err != nil {
		t.Fatalf("matchmaking request: %v", err)
	}
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("matchmaking status = %d, body %s", resp.StatusCode, body)
	}
	if !strings.Contains(string(body), "No token provided") {
		t.Fatalf("matchmaking body = %s", body)
	}
}
