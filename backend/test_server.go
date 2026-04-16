package main

import (
	"time"

	"arguehub/services"
)

func main() {
	ms := services.GetMatchmakingService()

	err := ms.AddToPool("user1", "Alice", 1200)
	if err != nil {
	}

	err = ms.AddToPool("user2", "Bob", 1250)
	if err != nil {
	}

	_ = ms.GetPool()

	err = ms.StartMatchmaking("user1")
	if err != nil {
	}

	err = ms.StartMatchmaking("user2")
	if err != nil {
	}

	pool := ms.GetPool()
	for range pool {
	}

	time.Sleep(1 * time.Second)

	pool = ms.GetPool()
	for range pool {
	}
}