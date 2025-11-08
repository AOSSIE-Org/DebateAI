package main

import (
	"time"

	"arguehub/services"
)

func main() {

	// Test the matchmaking service
	ms := services.GetMatchmakingService()

	// Add some test users (but don't start matchmaking yet)
	err := ms.AddToPool("user1", "Alice", 1200)
	if err != nil {
	}

	err = ms.AddToPool("user2", "Bob", 1250)
	if err != nil {
	}

	// Check pool - should be empty since no one started matchmaking
	pool := ms.GetPool()

	// Start matchmaking for both users
	err = ms.StartMatchmaking("user1")
	if err != nil {
	}

	err = ms.StartMatchmaking("user2")
	if err != nil {
	}

	// Check pool - should have 2 users now
	pool = ms.GetPool()

	for _, user := range pool {
	}

	// Wait a bit for matching
	time.Sleep(1 * time.Second)

	// Check pool after matching
	pool = ms.GetPool()

	for _, user := range pool {
	}

}
