package websocket

import (
	"log"
	"net/http"
	"sync"

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
