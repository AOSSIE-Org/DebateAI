package websocket

import (
	"context"
	"log"
	"time"

	"arguehub/db"

	"go.mongodb.org/mongo-driver/bson"
)

// StartRoomActivityHeartbeat periodically refreshes lastActivity in MongoDB for
// every room that currently has at least one connected client, so an active or
// occupied room is never expired by the cleanup job even during quiet periods.
func StartRoomActivityHeartbeat() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			// Snapshot the IDs of rooms with live clients under lock,
			// then do MongoDB I/O after releasing the locks.
			roomsMutex.Lock()
			activeIDs := make([]string, 0, len(rooms))
			for id, room := range rooms {
				room.Mutex.Lock()
				if len(room.Clients) > 0 {
					activeIDs = append(activeIDs, id)
				}
				room.Mutex.Unlock()
			}
			roomsMutex.Unlock()

			if len(activeIDs) == 0 {
				continue
			}

			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			_, err := db.MongoDatabase.Collection("rooms").UpdateMany(
				ctx,
				bson.M{"_id": bson.M{"$in": activeIDs}},
				bson.M{"$set": bson.M{"lastActivity": time.Now()}},
			)
			cancel()
			if err != nil {
				log.Printf("[ws-heartbeat] failed to refresh active rooms: %v", err)
			}
		}
	}()
}
