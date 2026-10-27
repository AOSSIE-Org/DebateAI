package websocket

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"arguehub/internal/debate"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var debateUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// DebateHub manages WebSocket connections for spectators
type DebateHub struct {
	debates map[string]*DebateRoom
	mu      sync.RWMutex
}

// DebateRoom holds connections for a specific debate
type DebateRoom struct {
	debateID string
	clients  map[*websocket.Conn]*SpectatorClient
	mu       sync.RWMutex
	consumer *debate.StreamConsumer

	// presenceMu orders the client-count read with the enqueue below, so count
	// changes are broadcast in the order they happened. It is only ever held for
	// bookkeeping, never across a network write, so a stalled spectator cannot
	// delay joins or departures. A per-room goroutine drains presenceQueue.
	presenceMu    sync.Mutex
	presenceQueue []int
	presenceWake  chan struct{}
}

// SpectatorClient represents a connected spectator
type SpectatorClient struct {
	conn          *websocket.Conn
	writeMu       sync.Mutex
	spectatorHash string
	lastEventID   string
	debateID      string
}

// NewDebateHub creates a new DebateHub
func NewDebateHub() *DebateHub {
	hub := &DebateHub{
		debates: make(map[string]*DebateRoom),
	}
	return hub
}

// Register registers a new WebSocket connection for a debate
func (h *DebateHub) Register(debateID string, conn *websocket.Conn, spectatorHash string) *SpectatorClient {
	// Create/look up the room under h.mu, then release it before any broadcast.
	h.mu.Lock()
	room, exists := h.debates[debateID]
	if !exists {
		room = &DebateRoom{
			debateID:     debateID,
			clients:      make(map[*websocket.Conn]*SpectatorClient),
			consumer:     debate.NewStreamConsumer(h),
			presenceWake: make(chan struct{}, 1),
		}
		h.debates[debateID] = room

		// Start consumer group for this debate (only if Redis is available)
		if room.consumer != nil {
			go room.consumer.StartConsumerGroup(debateID)
		}

		// Serialize presence broadcasts for this room off the request path.
		go h.presenceBroadcaster(room)
	}
	h.mu.Unlock()

	client := &SpectatorClient{
		conn:          conn,
		spectatorHash: spectatorHash,
		debateID:      debateID,
	}

	// Assign the count and enqueue it atomically (under presenceMu) so concurrent
	// joins are broadcast in order, then release the lock before any network
	// write happens on the room's broadcaster goroutine.
	room.presenceMu.Lock()
	room.mu.Lock()
	room.clients[conn] = client
	clientCount := len(room.clients)
	room.mu.Unlock()
	room.enqueuePresence(clientCount)
	room.presenceMu.Unlock()

	return client
}

// Unregister removes a WebSocket connection
func (h *DebateHub) Unregister(debateID string, conn *websocket.Conn) {
	h.mu.RLock()
	room, exists := h.debates[debateID]
	h.mu.RUnlock()

	if !exists {
		return
	}

	// Assign the count and enqueue it atomically (under presenceMu) so concurrent
	// departures are broadcast in order, then release the lock before any network
	// write happens on the room's broadcaster goroutine.
	room.presenceMu.Lock()
	room.mu.Lock()
	delete(room.clients, conn)
	clientCount := len(room.clients)
	room.mu.Unlock()
	room.enqueuePresence(clientCount)
	room.presenceMu.Unlock()
}

// enqueuePresence appends a count to the room's broadcast queue. Callers must
// hold presenceMu so counts are queued in the order they were computed. The wake
// send is non-blocking: a pending wake already guarantees the broadcaster will
// drain the queue.
func (room *DebateRoom) enqueuePresence(count int) {
	room.presenceQueue = append(room.presenceQueue, count)
	select {
	case room.presenceWake <- struct{}{}:
	default:
	}
}

