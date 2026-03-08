package services

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"arguehub/db"

	"go.mongodb.org/mongo-driver/bson"
)

// MatchmakingPool represents a user in the matchmaking queue
type MatchmakingPool struct {
	UserID             string    `json:"userId" bson:"userId"`
	Username           string    `json:"username" bson:"username"`
	Elo                int       `json:"elo" bson:"elo"`
	MinElo             int       `json:"minElo" bson:"minElo"`
	MaxElo             int       `json:"maxElo" bson:"maxElo"`
	JoinedAt           time.Time `json:"joinedAt" bson:"joinedAt"`
	LastActivity       time.Time `json:"lastActivity" bson:"lastActivity"`
	StartedMatchmaking bool      `json:"startedMatchmaking" bson:"startedMatchmaking"`
}

// MatchmakingService handles the matchmaking logic
type MatchmakingService struct {
	pool  map[string]*MatchmakingPool
	mutex sync.RWMutex
}

var (
	matchmakingService *MatchmakingService
	once               sync.Once
)

// GetMatchmakingService returns the singleton matchmaking service
func GetMatchmakingService() *MatchmakingService {
	once.Do(func() {
		matchmakingService = &MatchmakingService{
			pool: make(map[string]*MatchmakingPool),
		}
		go matchmakingService.cleanupInactiveUsers()
		go matchmakingService.periodicMatchmaking()
	})
	return matchmakingService
}

// AddToPool adds a user to the matchmaking pool (but doesn't start matchmaking yet)
func (ms *MatchmakingService) AddToPool(userID, username string, elo int) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()

	// Calculate Elo tolerance (default ±200, but can be adjusted based on user preferences)
	eloTolerance := 200
	minElo := elo - eloTolerance
	maxElo := elo + eloTolerance

	poolEntry := &MatchmakingPool{
		UserID:             userID,
		Username:           username,
		Elo:                elo,
		MinElo:             minElo,
		MaxElo:             maxElo,
		JoinedAt:           time.Now(),
		LastActivity:       time.Now(),
		StartedMatchmaking: false, // Default to false
	}

	ms.pool[userID] = poolEntry
	return nil
}

// StartMatchmaking starts the matchmaking process for a user
func (ms *MatchmakingService) StartMatchmaking(userID string) error {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()

	if poolEntry, exists := ms.pool[userID]; exists {
		poolEntry.StartedMatchmaking = true
		poolEntry.JoinedAt = time.Now() // Reset join time when actually starting
		poolEntry.LastActivity = time.Now()

		// Try to find a match immediately
		go ms.findMatch(userID)
		return nil
	}
	return fmt.Errorf("user not found in pool")
}

// RemoveFromPool removes a user from the matchmaking pool
func (ms *MatchmakingService) RemoveFromPool(userID string) {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()

	delete(ms.pool, userID)
}

// UpdateActivity updates the last activity time for a user
func (ms *MatchmakingService) UpdateActivity(userID string) {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()

	if poolEntry, exists := ms.pool[userID]; exists {
		poolEntry.LastActivity = time.Now()
	}
}

// GetPool returns a copy of the current matchmaking pool
func (ms *MatchmakingService) GetPool() []MatchmakingPool {
	ms.mutex.RLock()
	defer ms.mutex.RUnlock()

	pool := make([]MatchmakingPool, 0, len(ms.pool))
	for _, entry := range ms.pool {
		if entry.StartedMatchmaking { // Only include users who have started matchmaking
			pool = append(pool, *entry)
		}
	}
	return pool
}

