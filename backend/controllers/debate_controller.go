package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
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
	RoomID   string          `json:"roomId"`
	Messages []DebateMessage `json:"messages"`
	Mutex    sync.Mutex      `json:"-"`
}

var debateRooms = make(map[string]*DebateRoom)
var debateRoomsMutex sync.Mutex

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
			RoomID:   roomID,
			Messages: []DebateMessage{},
		}
		debateRooms[roomID] = room
	}
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
		return
	}
	filename := fmt.Sprintf("room_%s.json", room.RoomID)
	if err := os.WriteFile(filename, data, 0644); err != nil {
	}
}
