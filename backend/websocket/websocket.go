package websocket

import (
	"context"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"arguehub/db"
	"arguehub/services"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var upgrader = websocket.Upgrader{
	// In production, adjust the CheckOrigin function to allow only trusted origins.
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Room represents a debate room with connected clients.
type Room struct {
	Clients map[*websocket.Conn]*Client
	Mutex   sync.Mutex
}

// Client represents a connected client with user information
type Client struct {
	Conn         *websocket.Conn
	writeMu      sync.Mutex // Mutex for safe WebSocket writes
	UserID       string
	Username     string
	Email        string
	AvatarURL    string
	Elo          int
	IsSpectator  bool
	IsTyping     bool
	IsSpeaking   bool
	PartialText  string
	LastActivity time.Time
	IsMuted      bool   // New field to track mute status
	Role         string // New field to track debate role (for/against)
	SpeechText   string // New field to store speech text
	ConnectionID string
}

// SafeWriteJSON safely writes JSON data to the client's WebSocket connection
func (c *Client) SafeWriteJSON(v any) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.Conn.WriteJSON(v)
}

// SafeWriteMessage safely writes raw WebSocket messages to the client's connection
func (c *Client) SafeWriteMessage(messageType int, data []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.Conn.WriteMessage(messageType, data)
}

type Message struct {
	Type     string          `json:"type"`
	Room     string          `json:"room,omitempty"`
	Username string          `json:"username,omitempty"`
	UserID   string          `json:"userId,omitempty"`
	Content  string          `json:"content,omitempty"`
	Extra    json.RawMessage `json:"extra,omitempty"`
	// New fields for real-time communication
	IsTyping    bool   `json:"isTyping,omitempty"`
	IsSpeaking  bool   `json:"isSpeaking,omitempty"`
	PartialText string `json:"partialText,omitempty"`
	Timestamp   int64  `json:"timestamp,omitempty"`
	Mode        string `json:"mode,omitempty"` // 'type' or 'speak'
	// Debate-specific fields
	Phase string `json:"phase,omitempty"`
	Topic string `json:"topic,omitempty"`
	Role  string `json:"role,omitempty"`
	Ready *bool  `json:"ready,omitempty"`
	// New fields for automatic muting
	IsMuted        bool   `json:"isMuted,omitempty"`
	CurrentTurn    string `json:"currentTurn,omitempty"`    // "for" or "against"
	SpeechText     string `json:"speechText,omitempty"`     // Converted speech to text
	LiveTranscript string `json:"liveTranscript,omitempty"` // Live/interim transcript
}

type TypingIndicator struct {
	UserID      string `json:"userId"`
	Username    string `json:"username"`
	IsTyping    bool   `json:"isTyping"`
	IsSpeaking  bool   `json:"isSpeaking"`
	PartialText string `json:"partialText,omitempty"`
}

var rooms = make(map[string]*Room)
var roomsMutex sync.Mutex

// snapshotRecipients returns a slice of clients to send messages to, excluding the specified connection
func snapshotRecipients(room *Room, exclude *websocket.Conn) []*Client {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	out := make([]*Client, 0, len(room.Clients))
	for cc, cl := range room.Clients {
		if cc == exclude {
			continue
		}
		out = append(out, cl)
	}
	return out
}

func nonSpectatorRecipients(room *Room, exclude *websocket.Conn) []*Client {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	out := make([]*Client, 0, len(room.Clients))
	for cc, cl := range room.Clients {
		if (exclude != nil && cc == exclude) || cl.IsSpectator {
			continue
		}
		out = append(out, cl)
	}
	return out
}

func countDebaters(room *Room) int {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	count := 0
	for _, cl := range room.Clients {
		if !cl.IsSpectator {
			count++
		}
	}
	return count
}

func countSpectators(room *Room) int {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	count := 0
	for _, cl := range room.Clients {
		if cl.IsSpectator {
			count++
		}
	}
	return count
}

func buildParticipantsMessage(room *Room) map[string]interface{} {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()

	participants := make([]map[string]interface{}, 0, len(room.Clients))
	spectatorCount := 0

	for _, client := range room.Clients {
		if client.IsSpectator {
			spectatorCount++
			continue
		}

		participants = append(participants, map[string]interface{}{
			"id":          client.UserID,
			"displayName": client.Username,
			"email":       client.Email,
			"role":        client.Role,
			"isMuted":     client.IsMuted,
		})
	}

	message := map[string]interface{}{
		"type":             "roomParticipants",
		"roomParticipants": participants,
		"spectatorCount":   spectatorCount,
	}

	return message
}

func broadcastParticipants(room *Room) {
	message := buildParticipantsMessage(room)
	for _, client := range snapshotRecipients(room, nil) {
		if err := client.SafeWriteJSON(message); err != nil {
			log.Printf("Error broadcasting participants to %s: %v", client.Email, err)
		}
	}
}

func notifySpectatorStatus(room *Room, spectator *Client, joined bool) {
	if spectator == nil {
		return
	}

	messageType := "spectatorJoined"
	if !joined {
		messageType = "spectatorLeft"
	}

	status := map[string]interface{}{
		"type": messageType,
		"spectator": map[string]interface{}{
			"connectionId":         spectator.ConnectionID,
			"spectatorUserId":      spectator.UserID,
			"spectatorDisplayName": spectator.Username,
		},
		"spectatorCount": countSpectators(room),
	}

	for _, client := range nonSpectatorRecipients(room, nil) {
		if err := client.SafeWriteJSON(status); err != nil {
			log.Printf("Error notifying spectator status to %s: %v", client.Email, err)
		}
	}
}

func broadcastRawToDebaters(room *Room, exclude *websocket.Conn, payload []byte) {
	recipients := nonSpectatorRecipients(room, exclude)
	for _, client := range recipients {
		if err := client.SafeWriteMessage(websocket.TextMessage, payload); err != nil {
			log.Printf("Error broadcasting raw to %s: %v", client.Email, err)
		}
	}
}

// WebsocketHandler handles WebSocket connections for debate signaling.
func WebsocketHandler(c *gin.Context) {

	authz := c.GetHeader("Authorization")
	token := strings.TrimPrefix(authz, "Bearer ")
	if token == "" {
		token = c.Query("token")
	} else {
	}

	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
		return
	}

	// Validate token
	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}
	if !valid || email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	roomID := c.Query("room")
	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing room parameter"})
		return
	}

	// Get user details from database
	userID, username, avatarURL, rating, err := getUserDetails(email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user details"})
		return
	}

	// Create the room if it doesn't exist.
	roomsMutex.Lock()
	if _, exists := rooms[roomID]; !exists {
		rooms[roomID] = &Room{Clients: make(map[*websocket.Conn]*Client)}
	}
	room := rooms[roomID]
	roomsMutex.Unlock()

	// Upgrade the connection.
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	// Check if this is a spectator connection (they want to receive video streams)
	// Allow spectators to connect even if room has 2 debaters
	isSpectator := strings.EqualFold(c.Query("spectator"), "true")
	room.Mutex.Lock()
	currentDebaters := 0
	for _, existing := range room.Clients {
		if !existing.IsSpectator {
			currentDebaters++
		}
	}
	maxDebaters := 2
	if !isSpectator && currentDebaters >= maxDebaters {
		room.Mutex.Unlock()
		log.Printf("[ws] rejecting debater %s for room %s: already full", email, roomID)
		conn.Close()
		return
	}
	room.Mutex.Unlock()

	if avatarURL == "" {
		avatarURL = "https://avatar.iran.liara.run/public/31"
	}
	if rating == 0 {
		rating = 1500
	}

	// Create client instance
	client := &Client{
		Conn:         conn,
		UserID:       userID,
		Username:     username,
		Email:        email,
		AvatarURL:    avatarURL,
		Elo:          rating,
		IsSpectator:  isSpectator,
		IsTyping:     false,
		IsSpeaking:   false,
		PartialText:  "",
		LastActivity: time.Now(),
		IsMuted:      false,
		Role:         "",
		SpeechText:   "",
	}

	if isSpectator {
		client.Role = "spectator"
		client.ConnectionID = uuid.New().String()
	}

	// Mark as spectator if needed (we can add a field to Client struct for this)
	// For now, we'll handle it through the message handlers

	// Send current participants to the new client
	room.Mutex.Lock()
	room.Clients[conn] = client
	room.Mutex.Unlock()

	// Send participants list to newly connected client
	participantsMsg := buildParticipantsMessage(room)
	client.SafeWriteJSON(participantsMsg)

	// Send existing participants' detailed info to the new client
	for connRef, existing := range room.Clients {
		payload := map[string]interface{}{
			"id":          existing.UserID,
			"username":    existing.Username,
			"displayName": existing.Username,
			"email":       existing.Email,
			"avatarUrl":   existing.AvatarURL,
			"elo":         existing.Elo,
		}
		detailMessage := map[string]interface{}{
			"type":        "userDetails",
			"userDetails": payload,
		}

		if connRef == conn {
			// Already sent this client's participant data; ensure they have their own detail payload too
			client.SafeWriteJSON(detailMessage)
		} else {
			// Send existing participant info to the new client
			client.SafeWriteJSON(detailMessage)
		}
	}

	// Prepare detailed payload for the new client to broadcast to others
	userDetailsPayload := map[string]interface{}{
		"id":          client.UserID,
		"username":    client.Username,
		"displayName": client.Username,
		"email":       client.Email,
		"avatarUrl":   client.AvatarURL,
		"elo":         client.Elo,
	}

	userDetailsMessage := map[string]interface{}{
		"type":        "userDetails",
		"userDetails": userDetailsPayload,
	}

	// Broadcast new participant to other clients
	for _, r := range snapshotRecipients(room, conn) {
		r.SafeWriteJSON(userDetailsMessage)
		r.SafeWriteJSON(participantsMsg)
	}

	if client.IsSpectator {
		log.Printf("[ws] spectator connected: room=%s connectionId=%s user=%s", roomID, client.ConnectionID, client.Email)
		notifySpectatorStatus(room, client, true)
	}

	// Listen for messages.
	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("[ws] connection closed: room=%s spectator=%t user=%s", roomID, client.IsSpectator, client.Email)
			} else {
				log.Printf("[ws] read error: room=%s spectator=%t user=%s err=%v", roomID, client.IsSpectator, client.Email, err)
			}
			// Remove client from room.
			var (
				disconnectedClient *Client
				exists             bool
				clientCount        int
			)
			room.Mutex.Lock()
			if disconnectedClient, exists = room.Clients[conn]; exists {
				delete(room.Clients, conn)
			}
			clientCount = len(room.Clients)

			// If room is empty, delete it.
			if clientCount == 0 {
				roomsMutex.Lock()
				delete(rooms, roomID)
				roomsMutex.Unlock()
			}
			room.Mutex.Unlock()

			if exists && disconnectedClient.IsSpectator {
				log.Printf("[ws] spectator disconnected: room=%s connectionId=%s user=%s", roomID, disconnectedClient.ConnectionID, disconnectedClient.Email)
				notifySpectatorStatus(room, disconnectedClient, false)
			}

			// Broadcast updated participants to remaining clients
			if clientCount > 0 {
				broadcastParticipants(room)
			}
			break
		}

		// Parse the message
		var message Message
		if err := json.Unmarshal(msg, &message); err != nil {
			continue
		}

		// Update client activity
		room.Mutex.Lock()
		if client, exists := room.Clients[conn]; exists {
			client.LastActivity = time.Now()
		}
		room.Mutex.Unlock()

		// Handle different message types
		switch message.Type {
		case "join":
			// Handle join message - just acknowledge it
		case "message":
			handleChatMessage(room, conn, message, client, roomID)
		case "typing":
			handleTypingIndicator(room, conn, message, client, roomID)
		case "speaking":
			handleSpeakingIndicator(room, conn, message, client, roomID)
		case "speechText":
			handleSpeechText(room, conn, message, client, roomID)
		case "liveTranscript":
			handleLiveTranscript(room, conn, message, client, roomID)
		case "phaseChange":
			handlePhaseChange(room, conn, message, roomID)
		case "topicChange":
			handleTopicChange(room, conn, message, roomID)
		case "roleSelection":
			handleRoleSelection(room, conn, message, roomID)
		case "ready":
			handleReadyStatus(room, conn, message, roomID)
		case "mute":
			handleMuteRequest(room, conn, message, client, roomID)
		case "unmute":
			handleUnmuteRequest(room, conn, message, client, roomID)
		case "concede":
			handleConcede(room, conn, message, client, roomID)
		default:
			if message.Type == "requestOffer" && client.IsSpectator {
				var req map[string]interface{}
				if err := json.Unmarshal(msg, &req); err == nil {
					if client.ConnectionID == "" {
						client.ConnectionID = uuid.New().String()
					}
					log.Printf("[ws] spectator requestOffer: room=%s connectionId=%s user=%s", roomID, client.ConnectionID, client.Email)
					req["connectionId"] = client.ConnectionID
					req["spectatorUserId"] = client.UserID
					req["spectatorDisplayName"] = client.Username
					if enriched, err := json.Marshal(req); err == nil {
						broadcastRawToDebaters(room, conn, enriched)
						continue
					}
				}
			}
			// Broadcast the message to all other clients in the room (including spectators).
			// This handles WebRTC offers, answers, candidates, etc.
			recipientCount := 0
			for _, r := range snapshotRecipients(room, conn) {
				if err := r.SafeWriteMessage(messageType, msg); err != nil {
					log.Printf("Error forwarding message type %d to %s: %v", messageType, r.Email, err)
				} else {
					recipientCount++
				}
			}
		}
	}
}

