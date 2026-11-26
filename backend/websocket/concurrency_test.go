package websocket

import (
	"fmt"
	"sync"
	"testing"

	gorilla "github.com/gorilla/websocket"
)

func TestSnapshotRecipientsAndCounts(t *testing.T) {
	debaterA := &gorilla.Conn{}
	debaterB := &gorilla.Conn{}
	spectator := &gorilla.Conn{}
	room := &Room{
		Clients: map[*gorilla.Conn]*Client{
			debaterA:  {UserID: "a", IsSpectator: false},
			debaterB:  {UserID: "b", IsSpectator: false},
			spectator: {UserID: "s", IsSpectator: true},
		},
	}

	recipients := snapshotRecipients(room, debaterA)
	if len(recipients) != 2 {
		t.Fatalf("recipients = %d, want 2", len(recipients))
	}
	for _, client := range recipients {
		if client.UserID == "a" {
			t.Fatal("snapshot included the excluded connection")
		}
	}

	debatersOnly := nonSpectatorRecipients(room, nil)
	if len(debatersOnly) != 2 {
		t.Fatalf("non-spectators = %d, want 2", len(debatersOnly))
	}
	for _, client := range debatersOnly {
		if client.IsSpectator {
			t.Fatal("nonSpectatorRecipients included a spectator")
		}
	}
	if countDebaters(room) != 2 {
		t.Fatalf("debaters = %d", countDebaters(room))
	}
	if countSpectators(room) != 1 {
		t.Fatalf("spectators = %d", countSpectators(room))
	}
}

func TestNextDebatePhaseOrder(t *testing.T) {
	current := ""
	for _, want := range debatePhaseOrder {
		next, ok := nextDebatePhase(current)
		if !ok || next != want {
			t.Fatalf("nextDebatePhase(%q) = %q, %v; want %q", current, next, ok, want)
		}
		current = next
	}
	if next, ok := nextDebatePhase(current); ok || next != "" {
		t.Fatalf("terminal phase returned %q, %v", next, ok)
	}
	if next, ok := nextDebatePhase("not-a-phase"); ok || next != "" {
		t.Fatalf("unknown phase returned %q, %v", next, ok)
	}
}

func TestRoomSnapshotConcurrentWithMembershipChanges(t *testing.T) {
	room := &Room{Clients: make(map[*gorilla.Conn]*Client)}
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		for i := 0; i < 200; i++ {
			conn := &gorilla.Conn{}
			room.Mutex.Lock()
			room.Clients[conn] = &Client{UserID: fmt.Sprintf("user-%d", i), IsSpectator: i%2 == 0}
			if len(room.Clients) > 20 {
				for existing := range room.Clients {
					delete(room.Clients, existing)
					break
				}
			}
			room.Mutex.Unlock()
		}
	}()

	go func() {
		defer wg.Done()
		for i := 0; i < 200; i++ {
			_ = snapshotRecipients(room, nil)
			_ = nonSpectatorRecipients(room, nil)
			_ = countDebaters(room)
			_ = countSpectators(room)
		}
	}()

	wg.Wait()
	_ = snapshotRecipients(room, nil)
}