// presenceBroadcaster drains queued counts for a room and broadcasts them in
// order. It holds presenceMu only to dequeue, never during a network write, so a
// stalled spectator cannot delay joins or departures for the debate.
func (h *DebateHub) presenceBroadcaster(room *DebateRoom) {
	for range room.presenceWake {
		for {
			room.presenceMu.Lock()
			if len(room.presenceQueue) == 0 {
				room.presenceMu.Unlock()
				break
			}
			count := room.presenceQueue[0]
			room.presenceQueue[0] = 0
			room.presenceQueue = room.presenceQueue[1:]
			if len(room.presenceQueue) == 0 {
				room.presenceQueue = nil
			}
			room.presenceMu.Unlock()

			h.broadcastPresence(room.debateID, count)
		}
	}
}

// broadcastPresence sends a presence update with the current client count.
func (h *DebateHub) broadcastPresence(debateID string, clientCount int) {
	presenceEvent := map[string]interface{}{
		"type": "presence",
		"payload": map[string]interface{}{
			"connected": clientCount,
		},
		"timestamp": time.Now().Unix(),
	}
	h.BroadcastPresence(debateID, presenceEvent)
}

// clientsSnapshot returns a snapshot of the clients in a debate room. Callers
// must write to the returned slice after releasing all locks, so a slow or
// stalled spectator cannot block Register/Unregister, which take room.mu's
// write lock.
func (h *DebateHub) clientsSnapshot(debateID string) []*SpectatorClient {
	h.mu.RLock()
	room, exists := h.debates[debateID]
	h.mu.RUnlock()

	if !exists {
		return nil
	}

	room.mu.RLock()
	clients := make([]*SpectatorClient, 0, len(room.clients))
	for _, client := range room.clients {
		clients = append(clients, client)
	}
	room.mu.RUnlock()

	return clients
}

// BroadcastToDebate broadcasts an event to all connected clients for a debate
func (h *DebateHub) BroadcastToDebate(debateID string, event *debate.Event) {
	clients := h.clientsSnapshot(debateID)

	// Convert event to frontend format - parse payload
	var payload interface{}
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		// If unmarshal fails, use raw payload
		payload = json.RawMessage(event.Payload)
	}

	eventData := map[string]interface{}{
		"type":      event.Type,
		"payload":   payload,
		"timestamp": event.Timestamp,
	}

	// Broadcast to all clients
	for _, client := range clients {
		if err := client.WriteJSON(eventData); err != nil {
		}
	}
}

// BroadcastPresence broadcasts a presence update directly
func (h *DebateHub) BroadcastPresence(debateID string, presenceEvent map[string]interface{}) {
	// Broadcast to all clients
	for _, client := range h.clientsSnapshot(debateID) {
		if err := client.WriteJSON(presenceEvent); err != nil {
		}
	}
}

// WriteJSON safely writes JSON to the WebSocket connection. A finite write
// deadline bounds how long a stalled spectator can block the writer, so it
// cannot hold up presence updates for the debate indefinitely.
func (c *SpectatorClient) WriteJSON(v interface{}) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return c.conn.WriteJSON(v)
}

// DebateWebsocketHandler handles WebSocket connections for debate spectators
func DebateWebsocketHandler(c *gin.Context) {
	debateID := c.Param("debateID")

	if debateID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "debateID is required"})
		return
	}

	// Upgrade connection
	conn, err := debateUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// Get or generate spectator hash
	spectatorID := c.Query("spectatorId")

	var spectatorHash string
	if spectatorID != "" {
		// Hash the spectator ID
		h := sha256.Sum256([]byte(spectatorID))
		spectatorHash = hex.EncodeToString(h[:])
	} else {
		// Generate ephemeral ID
		ephemeralID := uuid.New().String()
		h := sha256.Sum256([]byte(ephemeralID))
		spectatorHash = hex.EncodeToString(h[:])
	}

	// Register client
	hub := GetDebateHub()
	client := hub.Register(debateID, conn, spectatorHash)
	defer hub.Unregister(debateID, conn)

	// Send initial poll snapshot
	snapshot, err := loadPollSnapshot(debateID)
	if err == nil && snapshot != nil {
		client.WriteJSON(snapshot)
	} else if err != nil {
	}

	// Presence counts are delivered by the hub's per-room broadcaster (Register
	// enqueues the initial count), so no separate presence send is needed here.

	// Read pump
	go readPump(client, hub)

	// Keep connection alive
	select {}
}