// handleChatMessage handles chat messages with enhanced features
func handleChatMessage(room *Room, conn *websocket.Conn, message Message, client *Client, roomID string) {
	// Add timestamp if not provided
	if message.Timestamp == 0 {
		message.Timestamp = time.Now().Unix()
	}

	// Reset typing/speaking indicators
	room.Mutex.Lock()
	client.IsTyping = false
	client.IsSpeaking = false
	client.PartialText = ""
	room.Mutex.Unlock()

	// Broadcast to other clients
	for _, r := range snapshotRecipients(room, conn) {
		response := map[string]interface{}{
			"type":      "message",
			"userId":    client.UserID,
			"username":  client.Username,
			"content":   message.Content,
			"timestamp": message.Timestamp,
			"mode":      message.Mode,
		}
		if err := r.SafeWriteJSON(response); err != nil {
			log.Printf("Error sending chat message to %s: %v", r.Email, err)
		}
	}
}

// handleTypingIndicator handles typing indicators
func handleTypingIndicator(room *Room, conn *websocket.Conn, message Message, client *Client, roomID string) {
	room.Mutex.Lock()
	client.IsTyping = message.IsTyping
	client.PartialText = message.PartialText
	room.Mutex.Unlock()

	// Broadcast typing indicator to other clients
	for _, r := range snapshotRecipients(room, conn) {
		response := map[string]interface{}{
			"type":        "typingIndicator",
			"userId":      client.UserID,
			"username":    client.Username,
			"isTyping":    message.IsTyping,
			"partialText": message.PartialText,
		}
		if err := r.SafeWriteJSON(response); err != nil {
			log.Printf("Error sending typing indicator to %s: %v", r.Email, err)
		}
	}
}

