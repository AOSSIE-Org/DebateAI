package services

import (
	"testing"
	"time"
)

func TestMatchmakingService(t *testing.T) {
	// Get the singleton service
	ms := GetMatchmakingService()

	// Test adding users to pool (but not starting matchmaking yet)
	err := ms.AddToPool("user1", "Alice", 1200)
	if err != nil {
		t.Errorf("Failed to add user1 to pool: %v", err)
	}

	err = ms.AddToPool("user2", "Bob", 2000)
	if err != nil {
		t.Errorf("Failed to add user2 to pool: %v", err)
	}

	// Test getting pool - should be empty since no one started matchmaking
	pool := ms.GetPool()
	if len(pool) != 0 {
		t.Errorf("Expected 0 users in pool (no one started matchmaking), got %d", len(pool))
	}

	// Test starting matchmaking for user1
	err = ms.StartMatchmaking("user1")
	if err != nil {
		t.Errorf("Failed to start matchmaking for user1: %v", err)
	}

	// Test getting pool - should have 1 user now
	pool = ms.GetPool()
	if len(pool) != 1 {
		t.Errorf("Expected 1 user in pool after starting matchmaking, got %d", len(pool))
	}

	// Test starting matchmaking for user2
	err = ms.StartMatchmaking("user2")
	if err != nil {
		t.Errorf("Failed to start matchmaking for user2: %v", err)
	}

	// Test getting pool - should have 2 users now
	pool = ms.GetPool()
	if len(pool) != 2 {
		t.Errorf("Expected 2 users in pool after both started matchmaking, got %d", len(pool))
	}

	// Test removing user from pool
	ms.RemoveFromPool("user1")
	pool = ms.GetPool()
	if len(pool) != 1 {
		t.Errorf("Expected 1 user in pool after removal, got %d", len(pool))
	}

	// Test updating activity
	ms.UpdateActivity("user2")
	pool = ms.GetPool()
	if len(pool) != 1 {
		t.Errorf("Expected 1 user in pool after activity update, got %d", len(pool))
	}
}

func TestEloTolerance(t *testing.T) {
	ms := GetMatchmakingService()

	// Add users with different Elo ratings (but don't start matchmaking yet)
	ms.AddToPool("user1", "Alice", 1200)  // Range: 1000-1400
	ms.AddToPool("user2", "Bob", 1250)    // Range: 1050-1450
	ms.AddToPool("user3", "Charlie", 800) // Range: 600-1000 (should not match)

	// Check pool - should be empty since no one started matchmaking
	pool := ms.GetPool()
	if len(pool) != 0 {
		t.Errorf("Expected 0 users in pool (no one started matchmaking), got %d", len(pool))
	}

	// Start matchmaking for user1 and user2 (compatible Elo ranges)
	err := ms.StartMatchmaking("user1")
	if err != nil {
		t.Errorf("Failed to start matchmaking for user1: %v", err)
	}

	err = ms.StartMatchmaking("user2")
	if err != nil {
		t.Errorf("Failed to start matchmaking for user2: %v", err)
	}

	// Wait a bit for matching to happen
	time.Sleep(100 * time.Millisecond)

	// Check pool - user1 and user2 should be matched and removed
	pool = ms.GetPool()
	if len(pool) != 0 {
		t.Errorf("Expected 0 users remaining in pool (Alice and Bob should be matched), got %d", len(pool))
	}

	// Start matchmaking for user3 (incompatible Elo range)
	err = ms.StartMatchmaking("user3")
	if err != nil {
		t.Errorf("Failed to start matchmaking for user3: %v", err)
	}

	// Check pool - user3 should remain since no compatible match
	pool = ms.GetPool()
	if len(pool) != 1 {
		t.Errorf("Expected 1 user remaining in pool (Charlie), got %d", len(pool))
	}

	if pool[0].Username != "Charlie" {
		t.Errorf("Expected Charlie to remain in pool, got %s", pool[0].Username)
	}
}
