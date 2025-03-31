package db

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var MongoClient *mongo.Client
var MongoDatabase *mongo.Database

// extractDBName parses the database name from the URI, defaulting to "test"
func extractDBName(uri string) string {
	u, err := url.Parse(uri)
	if err != nil {
		return "test"
	}
	if u.Path != "" && u.Path != "/" {
		return u.Path[1:] // Trim leading '/'
	}
	return "test"
}

// ConnectMongoDB establishes a connection to MongoDB using the provided URI
func ConnectMongoDB(uri string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Verify connection with a ping
	if err := client.Ping(ctx, nil); err != nil {
		return fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	MongoClient = client
	MongoDatabase = client.Database(extractDBName(uri))
	return nil
}
