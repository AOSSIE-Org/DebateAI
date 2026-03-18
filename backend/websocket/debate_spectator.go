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
	return &DebateHub{
		debates: make(map[string]*DebateRoom),
	}
}

// Register registers a new WebSocket connection for a debate
func (h *DebateHub) Register(debateID string, conn *websocket.Conn, spectatorHash string) *SpectatorClient {
	h.mu.Lock()
	defer h.mu.Unlock()

	room, exists := h.debates[debateID]
	if !exists {
		room = &DebateRoom{
			debateID: debateID,
			clients:  make(map[*websocket.Conn]*SpectatorClient),
			consumer: debate.NewStreamConsumer(h),
		}
		h.debates[debateID] = room

		if room.consumer != nil {
			go room.consumer.StartConsumerGroup(debateID)
		}
	}

	client := &SpectatorClient{
		conn:          conn,
		spectatorHash: spectatorHash,
		debateID:      debateID,
	}

	room.mu.Lock()
	room.clients[conn] = client
	clientCount := len(room.clients)
	room.mu.Unlock()

	h.BroadcastPresence(debateID, map[string]interface{}{
		"type": "presence",
		"payload": map[string]interface{}{
			"connected": clientCount,
		},
		"timestamp": time.Now().Unix(),
	})

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

	room.mu.Lock()
	delete(room.clients, conn)
	clientCount := len(room.clients)
	room.mu.Unlock()

	h.BroadcastPresence(debateID, map[string]interface{}{
		"type": "presence",
		"payload": map[string]interface{}{
			"connected": clientCount,
		},
		"timestamp": time.Now().Unix(),
	})
}

// BroadcastToDebate broadcasts an event to all connected clients for a debate
func (h *DebateHub) BroadcastToDebate(debateID string, event *debate.Event) {
	h.mu.RLock()
	room, exists := h.debates[debateID]
	h.mu.RUnlock()

	if !exists {
		return
	}

	room.mu.RLock()
	clients := make([]*SpectatorClient, 0, len(room.clients))
	for _, client := range room.clients {
		clients = append(clients, client)
	}
	room.mu.RUnlock()

	var payload interface{}
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		payload = json.RawMessage(event.Payload)
	}

	eventData := map[string]interface{}{
		"type":      event.Type,
		"payload":   payload,
		"timestamp": event.Timestamp,
	}

	for _, client := range clients {
		if err := client.WriteJSON(eventData); err != nil {
		}
	}
}

// BroadcastPresence broadcasts a presence update directly
func (h *DebateHub) BroadcastPresence(debateID string, presenceEvent map[string]interface{}) {
	h.mu.RLock()
	room, exists := h.debates[debateID]
	h.mu.RUnlock()

	if !exists {
		return
	}

	room.mu.RLock()
	clients := make([]*SpectatorClient, 0, len(room.clients))
	for _, client := range room.clients {
		clients = append(clients, client)
	}
	room.mu.RUnlock()

	for _, client := range clients {
		if err := client.WriteJSON(presenceEvent); err != nil {
		}
	}
}

// WriteJSON safely writes JSON to the WebSocket connection
func (c *SpectatorClient) WriteJSON(v interface{}) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.conn.WriteJSON(v)
}

// DebateWebsocketHandler handles WebSocket connections for debate spectators
func DebateWebsocketHandler(c *gin.Context) {
	debateID := c.Param("debateID")

	if debateID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "debateID is required"})
		return
	}

	conn, err := debateUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	spectatorID := c.Query("spectatorId")

	var spectatorHash string
	if spectatorID != "" {
		h := sha256.Sum256([]byte(spectatorID))
		spectatorHash = hex.EncodeToString(h[:])
	} else {
		ephemeralID := uuid.New().String()
		h := sha256.Sum256([]byte(ephemeralID))
		spectatorHash = hex.EncodeToString(h[:])
	}

	hub := GetDebateHub()
	client := hub.Register(debateID, conn, spectatorHash)
	defer hub.Unregister(debateID, conn)

	snapshot, err := loadPollSnapshot(debateID)
	if err == nil && snapshot != nil {
		conn.WriteJSON(snapshot)
	}

	hub.mu.RLock()
	room, exists := hub.debates[debateID]
	clientCount := 0
	if exists {
		room.mu.RLock()
		clientCount = len(room.clients)
		room.mu.RUnlock()
	}
	hub.mu.RUnlock()

	conn.WriteJSON(map[string]interface{}{
		"type": "presence",
		"payload": map[string]interface{}{
			"connected": clientCount,
		},
		"timestamp": time.Now().Unix(),
	})

	// ✅ FIX: removed unused `hub` param — readPump only needs client
	go readPump(client)

	select {}
}

