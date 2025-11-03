package websocket

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "sync"
    "time"

    "arguehub/db"
    "arguehub/services"
    "arguehub/utils"

    "github.com/gin-gonic/gin"
    "github.com/gorilla/websocket"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive" 
    "go.mongodb.org/mongo-driver/mongo/options"
)

var matchmakingUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// MatchmakingClient represents a client connected to the matchmaking WebSocket
type MatchmakingClient struct {
	conn     *websocket.Conn
	userID   string
	username string
	elo      int
	send     chan []byte
}

// MatchmakingRoom manages matchmaking WebSocket connections
type MatchmakingRoom struct {
	clients map[*MatchmakingClient]bool
	mutex   sync.RWMutex
}

var matchmakingRoom = &MatchmakingRoom{
	clients: make(map[*MatchmakingClient]bool),
}

// MatchmakingMessage represents messages sent through the matchmaking WebSocket
type MatchmakingMessage struct {
	Type     string          `json:"type"`
	UserID   string          `json:"userId,omitempty"`
	Username string          `json:"username,omitempty"`
	Elo      int             `json:"elo,omitempty"`
	RoomID   string          `json:"roomId,omitempty"`
	Pool     json.RawMessage `json:"pool,omitempty"`
	Error    string          `json:"error,omitempty"`
}

// MatchmakingHandler handles WebSocket connections for matchmaking
func MatchmakingHandler(c *gin.Context) {
	log.Printf("WebSocket connection attempt to /ws/matchmaking")
	
	// Get token from query parameter
	token := c.Query("token")
	if token == "" {
		log.Printf("No token provided in WebSocket connection")
		c.String(http.StatusUnauthorized, "No token provided")
		return
	}
	
	log.Printf("Token received, validating...")

	// Validate token and get user information
	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid || email == "" {
		log.Printf("Invalid token in WebSocket connection: %v, email: %s", err, email)
		c.String(http.StatusUnauthorized, "Invalid token")
		return
	}
	
	log.Printf("Token validated successfully for user: %s", email)

	// Get user details from database
	userCollection := db.MongoDatabase.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user struct {
		ID          primitive.ObjectID `bson:"_id"`
		Email       string  `bson:"email"`
		DisplayName string  `bson:"displayName"`
		Rating      float64 `bson:"rating"`
	}

	err = userCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		log.Printf("User not found in database: %v", err)
		c.String(http.StatusNotFound, "User not found")
		return
	}

	// Calculate user rating with default fallback
	userRating := int(user.Rating)
	if userRating == 0 {
		userRating = 1200 // Default rating if user has no rating
	}

	// Upgrade the connection to WebSocket
	conn, err := matchmakingUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Create client
	client := &MatchmakingClient{
		conn:     conn,
		userID:   user.ID.Hex(),
		username: user.DisplayName,
		elo:      userRating,
		send:     make(chan []byte, 256),
	}

	// Add client to room
	matchmakingRoom.mutex.Lock()
	matchmakingRoom.clients[client] = true
	matchmakingRoom.mutex.Unlock()

	// Add user to matchmaking pool (but don't start matchmaking yet)
	matchmakingService := services.GetMatchmakingService()
	err = matchmakingService.AddToPool(user.ID.Hex(), user.DisplayName, userRating)
	if err != nil {
		log.Printf("Failed to add user to matchmaking pool: %v", err)
		c.String(http.StatusInternalServerError, "Failed to join matchmaking")
		return
	}

	// Send initial pool status
	sendPoolStatus()

	// Set up room creation callback if not already set
	services.SetRoomCreatedCallback(BroadcastRoomCreated)

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// readPump handles incoming messages from the client
func (c *MatchmakingClient) readPump() {
	defer func() {
		c.conn.Close()
		matchmakingRoom.mutex.Lock()
		delete(matchmakingRoom.clients, c)
		matchmakingRoom.mutex.Unlock()
		
		// Remove user from matchmaking pool
		matchmakingService := services.GetMatchmakingService()
		matchmakingService.RemoveFromPool(c.userID)
		sendPoolStatus()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}

		// Parse message
		var msg MatchmakingMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Failed to parse message: %v", err)
			continue
		}

		// Handle different message types
		switch msg.Type {
		case "join_pool":
			// User wants to start matchmaking
			matchmakingService := services.GetMatchmakingService()
			err := matchmakingService.StartMatchmaking(c.userID)
			if err != nil {
				log.Printf("Failed to start matchmaking for user %s: %v", c.userID, err)
				c.send <- []byte(fmt.Sprintf(`{"type":"error","error":"Failed to start matchmaking: %v"}`, err))
			} else {
				// Send confirmation to user
				c.send <- []byte(`{"type":"matchmaking_started"}`)
				sendPoolStatus()
			}
			
		case "leave_pool":
			// User wants to leave matchmaking pool
			matchmakingService := services.GetMatchmakingService()
			matchmakingService.RemoveFromPool(c.userID)
			// Send confirmation to user
			c.send <- []byte(`{"type":"matchmaking_stopped"}`)
			sendPoolStatus()
			
		case "update_activity":
			// Update user activity
			matchmakingService := services.GetMatchmakingService()
			matchmakingService.UpdateActivity(c.userID)
			
		case "get_pool":
			// Send current pool status
			sendPoolStatus()
		}
	}
}

