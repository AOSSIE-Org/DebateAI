package main

import (
	"fmt"
	"log"
	"time"

	"arguehub/services"
)

// main performs a smoke test of the matchmaking service.
// It adds users to the pool, starts matchmaking for them,
// waits briefly for the matching process, and prints the
// matchmaking pool state at each stage.
func main() {

	// Initialize matchmaking service
	ms := services.GetMatchmakingService()

	// Add test users to the pool
	if err := ms.AddToPool("user1", "Alice", 1200); err != nil {
		log.Fatal("Failed to add user1 to pool:", err)
	}

	if err := ms.AddToPool("user2", "Bob", 1250); err != nil {
		log.Fatal("Failed to add user2 to pool:", err)
	}

	// Check pool before matchmaking starts
	pool := ms.GetPool()
	fmt.Println("Pool before matchmaking starts:")
	fmt.Println(pool)

	// Start matchmaking for both users
	if err := ms.StartMatchmaking("user1"); err != nil {
		log.Fatal("Failed to start matchmaking for user1:", err)
	}

	if err := ms.StartMatchmaking("user2"); err != nil {
		log.Fatal("Failed to start matchmaking for user2:", err)
	}

	// Check pool after starting matchmaking
	pool = ms.GetPool()
	fmt.Println("Pool after matchmaking started:")
	fmt.Println(pool)

	// Wait for matching to process
	time.Sleep(1 * time.Second)

	// Check pool after matching attempt
	pool = ms.GetPool()
	fmt.Println("Pool after matching process:")
	fmt.Println(pool)
}