// handleSpeakingIndicator handles speaking indicators
func handleSpeakingIndicator(room *Room, conn *websocket.Conn, message Message, client *Client, roomID string) {
	room.Mutex.Lock()
	client.IsSpeaking = message.IsSpeaking
	room.Mutex.Unlock()

	// Broadcast speaking indicator to other clients
	for _, r := range snapshotRecipients(room, conn) {
		response := map[string]interface{}{
			"type":       "speakingIndicator",
			"userId":     client.UserID,
			"username":   client.Username,
			"isSpeaking": message.IsSpeaking,
		}
		if err := r.SafeWriteJSON(response); err != nil {
			log.Printf("Error sending speaking indicator to %s: %v", r.Email, err)
		}
	}
}

// handleSpeechText handles speech-to-text conversion
func handleSpeechText(room *Room, conn *websocket.Conn, message Message, client *Client, roomID string) {
	room.Mutex.Lock()
	client.SpeechText = message.SpeechText
	room.Mutex.Unlock()

	// Broadcast speech text to other clients
	for _, r := range snapshotRecipients(room, conn) {
		response := map[string]interface{}{
			"type":       "speechText",
			"userId":     client.UserID,
			"username":   client.Username,
			"speechText": client.SpeechText,
			"phase":      message.Phase,
			"role":       client.Role,
		}
		if err := r.SafeWriteJSON(response); err != nil {
			log.Printf("Error sending speech text to %s: %v", r.Email, err)
		}
	}
}

