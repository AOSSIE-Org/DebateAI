package websocket

import (
	"fmt"
	"sync"
	"testing"
	"time"

	gorilla "github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRoomClientConcurrency validates thread-safe client registration and reads under Room mutex.
func TestRoomClientConcurrency(t *testing.T) {
	room := &Room{
		Clients: make(map[*gorilla.Conn]*Client),
	}

	concurrency := 50
	var wg sync.WaitGroup
	wg.Add(concurrency)

	for i := 0; i < concurrency; i++ {
		go func(id int) {
			defer wg.Done()

			conn := &gorilla.Conn{}
			client := &Client{
				Conn:     conn,
				UserID:   fmt.Sprintf("user-%d", id),
				Username: fmt.Sprintf("User%d", id),
				Email:    fmt.Sprintf("user%d@example.com", id),
			}

			// Safe registration under mutex
			room.Mutex.Lock()
			room.Clients[conn] = client
			room.Mutex.Unlock()

			// Safe read under mutex
			room.Mutex.Lock()
			_ = len(room.Clients)
			room.Mutex.Unlock()
		}(i)
	}

	wg.Wait()

	room.Mutex.Lock()
	assert.Equal(t, concurrency, len(room.Clients))
	room.Mutex.Unlock()
}

// TestRoomBroadcastSnapshotConcurrency verifies safe simultaneous participant modification and broadcast snapshotting.
func TestRoomBroadcastSnapshotConcurrency(t *testing.T) {
	room := &Room{
		Clients: make(map[*gorilla.Conn]*Client),
	}

	// Pre-populate with clients
	for i := 0; i < 50; i++ {
		room.Clients[&gorilla.Conn{}] = &Client{UserID: fmt.Sprintf("init-%d", i)}
	}

	var wg sync.WaitGroup
	wg.Add(2)

	// Routine 1: Continuously modifying participants
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			room.Mutex.Lock()
			room.Clients[&gorilla.Conn{}] = &Client{UserID: fmt.Sprintf("dynamic-%d", i)}
			room.Mutex.Unlock()
			time.Sleep(100 * time.Microsecond)
		}
	}()

	// Routine 2: Continuously taking snapshots of participants
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			room.Mutex.Lock()
			snapshot := make([]*Client, 0, len(room.Clients))
			for _, cl := range room.Clients {
				snapshot = append(snapshot, cl)
			}
			room.Mutex.Unlock()

			assert.NotEmpty(t, snapshot)
			time.Sleep(100 * time.Microsecond)
		}
	}()

	wg.Wait()
}

// TestDebateStateTransitions checks the sequential progression and termination across all debate phases.
func TestDebateStateTransitions(t *testing.T) {
	phases := debatePhaseOrder
	require.NotEmpty(t, phases)

	currentPhase := ""
	for i := 0; i < len(phases)-1; i++ {
		next, ok := nextDebatePhase(currentPhase)
		assert.True(t, ok)
		assert.Equal(t, phases[i], next)
		currentPhase = next
	}

	// From the last phase, transitions should end
	lastPhase := phases[len(phases)-1]
	next, ok := nextDebatePhase(lastPhase)
	assert.False(t, ok)
	assert.Empty(t, next)
}

// TestDebateStartErrorLocked asserts setup validation rules enforcing 2 opposing, ready debaters to start.
func TestDebateStartErrorLocked(t *testing.T) {
	conn1 := &gorilla.Conn{}
	conn2 := &gorilla.Conn{}

	t.Run("Fails_With_Less_Than_Two_Debaters", func(t *testing.T) {
		room := &Room{
			Clients: map[*gorilla.Conn]*Client{
				conn1: {UserID: "1", Role: "for", Ready: true},
			},
		}
		err := debateStartErrorLocked(room)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "two debaters")
	})

	t.Run("Fails_With_Same_Stance", func(t *testing.T) {
		room := &Room{
			Clients: map[*gorilla.Conn]*Client{
				conn1: {UserID: "1", Role: "for", Ready: true},
				conn2: {UserID: "2", Role: "for", Ready: true},
			},
		}
		err := debateStartErrorLocked(room)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "different stance")
	})

	t.Run("Fails_When_Debater_Not_Ready", func(t *testing.T) {
		room := &Room{
			Clients: map[*gorilla.Conn]*Client{
				conn1: {UserID: "1", Role: "for", Ready: true},
				conn2: {UserID: "2", Role: "against", Ready: false},
			},
		}
		err := debateStartErrorLocked(room)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "must be ready")
	})

	t.Run("Succeeds_When_Both_Debaters_Ready_With_Opposing_Stances", func(t *testing.T) {
		room := &Room{
			Clients: map[*gorilla.Conn]*Client{
				conn1: {UserID: "1", Role: "for", Ready: true},
				conn2: {UserID: "2", Role: "against", Ready: true},
			},
		}
		err := debateStartErrorLocked(room)
		assert.NoError(t, err)
	})
}