// readPump handles incoming messages from client
func readPump(client *SpectatorClient, hub *DebateHub) {
	defer client.conn.Close()

	for {
		_, messageBytes, err := client.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
			} else {
			}
			break
		}

		// Parse client message
		var clientMsg debate.ClientMessage
		if err := json.Unmarshal(messageBytes, &clientMsg); err != nil {
			continue
		}

		// Handle different message types
		switch clientMsg.Type {
		case "join":
		case "vote":
			handleVote(client, clientMsg.Payload)
		case "question":
			handleQuestion(client, clientMsg.Payload)
		case "reaction":
			handleReaction(client, clientMsg.Payload)
		case "createPoll", "create_poll":
			handleCreatePoll(client, clientMsg.Payload)
		default:
		}
	}
}

// handleVote handles a vote request
func handleVote(client *SpectatorClient, payloadBytes []byte) {
	var payload debate.VotePayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return
	}

	// Set spectator hash and timestamp
	payload.SpectatorHash = client.spectatorHash
	if payload.ClientEventID == "" {
		payload.ClientEventID = uuid.New().String()
	}
	payload.Timestamp = time.Now().Unix()

	// Check rate limit
	rateLimiter := debate.NewRateLimiter()
	canVote, err := rateLimiter.CheckVoteRateLimit(client.debateID, payload.PollID, client.spectatorHash)
	if err != nil || !canVote {
		return
	}

	// Process vote
	store := debate.NewPollStore()
	success, err := store.Vote(client.debateID, payload.PollID, payload.Option, client.spectatorHash)
	if err != nil {
		return
	}

	if !success {
		return
	}

	// Get hub to broadcast
	hub := GetDebateHub()

	// Create event for broadcasting (in frontend format)
	voteEvent := map[string]interface{}{
		"type":      "vote",
		"payload":   payload,
		"timestamp": payload.Timestamp,
	}

	// Broadcast directly to all connected clients
	for _, c := range hub.clientsSnapshot(client.debateID) {
		c.WriteJSON(voteEvent)
	}

	// Also publish to stream for persistence (if Redis is available)
	event, err := debate.NewEvent("vote", payload)
	if err == nil {
		debate.PublishEvent(client.debateID, event) // Ignore error if Redis unavailable
	}
}

// handleQuestion handles a question request
func handleQuestion(client *SpectatorClient, payloadBytes []byte) {
	var payload debate.QuestionPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return
	}

	// Set spectator hash and timestamp
	payload.SpectatorHash = client.spectatorHash
	if payload.QID == "" {
		payload.QID = uuid.New().String()
	}
	payload.Timestamp = time.Now().Unix()

	// Check rate limit
	rateLimiter := debate.NewRateLimiter()
	config := debate.DefaultRateLimitConfig()
	canAsk, err := rateLimiter.CheckQuestionRateLimit(client.debateID, client.spectatorHash, config)
	if err != nil || !canAsk {
		return
	}

	// Record rate limit
	rateLimiter.RecordQuestion(client.debateID, client.spectatorHash, config)

	// Get hub to broadcast
	hub := GetDebateHub()

	// Create event for broadcasting (in frontend format)
	questionEvent := map[string]interface{}{
		"type":      "question",
		"payload":   payload,
		"timestamp": payload.Timestamp,
	}

	// Broadcast directly to all connected clients
	for _, c := range hub.clientsSnapshot(client.debateID) {
		if err := c.WriteJSON(questionEvent); err != nil {
		}
	}

	// Also publish to stream for persistence (if Redis is available)
	event, err := debate.NewEvent("question", payload)
	if err == nil {
		debate.PublishEvent(client.debateID, event) // Ignore error if Redis unavailable
	}
}

