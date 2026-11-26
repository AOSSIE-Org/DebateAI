package websocket

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"arguehub/internal/testkit"
	"arguehub/models"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	gorilla "github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
)

func TestWebsocketBroadcastReachesOtherClient(t *testing.T) {
	database := testkit.ConnectMongo(t)
	utils.SetJWTSecret(testkit.JWTSecret)

	ctx := context.Background()
	now := time.Now()
	alice := models.User{Email: "alice@debateai.test", DisplayName: "Alice", Nickname: "Alice", Rating: 1500, IsVerified: true, CreatedAt: now, UpdatedAt: now}
	bob := models.User{Email: "bob@debateai.test", DisplayName: "Bob", Nickname: "Bob", Rating: 1500, IsVerified: true, CreatedAt: now, UpdatedAt: now}
	aliceResult, err := database.Collection("users").InsertOne(ctx, alice)
	if err != nil {
		t.Fatalf("insert alice: %v", err)
	}
	if _, err := database.Collection("users").InsertOne(ctx, bob); err != nil {
		t.Fatalf("insert bob: %v", err)
	}

	roomID := "room-broadcast-1"
	_, err = database.Collection("rooms").InsertOne(ctx, bson.M{
		"_id":     roomID,
		"type":    "public",
		"ownerId": aliceResult.InsertedID,
	})
	if err != nil {
		t.Fatalf("insert room: %v", err)
	}
	t.Cleanup(func() {
		roomsMutex.Lock()
		delete(rooms, roomID)
		roomsMutex.Unlock()
	})

	aliceToken, err := utils.GenerateJWTToken("alice", alice.Email)
	if err != nil {
		t.Fatalf("alice token: %v", err)
	}
	bobToken, err := utils.GenerateJWTToken("bob", bob.Email)
	if err != nil {
		t.Fatalf("bob token: %v", err)
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/ws", WebsocketHandler)
	server := httptest.NewServer(router)
	t.Cleanup(server.Close)

	aliceConn, aliceResp := dialRoom(t, server.URL, roomID, aliceToken)
	bobConn, bobResp := dialRoom(t, server.URL, roomID, bobToken)
	t.Cleanup(func() { aliceConn.Close() })
	t.Cleanup(func() { bobConn.Close() })
	if aliceResp.StatusCode != http.StatusSwitchingProtocols || bobResp.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("handshake alice=%d bob=%d", aliceResp.StatusCode, bobResp.StatusCode)
	}

	aliceMsgs := readMessages(aliceConn)
	bobMsgs := readMessages(bobConn)

	if err := aliceConn.WriteJSON(Message{Type: "message", Content: "ping-from-alice"}); err != nil {
		t.Fatalf("write: %v", err)
	}

	deadline := time.After(3 * time.Second)
	for {
		select {
		case msg, ok := <-bobMsgs:
			if !ok {
				t.Fatal("bob connection closed before the chat message")
			}
			if msg["type"] == "message" && msg["content"] == "ping-from-alice" && msg["username"] == "Alice" {
				assertSenderDoesNotReceive(t, aliceMsgs, "ping-from-alice")
				return
			}
		case <-deadline:
			t.Fatal("bob did not receive alice's chat message")
		}
	}
}

func dialRoom(t *testing.T, serverURL, roomID, token string) (*gorilla.Conn, *http.Response) {
	t.Helper()
	header := http.Header{}
	header.Set("Authorization", "Bearer "+token)
	wsURL := "ws" + strings.TrimPrefix(serverURL, "http") + "/ws?room=" + roomID
	conn, resp, err := gorilla.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		body := ""
		if resp != nil && resp.Body != nil {
			raw, _ := io.ReadAll(resp.Body)
			body = string(raw)
			resp.Body.Close()
		}
		t.Fatalf("dial %s: %v body %s", wsURL, err, body)
	}
	t.Cleanup(func() {
		if resp != nil && resp.Body != nil {
			resp.Body.Close()
		}
	})
	return conn, resp
}

func readMessages(conn *gorilla.Conn) <-chan map[string]any {
	out := make(chan map[string]any, 32)
	go func() {
		defer close(out)
		for {
			var msg map[string]any
			if err := conn.ReadJSON(&msg); err != nil {
				return
			}
			out <- msg
		}
	}()
	return out
}

func assertSenderDoesNotReceive(t *testing.T, messages <-chan map[string]any, content string) {
	t.Helper()
	timer := time.NewTimer(200 * time.Millisecond)
	defer timer.Stop()
	for {
		select {
		case msg, ok := <-messages:
			if !ok {
				return
			}
			if msg["type"] == "message" && msg["content"] == content {
				t.Fatalf("sender received their own chat message: %#v", msg)
			}
		case <-timer.C:
			return
		}
	}
}
