package controllers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// --- CONFIGURATION ---
const (
	CleanupInterval = 1 * time.Hour  // Run the cleanup task every hour
	RoomTTL         = 24 * time.Hour // Delete rooms inactive for more than 24 hours
)

// DebateMessage holds a single text message in the debate.
type DebateMessage struct {
	User      string    `json:"user"`
	Phase     string    `json:"phase"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

// DebateRoom stores all messages for a debate room.
type DebateRoom struct {
	RoomID       string          `json:"roomId"`
	Messages     []DebateMessage `json:"messages"`
	LastActivity time.Time       `json:"-"` // Field to track when the room was last used
	Mutex        sync.Mutex      `json:"-"`
}

var debateRooms = make(map[string]*DebateRoom)
var debateRoomsMutex sync.Mutex

// --- AUTOMATIC CLEANUP SYSTEM ---

// init() runs automatically when the server starts
func init() {
	go cleanupRoutine()
}

// cleanupRoutine runs in the background forever
func cleanupRoutine() {
	ticker := time.NewTicker(CleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		cleanupOldRooms()
	}
}

// cleanupOldRooms locks the map and removes dead rooms
func cleanupOldRooms() {
	debateRoomsMutex.Lock()
	defer debateRoomsMutex.Unlock()

	now := time.Now()
	deletedCount := 0

	for id, room := range debateRooms {
		// If the room has been untouched for longer than RoomTTL (24h)
		if now.Sub(room.LastActivity) > RoomTTL {
			delete(debateRooms, id)
			deletedCount++
			// Clean up the persisted file as well
			os.Remove(fmt.Sprintf("room_%s.json", id))
		}
	}

	if deletedCount > 0 {
		log.Printf("[Memory Cleanup] Removed %d inactive debate rooms to free up RAM.", deletedCount)
	}
}

// --- HANDLERS ---

// SubmitDebateMessageHandler handles the POST request for a new debate message.
func SubmitDebateMessageHandler(c *gin.Context) {
	roomID := c.Query("room")
	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room parameter required"})
		return
	}

	var msg DebateMessage
	if err := c.ShouldBindJSON(&msg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	msg.Timestamp = time.Now()

	// Get or create the debate room.
	debateRoomsMutex.Lock()
	room, exists := debateRooms[roomID]
	if !exists {
		room = &DebateRoom{
			RoomID:       roomID,
			Messages:     []DebateMessage{},
			LastActivity: time.Now(), // Initialize timestamp
		}
		debateRooms[roomID] = room
	}
	room.LastActivity = time.Now() // Update timestamp on new message
	debateRoomsMutex.Unlock()

	// Append the new message safely.
	room.Mutex.Lock()
	room.Messages = append(room.Messages, msg)
	room.Mutex.Unlock()

	// Persist the current transcript to disk asynchronously.
	go persistDebateRoom(room)

	c.JSON(http.StatusOK, gin.H{"status": "message received"})
}

// GetDebateTranscriptHandler returns the complete transcript for a debate room.
func GetDebateTranscriptHandler(c *gin.Context) {
	roomID := c.Query("room")
	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room parameter required"})
		return
	}
	debateRoomsMutex.Lock()
	room, exists := debateRooms[roomID]
	
	// If the room is being read, mark it as active so it doesn't get deleted immediately
	if exists {
		room.LastActivity = time.Now()
	}
	debateRoomsMutex.Unlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}
	c.JSON(http.StatusOK, room)
}

func persistDebateRoom(room *DebateRoom) {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
 	data, err := json.MarshalIndent(room, "", "  ")
 	if err != nil {
		log.Printf("[Persist] Failed to marshal room %s: %v", room.RoomID, err)
 		return
 	}
 	filename := fmt.Sprintf("room_%s.json", room.RoomID)
	if err := os.WriteFile(filename, data, 0644); err != nil {
		log.Printf("[Persist] Failed to write %s: %v", filename, err)
 	}
}
