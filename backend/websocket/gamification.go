package websocket

import (
	"log"
	"sync"

	"arguehub/models"

	"github.com/gorilla/websocket"
)

// GamificationClient represents a client connected for gamification updates
type GamificationClient struct {
	Conn   *websocket.Conn
	UserID string
	writeMu sync.Mutex
}

// SafeWriteJSON safely writes JSON data to the gamification client's WebSocket connection
func (gc *GamificationClient) SafeWriteJSON(v interface{}) error {
	gc.writeMu.Lock()
	defer gc.writeMu.Unlock()
	return gc.Conn.WriteJSON(v)
}

// Global gamification hub for broadcasting events to all connected clients
var (
	gamificationClients = make(map[*GamificationClient]bool)
	gamificationMutex   sync.RWMutex
)

// RegisterGamificationClient registers a client for gamification updates
func RegisterGamificationClient(client *GamificationClient) {
	gamificationMutex.Lock()
	defer gamificationMutex.Unlock()
	gamificationClients[client] = true
	log.Printf("Gamification client registered. Total clients: %d", len(gamificationClients))
}

// UnregisterGamificationClient removes a client from gamification updates
func UnregisterGamificationClient(client *GamificationClient) {
	gamificationMutex.Lock()
	defer gamificationMutex.Unlock()
	delete(gamificationClients, client)
	client.Conn.Close()
	log.Printf("Gamification client unregistered. Total clients: %d", len(gamificationClients))
}

// BroadcastGamificationEvent broadcasts a gamification event to all connected clients
func BroadcastGamificationEvent(event models.GamificationEvent) {
	gamificationMutex.RLock()
	defer gamificationMutex.RUnlock()

	message := map[string]interface{}{
		"type":      event.Type,
		"userId":    event.UserID,
		"timestamp": event.Timestamp,
	}

	if event.BadgeName != "" {
		message["badgeName"] = event.BadgeName
	}
	if event.Points != 0 {
		message["points"] = event.Points
	}
	if event.NewScore != 0 {
		message["newScore"] = event.NewScore
	}
	if event.Action != "" {
		message["action"] = event.Action
	}

	// Broadcast to all connected clients
	for client := range gamificationClients {
		if err := client.SafeWriteJSON(message); err != nil {
			log.Printf("Error broadcasting gamification event to client: %v", err)
			// Remove client if write fails
			go UnregisterGamificationClient(client)
		}
	}

	log.Printf("Broadcasted gamification event: %s to %d clients", event.Type, len(gamificationClients))
}

// GetGamificationClientsCount returns the number of connected gamification clients
func GetGamificationClientsCount() int {
	gamificationMutex.RLock()
	defer gamificationMutex.RUnlock()
	return len(gamificationClients)
}

