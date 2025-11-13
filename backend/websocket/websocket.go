package websocket

import (
    "context"
    "encoding/json"
    "log"
    "net/http"
    "sync"
    "time"

    "arguehub/db"
    "arguehub/utils"
    "github.com/gin-gonic/gin"
    "github.com/gorilla/websocket"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
    "strings" 
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
	IsTyping     bool
	IsSpeaking   bool
	PartialText  string
	LastActivity time.Time
	IsMuted      bool   // New field to track mute status
	Role         string // New field to track debate role (for/against)
	SpeechText   string // New field to store speech text
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
	Type        string          `json:"type"`
	Room        string          `json:"room,omitempty"`
	Username    string          `json:"username,omitempty"`
	UserID      string          `json:"userId,omitempty"`
	Content     string          `json:"content,omitempty"`
	Extra       json.RawMessage `json:"extra,omitempty"`
	// New fields for real-time communication
	IsTyping    bool   `json:"isTyping,omitempty"`
	IsSpeaking  bool   `json:"isSpeaking,omitempty"`
	PartialText string `json:"partialText,omitempty"`
	Timestamp   int64  `json:"timestamp,omitempty"`
	Mode        string `json:"mode,omitempty"` // 'type' or 'speak'
	// Debate-specific fields
	Phase       string `json:"phase,omitempty"`
	Topic       string `json:"topic,omitempty"`
	Role        string `json:"role,omitempty"`
	Ready       *bool  `json:"ready,omitempty"`
	// New fields for automatic muting
	IsMuted     bool   `json:"isMuted,omitempty"`
	CurrentTurn string `json:"currentTurn,omitempty"` // "for" or "against"
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
		if cc != exclude {
			out = append(out, cl)
		}
	}
	return out
}

// WebsocketHandler handles WebSocket connections for debate signaling.
func WebsocketHandler(c *gin.Context) {
	
	
	
	authz := c.GetHeader("Authorization")
	token := strings.TrimPrefix(authz, "Bearer ")
	if token == "" {
		token = c.Query("token")
	}
	if token == "" {
  		log.Println("WebSocket connection failed: missing token")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
  		return
}

	// Validate token
	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid || email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	roomID := c.Query("room")
	if roomID == "" {
		log.Println("WebSocket connection failed: missing room parameter")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing room parameter"})
		return
	}

	// Get user details from database
	userID, username, err := getUserDetails(email)
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
		log.Println("WebSocket upgrade error:", err)
		return
	}

	// Limit room to 2 clients.
	room.Mutex.Lock()
	if len(room.Clients) >= 2 {
		room.Mutex.Unlock()
		conn.Close()
		return
	}

	// Create client instance
	client := &Client{
		Conn:         conn,
		UserID:       userID,
		Username:     username,
		Email:        email,
		IsTyping:     false,
		IsSpeaking:   false,
		PartialText:  "",
		LastActivity: time.Now(),
		IsMuted:      false,
		Role:         "",
		SpeechText:   "",
	}

	room.Clients[conn] = client
	room.Mutex.Unlock()

	// Listen for messages.
	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			// Remove client from room.
			room.Mutex.Lock()
			delete(room.Clients, conn)
			// If room is empty, delete it.
			if len(room.Clients) == 0 {
				roomsMutex.Lock()
				delete(rooms, roomID)
				roomsMutex.Unlock()
			}
			room.Mutex.Unlock()
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
		default:
			// Broadcast the message to all other clients in the room.
			for _, r := range snapshotRecipients(room, conn) {
				if err := r.SafeWriteMessage(messageType, msg); err != nil {
					log.Printf("WebSocket write error in room %s: %v", roomID, err)
				} else {
					log.Printf("Forwarded message to a client in room %s", roomID)
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
			log.Printf("WebSocket write error in room %s: %v", roomID, err)
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
			log.Printf("WebSocket write error in room %s: %v", roomID, err)
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
			log.Printf("WebSocket write error in room %s: %v", roomID, err)
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
		}
		if err := r.SafeWriteJSON(response); err != nil {
			log.Printf("WebSocket write error in room %s: %v", roomID, err)
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
		}
		if err := r.SafeWriteJSON(response); err != nil {
			log.Printf("WebSocket write error in room %s: %v", roomID, err)
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
				log.Printf("WebSocket write error in room %s: %v", roomID, err)
			}
		}
	}
	room.Mutex.Unlock()

	// Broadcast phase change to other clients
	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(message); err != nil {
			log.Printf("WebSocket write error in room %s: %v", roomID, err)
		}
	}
}

// handleTopicChange handles topic changes
func handleTopicChange(room *Room, conn *websocket.Conn, message Message, roomID string) {
	// Broadcast topic change to other clients
	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(message); err != nil {
			log.Printf("WebSocket write error in room %s: %v", roomID, err)
		}
	}
}

// handleRoleSelection handles role selection
func handleRoleSelection(room *Room, conn *websocket.Conn, message Message, roomID string) {
	// Store the role in the client
	room.Mutex.Lock()
	if client, exists := room.Clients[conn]; exists {
		client.Role = message.Role
	}
	room.Mutex.Unlock()

	// Broadcast role selection to other clients
	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(message); err != nil {
			log.Printf("WebSocket write error in room %s: %v", roomID, err)
		}
	}
}

// handleReadyStatus handles ready status
func handleReadyStatus(room *Room, conn *websocket.Conn, message Message, roomID string) {
	// Broadcast ready status to other clients
	for _, r := range snapshotRecipients(room, conn) {
		if err := r.SafeWriteJSON(message); err != nil {
			log.Printf("WebSocket write error in room %s: %v", roomID, err)
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
			log.Printf("WebSocket write error in room %s: %v", roomID, err)
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
			log.Printf("WebSocket write error in room %s: %v", roomID, err)
		}
	}
}

// getUserDetails fetches user details from database
func getUserDetails(email string) (string, string, error) {
	// Query user document using email
	userCollection := db.MongoDatabase.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user struct {
		ID          primitive.ObjectID `bson:"_id"`
		Email       string             `bson:"email"`
		DisplayName string             `bson:"displayName"`
	}

	err := userCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		return "", "", err
	}

	return user.ID.Hex(), user.DisplayName, nil
}