// handleLiveTranscript handles live/interim transcript updates
func handleLiveTranscript(room *Room, conn *websocket.Conn, message Message, client *Client, roomID string) {
	// Broadcast live transcript to other clients
	for _, r := range snapshotRecipients(room, conn) {
		response := map[string]interface{}{
			"type":           "liveTranscript",
			"userId":         client.UserID,
			"username":       client.Username,
			"liveTranscript": message.LiveTranscript,
			"phase":          message.Phase,
			"role":           client.Role,
		}
		if err := r.SafeWriteJSON(response); err != nil {
			log.Printf("Error sending live transcript to %s: %v", r.Email, err)
		}
	}
}

// handlePhaseChange handles phase changes
func handlePhaseChange(room *Room, conn *websocket.Conn, message Message, roomID string) {
	// Determine whose turn it is based on the phase
	var currentTurn string
	switch message.Phase {
	case "openingFor", "crossForQuestion", "crossForAnswer", "closingFor":
		currentTurn = "for"
	case "openingAgainst", "crossAgainstQuestion", "crossAgainstAnswer", "closingAgainst":
		currentTurn = "against"
	default:
		currentTurn = ""
	}

	// Automatically mute/unmute users based on turn
	room.Mutex.Lock()
	for clientConn, client := range room.Clients {
		if client.Role != "" {
			shouldBeMuted := client.Role != currentTurn
			client.IsMuted = shouldBeMuted

			// Send mute status to each client
			response := map[string]interface{}{
				"type":        "autoMuteStatus",
				"userId":      client.UserID,
				"username":    client.Username,
				"isMuted":     shouldBeMuted,
				"currentTurn": currentTurn,
				"phase":       message.Phase,
			}
			if err := clientConn.WriteJSON(response); err != nil {
				log.Printf("Error sending autoMuteStatus to %s: %v", client.Email, err)
			}
		}
	}
	room.Mutex.Unlock()

	// Broadcast phase change to other clients
	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(message); err != nil {
			log.Printf("Error broadcasting phase change to %s: %v", r.Email, err)
		}
	}
}

