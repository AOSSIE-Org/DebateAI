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
	writeMu      sync.Mutex
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
	IsMuted      bool
	Role         string
	SpeechText   string
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
	Type           string          `json:"type"`
	Room           string          `json:"room,omitempty"`
	Username       string          `json:"username,omitempty"`
	UserID         string          `json:"userId,omitempty"`
	Content        string          `json:"content,omitempty"`
	Extra          json.RawMessage `json:"extra,omitempty"`
	IsTyping       bool            `json:"isTyping,omitempty"`
	IsSpeaking     bool            `json:"isSpeaking,omitempty"`
	PartialText    string          `json:"partialText,omitempty"`
	Timestamp      int64           `json:"timestamp,omitempty"`
	Mode           string          `json:"mode,omitempty"`
	Phase          string          `json:"phase,omitempty"`
	Topic          string          `json:"topic,omitempty"`
	Role           string          `json:"role,omitempty"`
	Ready          *bool           `json:"ready,omitempty"`
	IsMuted        bool            `json:"isMuted,omitempty"`
	CurrentTurn    string          `json:"currentTurn,omitempty"`
	SpeechText     string          `json:"speechText,omitempty"`
	LiveTranscript string          `json:"liveTranscript,omitempty"`
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

// snapshotRecipients returns a slice of clients excluding the specified connection
func snapshotRecipients(room *Room, exclude *websocket.Conn) []*Client {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	out := make([]*Client, 0, len(room.Clients))
	for cc, cl := range room.Clients {
		if cc != exclude {
			out = append(out, cl)
		}
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

	return map[string]interface{}{
		"type":             "roomParticipants",
		"roomParticipants": participants,
		"spectatorCount":   spectatorCount,
	}
}

func broadcastParticipants(room *Room) {
	message := buildParticipantsMessage(room)
	for _, client := range snapshotRecipients(room, nil) {
		if err := client.SafeWriteJSON(message); err != nil {
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
		}
	}
}

func broadcastRawToDebaters(room *Room, exclude *websocket.Conn, payload []byte) {
	for _, client := range nonSpectatorRecipients(room, exclude) {
		if err := client.SafeWriteMessage(websocket.TextMessage, payload); err != nil {
		}
	}
}

// WebsocketHandler handles WebSocket connections for debate signaling.
func WebsocketHandler(c *gin.Context) {
	authz := c.GetHeader("Authorization")
	token := strings.TrimPrefix(authz, "Bearer ")
	if token == "" {
		token = c.Query("token")
	}

	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
		return
	}

	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid || email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	roomID := c.Query("room")
	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing room parameter"})
		return
	}

	userID, username, avatarURL, rating, err := getUserDetails(email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user details"})
		return
	}

	roomsMutex.Lock()
	if _, exists := rooms[roomID]; !exists {
		rooms[roomID] = &Room{Clients: make(map[*websocket.Conn]*Client)}
	}
	room := rooms[roomID]
	roomsMutex.Unlock()

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	isSpectator := strings.EqualFold(c.Query("spectator"), "true")
	room.Mutex.Lock()
	currentDebaters := 0
	for _, existing := range room.Clients {
		if !existing.IsSpectator {
			currentDebaters++
		}
	}
	if !isSpectator && currentDebaters >= 2 {
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

	client := &Client{
		Conn:         conn,
		UserID:       userID,
		Username:     username,
		Email:        email,
		AvatarURL:    avatarURL,
		Elo:          rating,
		IsSpectator:  isSpectator,
		LastActivity: time.Now(),
	}

	if isSpectator {
		client.Role = "spectator"
		client.ConnectionID = uuid.New().String()
	}

	room.Mutex.Lock()
	room.Clients[conn] = client
	room.Mutex.Unlock()

	participantsMsg := buildParticipantsMessage(room)
	client.SafeWriteJSON(participantsMsg)

	for _, existing := range room.Clients {
		detailMessage := map[string]interface{}{
			"type": "userDetails",
			"userDetails": map[string]interface{}{
				"id":          existing.UserID,
				"username":    existing.Username,
				"displayName": existing.Username,
				"email":       existing.Email,
				"avatarUrl":   existing.AvatarURL,
				"elo":         existing.Elo,
			},
		}
		client.SafeWriteJSON(detailMessage)
	}

	userDetailsMessage := map[string]interface{}{
		"type": "userDetails",
		"userDetails": map[string]interface{}{
			"id":          client.UserID,
			"username":    client.Username,
			"displayName": client.Username,
			"email":       client.Email,
			"avatarUrl":   client.AvatarURL,
			"elo":         client.Elo,
		},
	}

	for _, r := range snapshotRecipients(room, conn) {
		r.SafeWriteJSON(userDetailsMessage)
		r.SafeWriteJSON(participantsMsg)
	}

	if client.IsSpectator {
		log.Printf("[ws] spectator connected: room=%s connectionId=%s user=%s", roomID, client.ConnectionID, client.Email)
		notifySpectatorStatus(room, client, true)
	}

	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("[ws] connection closed: room=%s spectator=%t user=%s", roomID, client.IsSpectator, client.Email)
			} else {
				log.Printf("[ws] read error: room=%s spectator=%t user=%s err=%v", roomID, client.IsSpectator, client.Email, err)
			}

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

			if clientCount > 0 {
				broadcastParticipants(room)
			}
			break
		}

		var message Message
		if err := json.Unmarshal(msg, &message); err != nil {
			continue
		}

		room.Mutex.Lock()
		if c, exists := room.Clients[conn]; exists {
			c.LastActivity = time.Now()
		}
		room.Mutex.Unlock()

		switch message.Type {
		case "join":
			// acknowledge only
		case "message":
			handleChatMessage(room, conn, message, client)
		case "typing":
			handleTypingIndicator(room, conn, message, client)
		case "speaking":
			handleSpeakingIndicator(room, conn, message, client)
		case "speechText":
			handleSpeechText(room, conn, message, client)
		case "liveTranscript":
			handleLiveTranscript(room, conn, message, client)
		case "phaseChange":
			handlePhaseChange(room, conn, message)
		case "topicChange":
			handleTopicChange(room, conn, message)
		case "roleSelection":
			handleRoleSelection(room, conn, message)
		case "ready":
			handleReadyStatus(room, conn, message)
		case "mute":
			handleMuteRequest(room, conn, client)
		case "unmute":
			handleUnmuteRequest(room, conn, client)
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
			for _, r := range snapshotRecipients(room, conn) {
				if err := r.SafeWriteMessage(messageType, msg); err != nil {
				}
			}
		}
	}
}

