package websocket

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
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

// newConnPair returns both ends of a WebSocket connection: the server side
// (what Register writes to) and the client side (what a subscriber reads from).
func newConnPair(t *testing.T) (*websocket.Conn, *websocket.Conn, func()) {
	t.Helper()

	connCh := make(chan *websocket.Conn, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := debateUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		connCh <- conn
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}))

	url := "ws" + strings.TrimPrefix(srv.URL, "http")
	client, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		srv.Close()
		t.Fatalf("failed to dial test websocket: %v", err)
	}
	server := <-connCh

	return server, client, func() {
		client.Close()
		srv.Close()
	}
}

// TestConcurrentRegistrationsPresenceOrdered asserts that presence updates are
// published in order: a watcher must observe non-decreasing "connected" counts
// that end at the total number of registered clients, even when many clients
// register concurrently.
func TestConcurrentRegistrationsPresenceOrdered(t *testing.T) {
	watcherServer, watcherClient, cleanupWatcher := newConnPair(t)
	defer cleanupWatcher()

	hub := NewDebateHub()
	hub.Register("debate-order", watcherServer, "watcher")

	counts := make(chan int, 64)
	go func() {
		defer close(counts)
		for {
			var msg struct {
				Type    string `json:"type"`
				Payload struct {
					Connected int `json:"connected"`
				} `json:"payload"`
			}
			if err := watcherClient.ReadJSON(&msg); err != nil {
				return
			}
			if msg.Type == "presence" {
				counts <- msg.Payload.Connected
			}
		}
	}()

	const n = 20
	servers := make([]*websocket.Conn, 0, n)
	cleanups := make([]func(), 0, n)
	for i := 0; i < n; i++ {
		server, _, cleanup := newConnPair(t)
		servers = append(servers, server)
		cleanups = append(cleanups, cleanup)
	}
	defer func() {
		for _, cleanup := range cleanups {
			cleanup()
		}
	}()

	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(conn *websocket.Conn) {
			defer wg.Done()
			hub.Register("debate-order", conn, "spectator")
		}(servers[i])
	}
	wg.Wait()

	last := 0
	for i := 0; i < n+1; i++ {
		select {
		case count, ok := <-counts:
			if !ok {
				t.Fatalf("presence stream closed early after %d of %d updates", i, n+1)
			}
			if count < last {
				t.Fatalf("out-of-order presence count: got %d after %d", count, last)
			}
			last = count
		case <-time.After(2 * time.Second):
			t.Fatalf("timed out waiting for presence update %d of %d", i+1, n+1)
		}
	}

	if last != n+1 {
		t.Fatalf("expected final presence count %d, got %d", n+1, last)
	}
}
