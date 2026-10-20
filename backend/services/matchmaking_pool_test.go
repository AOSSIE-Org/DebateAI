package services

import (
	"testing"
	"time"
)

func TestMatchmakingPoolRequiresStartAndEloOverlap(t *testing.T) {
	ms := GetMatchmakingService()
	closeA, closeB := "mm-close-a", "mm-close-b"
	farA, farB := "mm-far-a", "mm-far-b"
	t.Cleanup(func() {
		ms.RemoveFromPool(closeA)
		ms.RemoveFromPool(closeB)
		ms.RemoveFromPool(farA)
		ms.RemoveFromPool(farB)
	})

	if err := ms.AddToPool(closeA, "CloseA", 2400); err != nil {
		t.Fatalf("add closeA: %v", err)
	}
	if err := ms.AddToPool(closeB, "CloseB", 2450); err != nil {
		t.Fatalf("add closeB: %v", err)
	}
	if poolContains(ms, closeA) || poolContains(ms, closeB) {
		t.Fatal("users should stay out of the active pool until matchmaking starts")
	}

	if err := ms.StartMatchmaking(closeA); err != nil {
		t.Fatalf("start closeA: %v", err)
	}
	if err := ms.StartMatchmaking(closeB); err != nil {
		t.Fatalf("start closeB: %v", err)
	}
	waitUntil(t, 2*time.Second, func() bool {
		return !poolContains(ms, closeA) && !poolContains(ms, closeB)
	}, "overlapping ratings 2400 and 2450 should be matched and removed")

	// 2400 covers 2200-2600. 1800 covers 1600-2000. The ranges do not overlap.
	if err := ms.AddToPool(farA, "FarA", 2400); err != nil {
		t.Fatalf("add farA: %v", err)
	}
	if err := ms.AddToPool(farB, "FarB", 1800); err != nil {
		t.Fatalf("add farB: %v", err)
	}
	if err := ms.StartMatchmaking(farA); err != nil {
		t.Fatalf("start farA: %v", err)
	}
	if err := ms.StartMatchmaking(farB); err != nil {
		t.Fatalf("start farB: %v", err)
	}
	time.Sleep(200 * time.Millisecond)
	if !poolContains(ms, farA) || !poolContains(ms, farB) {
		t.Fatal("ratings outside each other's tolerance should remain in the pool")
	}
}

func poolContains(ms *MatchmakingService, userID string) bool {
	for _, entry := range ms.GetPool() {
		if entry.UserID == userID {
			return true
		}
	}
	return false
}

func waitUntil(t *testing.T, timeout time.Duration, cond func() bool, message string) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal(message)
}