// handleChatMessage handles chat messages
// roomID param removed — not used in handler body
func handleChatMessage(room *Room, conn *websocket.Conn, message Message, client *Client) {
	if message.Timestamp == 0 {
		message.Timestamp = time.Now().Unix()
	}

	room.Mutex.Lock()
	client.IsTyping = false
	client.IsSpeaking = false
	client.PartialText = ""
	room.Mutex.Unlock()

	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(map[string]interface{}{
			"type":      "message",
			"userId":    client.UserID,
			"username":  client.Username,
			"content":   message.Content,
			"timestamp": message.Timestamp,
			"mode":      message.Mode,
		}); err != nil {
		}
	}
}

// handleTypingIndicator handles typing indicators
// roomID param removed — not used in handler body
func handleTypingIndicator(room *Room, conn *websocket.Conn, message Message, client *Client) {
	room.Mutex.Lock()
	client.IsTyping = message.IsTyping
	client.PartialText = message.PartialText
	room.Mutex.Unlock()

	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(map[string]interface{}{
			"type":        "typingIndicator",
			"userId":      client.UserID,
			"username":    client.Username,
			"isTyping":    message.IsTyping,
			"partialText": message.PartialText,
		}); err != nil {
		}
	}
}

// handleSpeakingIndicator handles speaking indicators
// roomID param removed — not used in handler body
func handleSpeakingIndicator(room *Room, conn *websocket.Conn, message Message, client *Client) {
	room.Mutex.Lock()
	client.IsSpeaking = message.IsSpeaking
	room.Mutex.Unlock()

	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(map[string]interface{}{
			"type":       "speakingIndicator",
			"userId":     client.UserID,
			"username":   client.Username,
			"isSpeaking": message.IsSpeaking,
		}); err != nil {
		}
	}
}

// handleSpeechText handles speech-to-text conversion
// roomID param removed — not used in handler body
func handleSpeechText(room *Room, conn *websocket.Conn, message Message, client *Client) {
	room.Mutex.Lock()
	client.SpeechText = message.SpeechText
	room.Mutex.Unlock()

	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(map[string]interface{}{
			"type":       "speechText",
			"userId":     client.UserID,
			"username":   client.Username,
			"speechText": client.SpeechText,
			"phase":      message.Phase,
			"role":       client.Role,
		}); err != nil {
		}
	}
}