// findMatch attempts to find a suitable opponent for the given user
func (ms *MatchmakingService) findMatch(userID string) {
	ms.mutex.Lock()
	user, exists := ms.pool[userID]
	if !exists || !user.StartedMatchmaking {
		ms.mutex.Unlock()
		return
	}
	// Find potential opponents
	var bestMatch *MatchmakingPool
	bestScore := math.Inf(1)
	for _, opponent := range ms.pool {
		if opponent.UserID == userID {
			continue // Skip self
		}
		// Only consider opponents who have started matchmaking
		if !opponent.StartedMatchmaking {
			continue
		}
		// Check if Elo ranges overlap
		if user.MinElo <= opponent.MaxElo && user.MaxElo >= opponent.MinElo {
			// Calculate match quality score (lower is better)
			eloDiff := math.Abs(float64(user.Elo - opponent.Elo))
			waitTime := time.Since(opponent.JoinedAt).Seconds()

			// Score based on Elo difference and wait time
			score := eloDiff - (waitTime * 0.1) // Prefer closer Elo, but consider wait time

			if bestMatch == nil || score < bestScore {
				bestMatch = opponent
				bestScore = score
			}
		}
	}
	// Reserve/remove both under lock to avoid duplicate room creation
	if bestMatch != nil {
		delete(ms.pool, user.UserID)
		delete(ms.pool, bestMatch.UserID)
		// Capture locals and unlock before I/O
		u1, u2 := user, bestMatch
		ms.mutex.Unlock()
		ms.createRoomForMatch(u1, u2)
		return
	}
	ms.mutex.Unlock()
}

// createRoomForMatch creates a room for two matched users
func (ms *MatchmakingService) createRoomForMatch(user1, user2 *MatchmakingPool) {
	// Use atomic operation to create room and remove users from pool
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	roomID := generateRoomID() // Generate room ID (see ID strategy comment below)

	// If DB is not initialized, skip persistence but still complete the match.
	if db.MongoDatabase == nil {
		ms.RemoveFromPool(user1.UserID)
		ms.RemoveFromPool(user2.UserID)
		if roomCreatedCallback != nil {
			roomCreatedCallback(roomID, []string{user1.UserID, user2.UserID})
		}
		return
	}
	roomCollection := db.MongoDatabase.Collection("rooms")

	// Create room with both participants
	room := bson.M{
		"_id":  roomID,
		"type": "public",
		"participants": []bson.M{
			{
				"id":       user1.UserID,
				"username": user1.Username,
				"elo":      user1.Elo,
			},
			{
				"id":       user2.UserID,
				"username": user2.Username,
				"elo":      user2.Elo,
			},
		},
		"createdAt": time.Now(),
		"status":    "waiting", // waiting, active, completed
	}
	// Insert the room directly
	_, err := roomCollection.InsertOne(ctx, room)
	if err != nil {
		ms.mutex.Lock()
		ms.pool[user1.UserID] = user1
		ms.pool[user2.UserID] = user2
		ms.mutex.Unlock()
		return
	}
	// Remove both users from the pool
	ms.RemoveFromPool(user1.UserID)
	ms.RemoveFromPool(user2.UserID)
	// Broadcast room creation to WebSocket clients
	participantUserIDs := []string{user1.UserID, user2.UserID}
	if roomCreatedCallback != nil {
		roomCreatedCallback(roomID, participantUserIDs)
	}
}

// cleanupInactiveUsers removes users who have been inactive for too long
func (ms *MatchmakingService) cleanupInactiveUsers() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		ms.mutex.Lock()
		now := time.Now()
		for userID, poolEntry := range ms.pool {
			// Remove users inactive for more than 5 minutes
			if now.Sub(poolEntry.LastActivity) > 5*time.Minute {
				delete(ms.pool, userID)
			}
		}
		ms.mutex.Unlock()
	}
}

// generateRoomID creates a random six-digit room ID
func generateRoomID() string {
	// Simple implementation - in production, ensure uniqueness
	return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
}

// RoomCreatedCallback is a function type for notifying when a room is created
type RoomCreatedCallback func(roomID string, participantUserIDs []string)

// Global callback for room creation notifications
var roomCreatedCallback RoomCreatedCallback

// SetRoomCreatedCallback sets the callback function for room creation notifications
func SetRoomCreatedCallback(callback RoomCreatedCallback) {
	roomCreatedCallback = callback
}

// periodicMatchmaking runs periodically to find matches for waiting users
func (ms *MatchmakingService) periodicMatchmaking() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		ms.mutex.RLock()
		var usersToMatch []string
		for userID, poolEntry := range ms.pool {
			if poolEntry.StartedMatchmaking {
				usersToMatch = append(usersToMatch, userID)
			}
		}
		ms.mutex.RUnlock()

		// Try to find matches for each user
		for _, userID := range usersToMatch {
			go ms.findMatch(userID)
		}
	}
}
