package websocket

import (
	"sync"
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

// TestTryAddClientDoesNotExceedDebaterLimit verifies that concurrent debater
// join attempts cannot exceed the room's two-debater limit.
func TestTryAddClientDoesNotExceedDebaterLimit(t *testing.T) {
	room := &Room{
		Clients: make(map[*gorilla.Conn]*Client),
	}

	// Start with one debater already in the room.
	existingConn := &gorilla.Conn{}
	room.Clients[existingConn] = &Client{
		Conn:        existingConn,
		IsSpectator: false,
	}

	const attempts = 100

	var wg sync.WaitGroup
	var accepted int
	var acceptedMutex sync.Mutex

	for i := 0; i < attempts; i++ {
		wg.Add(1)

		go func() {
			defer wg.Done()

			conn := &gorilla.Conn{}
			client := &Client{
				Conn:        conn,
				IsSpectator: false,
			}

			if tryAddClient(room, conn, client) {
				acceptedMutex.Lock()
				accepted++
				acceptedMutex.Unlock()
			}
		}()
	}

	wg.Wait()

	if accepted != 1 {
		t.Fatalf("expected exactly one additional debater to be accepted, got %d", accepted)
	}

	if countDebaters(room) != 2 {
		t.Fatalf("expected room to contain exactly 2 debaters, got %d", countDebaters(room))
	}
}