// handleLiveTranscript handles live/interim transcript updates
// roomID param removed — not used in handler body
func handleLiveTranscript(room *Room, conn *websocket.Conn, message Message, client *Client) {
	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(map[string]interface{}{
			"type":           "liveTranscript",
			"userId":         client.UserID,
			"username":       client.Username,
			"liveTranscript": message.LiveTranscript,
			"phase":          message.Phase,
			"role":           client.Role,
		}); err != nil {
		}
	}
}

// handlePhaseChange handles phase changes
// roomID param removed — not used in handler body
func handlePhaseChange(room *Room, conn *websocket.Conn, message Message) {
	var currentTurn string
	switch message.Phase {
	case "openingFor", "crossForQuestion", "crossForAnswer", "closingFor":
		currentTurn = "for"
	case "openingAgainst", "crossAgainstQuestion", "crossAgainstAnswer", "closingAgainst":
		currentTurn = "against"
	default:
		currentTurn = ""
	}

	room.Mutex.Lock()
	for clientConn, client := range room.Clients {
		if client.Role != "" {
			shouldBeMuted := client.Role != currentTurn
			client.IsMuted = shouldBeMuted
			if err := clientConn.WriteJSON(map[string]interface{}{
				"type":        "autoMuteStatus",
				"userId":      client.UserID,
				"username":    client.Username,
				"isMuted":     shouldBeMuted,
				"currentTurn": currentTurn,
				"phase":       message.Phase,
			}); err != nil {
			}
		}
	}
	room.Mutex.Unlock()

	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(message); err != nil {
		}
	}
}

// handleTopicChange handles topic changes
// roomID param removed — not used in handler body
func handleTopicChange(room *Room, conn *websocket.Conn, message Message) {
	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(message); err != nil {
		}
	}
}

// handleRoleSelection handles role selection
// roomID param removed — not used in handler body
func handleRoleSelection(room *Room, conn *websocket.Conn, message Message) {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	if client, exists := room.Clients[conn]; exists {
		if client.IsSpectator {
			return
		}
		client.Role = message.Role
	}

	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(message); err != nil {
		}
	}

	broadcastParticipants(room)
}

// handleReadyStatus handles ready status
// roomID param removed — not used in handler body
func handleReadyStatus(room *Room, conn *websocket.Conn, message Message) {
	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(message); err != nil {
		}
	}
}

// handleMuteRequest handles mute requests
// roomID and message params removed — not used in handler body
func handleMuteRequest(room *Room, conn *websocket.Conn, client *Client) {
	room.Mutex.Lock()
	client.IsMuted = true
	room.Mutex.Unlock()

	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(map[string]interface{}{
			"type":     "muteStatus",
			"userId":   client.UserID,
			"username": client.Username,
			"isMuted":  true,
		}); err != nil {
		}
	}
}

// handleUnmuteRequest handles unmute requests
// roomID and message params removed — not used in handler body
func handleUnmuteRequest(room *Room, conn *websocket.Conn, client *Client) {
	room.Mutex.Lock()
	client.IsMuted = false
	room.Mutex.Unlock()

	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(map[string]interface{}{
			"type":     "muteStatus",
			"userId":   client.UserID,
			"username": client.Username,
			"isMuted":  false,
		}); err != nil {
		}
	}
}

// getUserDetails fetches user details from the database
func getUserDetails(email string) (string, string, string, int, error) {
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

	if err := userCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user); err != nil {
		return "", "", "", 0, err
	}

	return user.ID.Hex(), user.DisplayName, user.AvatarURL, int(math.Round(user.Rating)), nil
}

// handleConcede handles concede requests
func handleConcede(room *Room, _ *websocket.Conn, message Message, client *Client, roomID string) {
	broadcastMessage := Message{
		Type:     "concede",
		Room:     roomID,
		Username: client.Username,
		UserID:   client.UserID,
		Content:  "User conceded the debate",
	}

	for _, r := range snapshotRecipients(room, nil) {
		r.SafeWriteJSON(broadcastMessage)
	}

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
		userObjID, _ := primitive.ObjectIDFromHex(client.UserID)
		opponentObjID, _ := primitive.ObjectIDFromHex(opponent.UserID)
		if _, _, err := services.UpdateRatings(userObjID, opponentObjID, 0.0, time.Now()); err != nil {
			log.Printf("Error updating ratings after concede: %v", err)
		}
	}
}