// handleReaction handles a reaction request
func handleReaction(client *SpectatorClient, payloadBytes []byte) {
	var payload debate.ReactionPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return
	}

	// Set spectator hash and timestamp
	payload.SpectatorHash = client.spectatorHash
	payload.Timestamp = time.Now().Unix()

	// Check rate limit
	rateLimiter := debate.NewRateLimiter()
	config := debate.DefaultRateLimitConfig()
	canReact, err := rateLimiter.CheckReactionRateLimit(client.debateID, client.spectatorHash, config)
	if err != nil || !canReact {
		return
	}

	// Record rate limit
	rateLimiter.RecordReaction(client.debateID, client.spectatorHash, config)

	// Get hub to broadcast
	hub := GetDebateHub()

	// Create event for broadcasting (in frontend format)
	reactionEvent := map[string]interface{}{
		"type":      "reaction",
		"payload":   payload,
		"timestamp": payload.Timestamp,
	}

	// Broadcast directly to all connected clients
	for _, c := range hub.clientsSnapshot(client.debateID) {
		c.WriteJSON(reactionEvent)
	}

	// Also publish to stream for persistence (if Redis is available)
	event, err := debate.NewEvent("reaction", payload)
	if err == nil {
		debate.PublishEvent(client.debateID, event) // Ignore error if Redis unavailable
	}
}

// handleCreatePoll handles a poll creation request
func handleCreatePoll(client *SpectatorClient, payloadBytes []byte) {
	var payload debate.CreatePollPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return
	}

	payload.SpectatorHash = client.spectatorHash
	payload.Timestamp = time.Now().Unix()

	store := debate.NewPollStore()
	if store == nil {
		return
	}

	pollID, err := store.CreatePoll(client.debateID, payload.PollID, payload.Question, payload.Options)
	if err != nil {
		return
	}

	// Load current snapshot for counts/metadata
	snapshot, err := loadPollSnapshot(client.debateID)
	if err != nil {
		// Even if snapshot fails, continue with created event
	}

	// Determine created poll data for event
	var createdPoll map[string]interface{}
	if snapshot != nil {
		if payloadMap, ok := snapshot["payload"].(map[string]interface{}); ok {
			if pollsRaw, ok := payloadMap["polls"].([]interface{}); ok {
				for _, p := range pollsRaw {
					if pollObj, ok := p.(map[string]interface{}); ok {
						if id, ok := pollObj["pollId"].(string); ok && id == pollID {
							createdPoll = pollObj
							break
						}
					}
				}
			}
		}
	}

	if createdPoll == nil {
		// Fallback payload
		createdPoll = map[string]interface{}{
			"pollId":   pollID,
			"question": payload.Question,
			"options":  payload.Options,
			"counts":   map[string]int64{},
			"voters":   int64(0),
		}
	}

	createdEvent := map[string]interface{}{
		"type":      "poll_created",
		"payload":   createdPoll,
		"timestamp": payload.Timestamp,
	}

	hub := GetDebateHub()
	for _, c := range hub.clientsSnapshot(client.debateID) {
		c.WriteJSON(createdEvent)
		if snapshot != nil {
			c.WriteJSON(snapshot)
		}
	}

	// Publish event for persistence
	eventPayload := debate.PollCreatedPayload{
		PollID:    pollID,
		Question:  payload.Question,
		Options:   payload.Options,
		Timestamp: payload.Timestamp,
	}
	event, err := debate.NewEvent("poll_created", eventPayload)
	if err == nil {
		debate.PublishEvent(client.debateID, event)
	}
}

// loadPollSnapshot loads the current poll state from Redis
func loadPollSnapshot(debateID string) (map[string]interface{}, error) {
	store := debate.NewPollStore()
	pollState, votersCount, metadata, err := store.GetPollState(debateID)
	if err != nil {
		return nil, err
	}

	polls := make([]map[string]interface{}, 0, len(pollState))
	for pollID, counts := range pollState {
		meta := metadata[pollID]
		poll := map[string]interface{}{
			"pollId":   pollID,
			"question": meta.Question,
			"options":  meta.Options,
			"counts":   counts,
			"voters":   votersCount[pollID],
		}
		polls = append(polls, poll)
	}

	snapshot := map[string]interface{}{
		"type": "poll_snapshot",
		"payload": map[string]interface{}{
			"pollState":   pollState,
			"votersCount": votersCount,
			"polls":       polls,
		},
		"timestamp": time.Now().Unix(),
	}

	return snapshot, nil
}

// GetDebateHub returns the global DebateHub instance
var globalHub *DebateHub
var hubOnce sync.Once

func GetDebateHub() *DebateHub {
	hubOnce.Do(func() {
		globalHub = NewDebateHub()
	})
	return globalHub
}