// handleTopicChange handles topic changes
func handleTopicChange(room *Room, conn *websocket.Conn, message Message, roomID string) {
	// Broadcast topic change to other clients
	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(message); err != nil {
			log.Printf("Error broadcasting topic change to %s: %v", r.Email, err)
		}
	}
}

// handleRoleSelection handles role selection
func handleRoleSelection(room *Room, conn *websocket.Conn, message Message, roomID string) {
	// Store the role in the client
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	if client, exists := room.Clients[conn]; exists {
		if client.IsSpectator {
			return
		}
		client.Role = message.Role
	}

	// Broadcast role selection to other clients
	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(message); err != nil {
			log.Printf("Error broadcasting role selection to %s: %v", r.Email, err)
		}
	}

	// Send updated participant snapshot to everyone
	broadcastParticipants(room)
}

// handleReadyStatus handles ready status
func handleReadyStatus(room *Room, conn *websocket.Conn, message Message, roomID string) {
	// Broadcast ready status to other clients
	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(message); err != nil {
			log.Printf("Error broadcasting ready status to %s: %v", r.Email, err)
		}
	}
}

// handleMuteRequest handles mute requests
func handleMuteRequest(room *Room, conn *websocket.Conn, message Message, client *Client, roomID string) {
	room.Mutex.Lock()
	client.IsMuted = true
	room.Mutex.Unlock()

	// Broadcast mute status to other clients
	for _, r := range snapshotRecipients(room, conn) {
		response := map[string]interface{}{
			"type":     "muteStatus",
			"userId":   client.UserID,
			"username": client.Username,
			"isMuted":  true,
		}
		if err := r.SafeWriteJSON(response); err != nil {
			log.Printf("Error sending mute status to %s: %v", r.Email, err)
		}
	}
}

