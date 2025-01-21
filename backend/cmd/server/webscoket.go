package main

import (
	"fmt"
	"log"
	"net/http"
	"github.com/gorilla/websocket"
	"github.com/gin-gonic/gin"
)

// WebSocket upgrader to handle the WebSocket connection
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins
		return true
	},
}

// ChatHub stores active WebSocket connections
type ChatHub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
}

// NewChatHub creates a new ChatHub instance
func NewChatHub() *ChatHub {
	return &ChatHub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

// Start the hub to listen for events (new connections, messages, etc.)
func (hub *ChatHub) Start() {
	for {
		select {
		case conn := <-hub.register:
			hub.clients[conn] = true
			fmt.Println("New client connected")

		case conn := <-hub.unregister:
			if _, ok := hub.clients[conn]; ok {
				delete(hub.clients, conn)
				conn.Close()
				fmt.Println("Client disconnected")
			}

		case message := <-hub.broadcast:
			for client := range hub.clients {
				err := client.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					fmt.Println("Error broadcasting message:", err)
					client.Close()
					delete(hub.clients, client)
				}
			}
		}
	}
}

// WebSocketHandler handles WebSocket connections and message reception
func WebSocketHandler(hub *ChatHub) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Upgrade the HTTP connection to a WebSocket connection
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Println("WebSocket upgrade failed:", err)
			return
		}

		// Register the new connection in the hub
		hub.register <- conn
		defer func() {
			hub.unregister <- conn
		}()

		// Handle incoming messages from the WebSocket client
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				fmt.Println("Error reading message:", err)
				break
			}
			// Broadcast the received message to all connected clients
			hub.broadcast <- message
		}
	}
}
