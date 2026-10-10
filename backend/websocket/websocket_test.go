package websocket

import (
	"testing"

	gorilla "github.com/gorilla/websocket"
)

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

func TestHandleReadyStatusRejectsWithoutRole(t *testing.T) {
	conn := &gorilla.Conn{}
	client := &Client{
		UserID:   "user-1",
		Username: "Alice",
		Role:     "",
		Ready:    false,
	}
	room := &Room{
		Clients: map[*gorilla.Conn]*Client{
			conn: client,
		},
	}

	readyTrue := true
	handleReadyStatus(room, conn, Message{Type: "ready", Ready: &readyTrue}, "room-1")

	if client.Ready {
		t.Fatalf("expected client.Ready to remain false when client has no role")
	}
}

func TestHandleReadyStatusAllowsWithRole(t *testing.T) {
	conn := &gorilla.Conn{}
	client := &Client{
		UserID:   "user-1",
		Username: "Alice",
		Role:     "for",
		Ready:    false,
	}
	room := &Room{
		Clients: map[*gorilla.Conn]*Client{
			conn: client,
		},
	}

	readyTrue := true
	handleReadyStatus(room, conn, Message{Type: "ready", Ready: &readyTrue}, "room-1")

	if !client.Ready {
		t.Fatalf("expected client.Ready to be true when client has role 'for'")
	}

	readyFalse := false
	handleReadyStatus(room, conn, Message{Type: "ready", Ready: &readyFalse}, "room-1")

	if client.Ready {
		t.Fatalf("expected client.Ready to be false after unready")
	}
}

func TestHandleRoleSelectionResetsReadyStatus(t *testing.T) {
	conn := &gorilla.Conn{}
	client := &Client{
		UserID:   "user-1",
		Username: "Alice",
		Role:     "for",
		Ready:    true,
	}
	room := &Room{
		Clients: map[*gorilla.Conn]*Client{
			conn: client,
		},
	}

	handleRoleSelection(room, conn, Message{Type: "roleSelection", Role: "against"}, "room-1")

	if client.Role != "against" {
		t.Fatalf("expected client.Role to be 'against', got %s", client.Role)
	}
	if client.Ready {
		t.Fatalf("expected client.Ready to be reset to false after changing role")
	}
}