// writePump handles outgoing messages to the client
func (c *MatchmakingClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// sendPoolStatus broadcasts the current matchmaking pool status to all clients
func sendPoolStatus() {
	matchmakingService := services.GetMatchmakingService()
	pool := matchmakingService.GetPool()

	poolData, err := json.Marshal(pool)
	if err != nil {
		log.Printf("Failed to marshal pool data: %v", err)
		return
	}

	message := MatchmakingMessage{
		Type: "pool_update",
		Pool: poolData,
	}

	messageData, err := json.Marshal(message)
	if err != nil {
		log.Printf("Failed to marshal message: %v", err)
		return
	}

	matchmakingRoom.mutex.Lock()
	for client := range matchmakingRoom.clients {
		select {
		case client.send <- messageData:
		default:
			close(client.send)
			delete(matchmakingRoom.clients, client)
		}
	}
	matchmakingRoom.mutex.Unlock()
}

// BroadcastRoomCreated sends a notification when a new room is created
func BroadcastRoomCreated(roomID string, participantUserIDs []string) {
	message := MatchmakingMessage{
		Type:   "room_created",
		RoomID: roomID,
	}

	messageData, err := json.Marshal(message)
	if err != nil {
		log.Printf("Failed to marshal room created message: %v", err)
		return
	}

	matchmakingRoom.mutex.Lock()
	for client := range matchmakingRoom.clients {
		// Only send to participants of the room
		for _, userID := range participantUserIDs {
			if client.userID == userID {
				select {
				case client.send <- messageData:
				default:
					close(client.send)
					delete(matchmakingRoom.clients, client)
				}
				break
			}
		}
	}
	matchmakingRoom.mutex.Unlock()
}

// WatchForNewRooms monitors the rooms collection for new rooms and notifies clients
func WatchForNewRooms() {
	// Wait a moment to ensure MongoDB client is initialized
	time.Sleep(2 * time.Second)
	
	// Check if MongoDB database is available
	if db.MongoDatabase == nil {
		log.Printf("MongoDB database not available, skipping room watching")
		return
	}
	
	roomCollection := db.MongoDatabase.Collection("rooms")
	
	// Create a change stream to watch for new rooms
	pipeline := []bson.M{
		{"$match": bson.M{
			"operationType": "insert",
		}},
	}
	
	opts := options.ChangeStream().SetFullDocument(options.UpdateLookup)
	changeStream, err := roomCollection.Watch(context.Background(), pipeline, opts)
	if err != nil {
		log.Printf("Failed to create change stream: %v", err)
		return
	}
	defer changeStream.Close(context.Background())

	for changeStream.Next(context.Background()) {
		var changeEvent bson.M
		if err := changeStream.Decode(&changeEvent); err != nil {
			log.Printf("Failed to decode change event: %v", err)
			continue
		}

		// Extract room information
		fullDocument, ok := changeEvent["fullDocument"].(bson.M)
		if !ok {
			continue
		}

		var roomID string
		switch v := fullDocument["_id"].(type) {
		case primitive.ObjectID:
			roomID = v.Hex()
		case string:
			roomID = v
		default:
			continue
		}
		// Extract participant user IDs
		participants, ok := fullDocument["participants"].(bson.A)
		if !ok {
			continue
		}
		var participantUserIDs []string
		for _, p := range participants {
			if participant, ok := p.(bson.M); ok {
				if idVal, ok := participant["id"]; ok {
					switch id := idVal.(type) {
					case primitive.ObjectID:
						participantUserIDs = append(participantUserIDs, id.Hex())
					case string:
						participantUserIDs = append(participantUserIDs, id)
					}
				}
			}
		}

		// Notify only the participants of the new room
		BroadcastRoomCreated(roomID, participantUserIDs)
	}
}