// handleUnmuteRequest handles unmute requests
func handleUnmuteRequest(room *Room, conn *websocket.Conn, message Message, client *Client, roomID string) {
	room.Mutex.Lock()
	client.IsMuted = false
	room.Mutex.Unlock()

	// Broadcast unmute status to other clients
	for _, r := range snapshotRecipients(room, conn) {
		response := map[string]interface{}{
			"type":     "muteStatus",
			"userId":   client.UserID,
			"username": client.Username,
			"isMuted":  false,
		}
		if err := r.SafeWriteJSON(response); err != nil {
			log.Printf("Error sending unmute status to %s: %v", r.Email, err)
		}
	}
}

// getUserDetails fetches user details from database
func getUserDetails(email string) (string, string, string, int, error) {
	// Query user document using email
	userCollection := db.MongoDatabase.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user struct {
		ID          primitive.ObjectID `bson:"_id"`
		Email       string             `bson:"email"`
		DisplayName string             `bson:"displayName"`
		AvatarURL   string             `bson:"avatarUrl"`
		Rating      float64            `bson:"rating"`
	}

	err := userCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		return "", "", "", 0, err
	}

	rating := int(math.Round(user.Rating))
	return user.ID.Hex(), user.DisplayName, user.AvatarURL, rating, nil
}

// handleConcede handles concede requests
func handleConcede(room *Room, conn *websocket.Conn, message Message, client *Client, roomID string) {
	// Broadcast concede message to all clients (including spectators)
	broadcastMessage := Message{
		Type:     "concede",
		Room:     roomID,
		Username: client.Username,
		UserID:   client.UserID,
		Content:  "User conceded the debate",
	}

	// Send to all clients
	for _, r := range snapshotRecipients(room, nil) {
		r.SafeWriteJSON(broadcastMessage)
	}

	// Find opponent
	var opponent *Client
	room.Mutex.Lock()
	for _, c := range room.Clients {
		if !c.IsSpectator && c.UserID != client.UserID {
			opponent = c
			break
		}
	}
	room.Mutex.Unlock()

	if opponent != nil {
		// Update ratings
		// User lost (0.0), Opponent won (1.0)
		userID, _ := primitive.ObjectIDFromHex(client.UserID)
		opponentID, _ := primitive.ObjectIDFromHex(opponent.UserID)

		_, _, err := services.UpdateRatings(userID, opponentID, 0.0, time.Now())
		if err != nil {
			log.Printf("Error updating ratings after concede: %v", err)
		}
	}
}
