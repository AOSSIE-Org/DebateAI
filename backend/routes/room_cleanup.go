package routes

import (
	"context"
	"log"
	"time"

	"arguehub/db"

	"go.mongodb.org/mongo-driver/bson"
)

const (
	roomInactivityTimeout = 1 * time.Hour
	roomCleanupInterval   = 10 * time.Minute
)

// StartRoomCleanup launches a background goroutine that periodically deletes
// debate rooms that have had no activity for longer than roomInactivityTimeout.
func StartRoomCleanup() {
	go func() {
		ticker := time.NewTicker(roomCleanupInterval)
		defer ticker.Stop()
		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			cutoff := time.Now().Add(-roomInactivityTimeout)
			res, err := db.MongoDatabase.Collection("rooms").DeleteMany(
				ctx,
				bson.M{"lastActivity": bson.M{"$lt": cutoff}},
			)
			cancel()
			if err != nil {
				log.Printf("[room-cleanup] error deleting inactive rooms: %v", err)
			} else if res.DeletedCount > 0 {
				log.Printf("[room-cleanup] removed %d inactive room(s)", res.DeletedCount)
			}
		}
	}()
}
