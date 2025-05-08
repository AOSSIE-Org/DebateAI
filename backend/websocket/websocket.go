package websocket

import (
	"log"
	"net/http"
	"sync"
	"time"

	"encoding/json"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	// In production, adjust the CheckOrigin function to allow only trusted origins.
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Room represents a debate room with connected clients.
type Room struct {
	Clients map[*websocket.Conn]bool
	Mutex   sync.Mutex
}

type Message struct {
	Type     string          `json:"type"`
	Room     string          `json:"room,omitempty"`
	Username string          `json:"username,omitempty"`
	Content  string          `json:"content,omitempty"`
	Extra    json.RawMessage `json:"extra,omitempty"`
}

var rooms = make(map[string]*Room)
var roomsMutex sync.Mutex

// WebsocketHandler handles WebSocket connections for debate signaling.
func WebsocketHandler(c *gin.Context) {
	roomID := c.Query("room")
	if roomID == "" {
		log.Println("WebSocket connection failed: missing room parameter")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing room parameter"})
		return
	}

	// Create the room if it doesn't exist.
	roomsMutex.Lock()
	if _, exists := rooms[roomID]; !exists {
		rooms[roomID] = &Room{Clients: make(map[*websocket.Conn]bool)}
		log.Printf("Created new room: %s", roomID)
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
		log.Printf("Room %s is full. Closing connection.", roomID)
		room.Mutex.Unlock()
		conn.Close()
		return
	}
	room.Clients[conn] = true
	log.Printf("Client joined room %s (total clients: %d)", roomID, len(room.Clients))
	room.Mutex.Unlock()

	// Listen for messages.
	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket read error in room %s: %v", roomID, err)
			// Remove client from room.
			room.Mutex.Lock()
			delete(room.Clients, conn)
			log.Printf("Client removed from room %s (total clients: %d)", roomID, len(room.Clients))
			// If room is empty, delete it.
			if len(room.Clients) == 0 {
				roomsMutex.Lock()
				delete(rooms, roomID)
				roomsMutex.Unlock()
				log.Printf("Room %s deleted as it became empty", roomID)
			}
			room.Mutex.Unlock()
			break
		}

		log.Printf("Received message in room %s: %s", roomID, string(msg))

		// Broadcast the message to all other clients in the room.
		room.Mutex.Lock()
		for client := range room.Clients {
			if client != conn {
				if err := client.WriteMessage(messageType, msg); err != nil {
					log.Printf("WebSocket write error in room %s: %v", roomID, err)
				} else {
					log.Printf("Forwarded message to a client in room %s", roomID)
				}
			}
		}
		room.Mutex.Unlock()
	}

	log.Printf("Connection closed in room %s", roomID)
}

func RoomChatHandler(c *gin.Context) {
	roomID := c.Param("roomId")
	if roomID == "" {
		log.Println("WebSocket connection failed: missing roomId parameter")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing roomId parameter"})
		return
	}

	// Access or create the room safely.
	roomsMutex.Lock()
	if _, exists := rooms[roomID]; !exists {
		rooms[roomID] = &Room{Clients: make(map[*websocket.Conn]bool)}
		log.Printf("Created new room: %s", roomID)
	}
	room := rooms[roomID]
	roomsMutex.Unlock()

	// Upgrade the HTTP connection to a WebSocket connection.
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}

	// Add the client to the room, with a limit of 2 clients.
	room.Mutex.Lock()
	if len(room.Clients) >= 10 {
		log.Printf("Room %s is full. Closing connection.", roomID)
		room.Mutex.Unlock()
		conn.Close()
		return
	}
	room.Clients[conn] = true
	log.Printf("Client joined room %s (total clients: %d)", roomID, len(room.Clients))
	room.Mutex.Unlock()

	// Local map to associate connections with usernames.
	usernames := make(map[*websocket.Conn]string)

	// Listen for incoming messages.
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket read error in room %s: %v", roomID, err)
			// Clean up on disconnect.
			room.Mutex.Lock()
			delete(room.Clients, conn)
			delete(usernames, conn)
			log.Printf("Client removed from room %s (total clients: %d)", roomID, len(room.Clients))
			if len(room.Clients) == 0 {
				roomsMutex.Lock()
				delete(rooms, roomID)
				roomsMutex.Unlock()
				log.Printf("Room %s deleted as it became empty", roomID)
			}
			room.Mutex.Unlock()
			break
		}

		// Parse the incoming message.
		var message Message
		if err := json.Unmarshal(msg, &message); err != nil {
			log.Printf("Invalid message in room %s: %v", roomID, err)
			continue
		}

		// Handle different message types.
		switch message.Type {
		case "join":
			// Store the username when a client joins.
			usernames[conn] = message.Username
			// Notify other clients of the new user.
			room.Mutex.Lock()
			for client := range room.Clients {
				if client != conn {
					client.WriteJSON(map[string]interface{}{
						"type":    "notification",
						"content": "User " + message.Username + " has joined",
					})
				}
			}
			// Update user count for all clients.
			for client := range room.Clients {
				client.WriteJSON(map[string]interface{}{
					"type":  "presence",
					"count": len(room.Clients),
				})
			}
			room.Mutex.Unlock()

		case "chatMessage":
			// Retrieve the sender's username.
			username, exists := usernames[conn]
			if !exists || username == "" {
				log.Printf("No username set for client in room %s", roomID)
				continue
			}
			// Add a timestamp and broadcast the message.
			timestamp := time.Now().Unix()
			room.Mutex.Lock()
			for client := range room.Clients {
				if client != conn { // Send to other clients only.
					err := client.WriteJSON(map[string]interface{}{
						"type":      "chatMessage",
						"username":  username,
						"content":   message.Content,
						"timestamp": timestamp,
					})
					if err != nil {
						log.Printf("WebSocket write error in room %s: %v", roomID, err)
					}
				}
			}
			room.Mutex.Unlock()

		case "reaction":
			// Broadcast reactions to other clients.
			room.Mutex.Lock()
			for client := range room.Clients {
				if client != conn {
					client.WriteJSON(map[string]interface{}{
						"type":  "reaction",
						"extra": message.Extra,
					})
				}
			}
			room.Mutex.Unlock()

		case "vote":
			// Broadcast votes to other clients.
			room.Mutex.Lock()
			for client := range room.Clients {
				if client != conn {
					client.WriteJSON(map[string]interface{}{
						"type":  "vote",
						"extra": message.Extra,
					})
				}
			}
			room.Mutex.Unlock()

		default:
			log.Printf("Unknown message type in room %s: %s", roomID, message.Type)
		}
	}

	log.Printf("Connection closed in room %s", roomID)
}