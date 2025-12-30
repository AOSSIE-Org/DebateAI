package routes

import (
    "context"
    "net/http"
    "time"

    "arguehub/db"

    "github.com/gin-gonic/gin"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/mongo/options"
)

// DebugDBInfo returns basic database info and a small sample of seeded users.
func DebugDBInfo(c *gin.Context) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    dbName := "(not-initialized)"
    if db.MongoDatabase != nil {
        dbName = db.MongoDatabase.Name()
    }

    users := []string{}
    if db.MongoDatabase != nil {
        coll := db.MongoDatabase.Collection("users")
        cursor, err := coll.Find(ctx, bson.D{}, options.Find().SetLimit(10))
        if err == nil {
            var docs []bson.M
            if err := cursor.All(ctx, &docs); err == nil {
                for _, d := range docs {
                    if e, ok := d["email"].(string); ok {
                        users = append(users, e)
                    }
                }
            }
        }
    }

    c.JSON(http.StatusOK, gin.H{"db": dbName, "sampleUsers": users})
}
