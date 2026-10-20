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

func TestDebateStartErrorLockedRequiresReadyOppositeRoles(t *testing.T) {
	for _, test := range []struct {
		name    string
		clients map[*gorilla.Conn]*Client
		wantErr bool
	}{
		{
			name: "ready debaters with opposite roles",
			clients: map[*gorilla.Conn]*Client{
				&gorilla.Conn{}: {Role: "for", Ready: true},
				&gorilla.Conn{}: {Role: "against", Ready: true},
			},
		},
		{
			name: "debater is not ready",
			clients: map[*gorilla.Conn]*Client{
				&gorilla.Conn{}: {Role: "for", Ready: true},
				&gorilla.Conn{}: {Role: "against"},
			},
			wantErr: true,
		},
		{
			name: "both selected the same role",
			clients: map[*gorilla.Conn]*Client{
				&gorilla.Conn{}: {Role: "for", Ready: true},
				&gorilla.Conn{}: {Role: "for", Ready: true},
			},
			wantErr: true,
		},
		{
			name: "a debater has not selected a role",
			clients: map[*gorilla.Conn]*Client{
				&gorilla.Conn{}: {Role: "for", Ready: true},
				&gorilla.Conn{}: {Ready: true},
			},
			wantErr: true,
		},
		{
			name: "spectators are not counted as debaters",
			clients: map[*gorilla.Conn]*Client{
				&gorilla.Conn{}: {Role: "for", Ready: true},
				&gorilla.Conn{}: {Role: "against", Ready: true},
				&gorilla.Conn{}: {IsSpectator: true},
			},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			room := &Room{Clients: test.clients}
			err := debateStartErrorLocked(room)
			if (err != nil) != test.wantErr {
				t.Fatalf("debateStartErrorLocked() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}