// readPump handles incoming messages from client
// hub param removed — not used inside the pump; handlers call GetDebateHub() directly
func readPump(client *SpectatorClient) {
	defer client.conn.Close()

	for {
		_, messageBytes, err := client.conn.ReadMessage()
		if err != nil {
			break
		}

		var clientMsg debate.ClientMessage
		if err := json.Unmarshal(messageBytes, &clientMsg); err != nil {
			continue
		}

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

	payload.SpectatorHash = client.spectatorHash
	if payload.ClientEventID == "" {
		payload.ClientEventID = uuid.New().String()
	}
	payload.Timestamp = time.Now().Unix()

	rateLimiter := debate.NewRateLimiter()
	canVote, err := rateLimiter.CheckVoteRateLimit(client.debateID, payload.PollID, client.spectatorHash)
	if err != nil || !canVote {
		return
	}

	store := debate.NewPollStore()
	success, err := store.Vote(client.debateID, payload.PollID, payload.Option, client.spectatorHash)
	if err != nil || !success {
		return
	}

	hub := GetDebateHub()
	voteEvent := map[string]interface{}{
		"type":      "vote",
		"payload":   payload,
		"timestamp": payload.Timestamp,
	}

	hub.mu.RLock()
	room, exists := hub.debates[client.debateID]
	if exists {
		room.mu.RLock()
		for _, c := range room.clients {
			c.WriteJSON(voteEvent)
		}
		room.mu.RUnlock()
	}
	hub.mu.RUnlock()

	event, err := debate.NewEvent("vote", payload)
	if err == nil {
		debate.PublishEvent(client.debateID, event)
	}
}

// handleQuestion handles a question request
func handleQuestion(client *SpectatorClient, payloadBytes []byte) {
	var payload debate.QuestionPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return
	}

	payload.SpectatorHash = client.spectatorHash
	if payload.QID == "" {
		payload.QID = uuid.New().String()
	}
	payload.Timestamp = time.Now().Unix()

	rateLimiter := debate.NewRateLimiter()
	config := debate.DefaultRateLimitConfig()
	canAsk, err := rateLimiter.CheckQuestionRateLimit(client.debateID, client.spectatorHash, config)
	if err != nil || !canAsk {
		return
	}

	rateLimiter.RecordQuestion(client.debateID, client.spectatorHash, config)

	hub := GetDebateHub()
	questionEvent := map[string]interface{}{
		"type":      "question",
		"payload":   payload,
		"timestamp": payload.Timestamp,
	}

	hub.mu.RLock()
	room, exists := hub.debates[client.debateID]
	if exists {
		room.mu.RLock()
		for _, c := range room.clients {
			if err := c.WriteJSON(questionEvent); err != nil {
			}
		}
		room.mu.RUnlock()
	}
	hub.mu.RUnlock()

	event, err := debate.NewEvent("question", payload)
	if err == nil {
		debate.PublishEvent(client.debateID, event)
	}
}

// handleReaction handles a reaction request
func handleReaction(client *SpectatorClient, payloadBytes []byte) {
	var payload debate.ReactionPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return
	}

	payload.SpectatorHash = client.spectatorHash
	payload.Timestamp = time.Now().Unix()

	rateLimiter := debate.NewRateLimiter()
	config := debate.DefaultRateLimitConfig()
	canReact, err := rateLimiter.CheckReactionRateLimit(client.debateID, client.spectatorHash, config)
	if err != nil || !canReact {
		return
	}

	rateLimiter.RecordReaction(client.debateID, client.spectatorHash, config)

	hub := GetDebateHub()
	reactionEvent := map[string]interface{}{
		"type":      "reaction",
		"payload":   payload,
		"timestamp": payload.Timestamp,
	}

	hub.mu.RLock()
	room, exists := hub.debates[client.debateID]
	if exists {
		room.mu.RLock()
		for _, c := range room.clients {
			c.WriteJSON(reactionEvent)
		}
		room.mu.RUnlock()
	}
	hub.mu.RUnlock()

	event, err := debate.NewEvent("reaction", payload)
	if err == nil {
		debate.PublishEvent(client.debateID, event)
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

	snapshot, _ := loadPollSnapshot(client.debateID)

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
	hub.mu.RLock()
	room, exists := hub.debates[client.debateID]
	if exists {
		room.mu.RLock()
		for _, c := range room.clients {
			c.WriteJSON(createdEvent)
			if snapshot != nil {
				c.WriteJSON(snapshot)
			}
		}
		room.mu.RUnlock()
	}
	hub.mu.RUnlock()

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
		polls = append(polls, map[string]interface{}{
			"pollId":   pollID,
			"question": meta.Question,
			"options":  meta.Options,
			"counts":   counts,
			"voters":   votersCount[pollID],
		})
	}

	return map[string]interface{}{
		"type": "poll_snapshot",
		"payload": map[string]interface{}{
			"pollState":   pollState,
			"votersCount": votersCount,
			"polls":       polls,
		},
		"timestamp": time.Now().Unix(),
	}, nil
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