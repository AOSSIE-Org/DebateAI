package websocket

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// newTestConn spins up a minimal WebSocket server and returns a real client
// connection, so Register has a *websocket.Conn it can broadcast a presence
// event to (a nil conn would panic in WriteJSON once the deadlock is fixed).
func newTestConn(t *testing.T) (*websocket.Conn, func()) {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := debateUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}))

	url := "ws" + strings.TrimPrefix(srv.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		srv.Close()
		t.Fatalf("failed to dial test websocket: %v", err)
	}

	return conn, func() {
		conn.Close()
		srv.Close()
	}
}

// TestRegisterDoesNotDeadlock reproduces the self-deadlock where Register holds
// h.mu (write lock) and then calls BroadcastPresence, which tries to acquire the
// same sync.RWMutex for reading. A non-reentrant RWMutex blocks forever.
//
// A plain call would hang the whole test binary, so Register runs in a goroutine
// and the test fails fast on a timeout.
func TestRegisterDoesNotDeadlock(t *testing.T) {
	conn, cleanup := newTestConn(t)
	defer cleanup()

	hub := NewDebateHub()

	done := make(chan *SpectatorClient, 1)
	go func() {
		done <- hub.Register("debate-deadlock", conn, "spectator-hash")
	}()

	select {
	case <-done:
		// Register returned; the deadlock is gone.
	case <-time.After(2 * time.Second):
		t.Fatal("Register did not return within 2s: h.mu is reacquired via BroadcastPresence (self-deadlock)")
	}
}

// TestRegisterReleasesHubLock asserts the hub lock is released once Register
// returns, so a subsequent registration for another debate also completes.
func TestRegisterReleasesHubLock(t *testing.T) {
	conn1, cleanup1 := newTestConn(t)
	defer cleanup1()
	conn2, cleanup2 := newTestConn(t)
	defer cleanup2()

	hub := NewDebateHub()

	register := func(debateID string, conn *websocket.Conn) <-chan struct{} {
		done := make(chan struct{}, 1)
		go func() {
			hub.Register(debateID, conn, "hash-"+debateID)
			done <- struct{}{}
		}()
		return done
	}

	select {
	case <-register("debate-1", conn1):
	case <-time.After(2 * time.Second):
		t.Fatal("first Register did not return: hub lock was not released")
	}

	select {
	case <-register("debate-2", conn2):
	case <-time.After(2 * time.Second):
		t.Fatal("second Register did not return: hub lock left held after the first Register")
	}
}
