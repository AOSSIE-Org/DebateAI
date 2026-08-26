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
