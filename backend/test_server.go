package main

import (
	"time"

	"arguehub/services"
)

func main() {
	ms := services.GetMatchmakingService()

	// Add some test users
	if err := ms.AddToPool("user1", "Alice", 1200); err != nil {
		_ = err
	}
	if err := ms.AddToPool("user2", "Bob", 1250); err != nil {
		_ = err
	}

	// Check pool before matchmaking starts
	_ = ms.GetPool()

	// Start matchmaking for both users
	if err := ms.StartMatchmaking("user1"); err != nil {
		_ = err
	}
	if err := ms.StartMatchmaking("user2"); err != nil {
		_ = err
	}

	// Check pool — should have 2 users now
	for range ms.GetPool() {
	}

	// Wait a bit for matching
	time.Sleep(1 * time.Second)

	// Check pool after matching
	for range ms.GetPool() {
	}
}