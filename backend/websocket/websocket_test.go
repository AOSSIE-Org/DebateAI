package websocket

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	gorilla "github.com/gorilla/websocket"
)

func newTestClient(t *testing.T, isSpectator bool, role string, userID string) (*Client, *gorilla.Conn, func()) {
	t.Helper()
	var serverConn *gorilla.Conn
	upgrader := gorilla.Upgrader{}
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var err error
		serverConn, err = upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("failed to upgrade: %v", err)
		}
	}))

	wsURL := "ws" + strings.TrimPrefix(s.URL, "http")
	clientConn, _, err := gorilla.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		s.Close()
		t.Fatalf("failed to dial: %v", err)
	}

	client := &Client{
		Conn:        serverConn,
		UserID:      userID,
		Username:    "User-" + userID,
		IsSpectator: isSpectator,
		Role:        role,
	}

	cleanup := func() {
		_ = clientConn.Close()
		_ = serverConn.Close()
		s.Close()
	}

	return client, serverConn, cleanup
}

func TestBuildParticipantsMessageIncludesRecoverableRoomState(t *testing.T) {
	conn := &gorilla.Conn{}
	room := &Room{
		Clients: map[*gorilla.Conn]*Client{
			conn: {
				UserID:   "user-1",
				Username: "Alice",
				Email:    "alice@example.com",
				Role:     "for",
				Ready:    true,
			},
		},
	}

	message := buildParticipantsMessage(room)
	participants, ok := message["roomParticipants"].([]map[string]interface{})
	if !ok {
		t.Fatalf("roomParticipants has unexpected type %T", message["roomParticipants"])
	}
	if len(participants) != 1 {
		t.Fatalf("expected one participant, got %d", len(participants))
	}

	participant := participants[0]
	if ready, ok := participant["ready"].(bool); !ok || !ready {
		t.Fatalf("expected ready=true, got %#v", participant["ready"])
	}
	if role, ok := participant["role"].(string); !ok || role != "for" {
		t.Fatalf("expected role=for, got %#v", participant["role"])
	}
}

func TestHandlePhaseChange_SpectatorBlocked(t *testing.T) {
	debater, debaterConn, cleanup1 := newTestClient(t, false, "for", "debater-1")
	defer cleanup1()

	spectator, spectatorConn, cleanup2 := newTestClient(t, true, "", "spectator-1")
	defer cleanup2()

	room := &Room{
		Clients: map[*gorilla.Conn]*Client{
			debaterConn:   debater,
			spectatorConn: spectator,
		},
	}

	// Spectator tries to trigger a phase change to "against" turn
	msg := Message{Type: "phaseChange", Phase: "openingAgainst"}
	handlePhaseChange(room, spectatorConn, msg, "room-1")

	// Debater's mute status should remain untouched (false)
	if debater.IsMuted {
		t.Errorf("expected debater not to be muted by spectator phaseChange")
	}
}

func TestHandlePhaseChange_DebatersMutedAccordingToTurn(t *testing.T) {
	forClient, forConn, cleanup1 := newTestClient(t, false, "for", "user-for")
	defer cleanup1()

	againstClient, againstConn, cleanup2 := newTestClient(t, false, "against", "user-against")
	defer cleanup2()

	room := &Room{
		Clients: map[*gorilla.Conn]*Client{
			forConn:     forClient,
			againstConn: againstClient,
		},
	}

	// Phase where turn is "for": for should be unmuted, against should be muted
	msg := Message{Type: "phaseChange", Phase: "openingFor"}
	handlePhaseChange(room, forConn, msg, "room-1")

	if forClient.IsMuted {
		t.Errorf("expected 'for' debater to be unmuted during openingFor")
	}
	if !againstClient.IsMuted {
		t.Errorf("expected 'against' debater to be muted during openingFor")
	}

	// Phase where turn is "against": against should be unmuted, for should be muted
	msg2 := Message{Type: "phaseChange", Phase: "openingAgainst"}
	handlePhaseChange(room, forConn, msg2, "room-1")

	if !forClient.IsMuted {
		t.Errorf("expected 'for' debater to be muted during openingAgainst")
	}
	if againstClient.IsMuted {
		t.Errorf("expected 'against' debater to be unmuted during openingAgainst")
	}
}

func TestHandleRoleSelection_MutualExclusion(t *testing.T) {
	c1, conn1, cleanup1 := newTestClient(t, false, "", "user-1")
	defer cleanup1()

	c2, conn2, cleanup2 := newTestClient(t, false, "", "user-2")
	defer cleanup2()

	room := &Room{
		Clients: map[*gorilla.Conn]*Client{
			conn1: c1,
			conn2: c2,
		},
	}

	// Client 1 picks "for"
	handleRoleSelection(room, conn1, Message{Role: "for"}, "room-1")
	if c1.Role != "for" {
		t.Fatalf("expected client 1 to have role 'for', got %q", c1.Role)
	}

	// Client 2 attempts to also pick "for" - should be rejected
	handleRoleSelection(room, conn2, Message{Role: "for"}, "room-1")
	if c2.Role == "for" {
		t.Errorf("expected client 2 role 'for' to be rejected due to collision")
	}

	// Client 2 picks "against" - should succeed
	handleRoleSelection(room, conn2, Message{Role: "against"}, "room-1")
	if c2.Role != "against" {
		t.Errorf("expected client 2 to have role 'against', got %q", c2.Role)
	}
}

func TestHandleConcede_SpectatorBlocked(t *testing.T) {
	spectator, specConn, cleanup := newTestClient(t, true, "", "spec-1")
	defer cleanup()

	debater, debConn, cleanup2 := newTestClient(t, false, "for", "deb-1")
	defer cleanup2()

	room := &Room{
		Clients: map[*gorilla.Conn]*Client{
			specConn: spectator,
			debConn:  debater,
		},
	}

	handleConcede(room, specConn, Message{Type: "concede"}, spectator, "room-1")

	if room.IsEnded {
		t.Errorf("expected room not to be ended by spectator concede")
	}
}

func TestHandleConcede_DuplicatePrevented(t *testing.T) {
	c1, conn1, cleanup1 := newTestClient(t, false, "for", "user-1")
	defer cleanup1()

	c2, conn2, cleanup2 := newTestClient(t, false, "against", "user-2")
	defer cleanup2()

	room := &Room{
		Clients: map[*gorilla.Conn]*Client{
			conn1: c1,
			conn2: c2,
		},
	}

	// First concede marks room ended
	handleConcede(room, conn1, Message{Type: "concede"}, c1, "room-1")
	if !room.IsEnded {
		t.Errorf("expected room.IsEnded to be true after concede")
	}

	// Second concede is ignored (already ended)
	handleConcede(room, conn1, Message{Type: "concede"}, c1, "room-1")
}

