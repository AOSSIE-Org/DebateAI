package db

import (
	"arguehub/models"
	"context"
	"fmt"
	"log" // Added missing import
	"net/url"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var MongoClient *mongo.Client
var MongoDatabase *mongo.Database
var DebateVsBotCollection *mongo.Collection
var VotesCollection *mongo.Collection
var RedisClient *redis.Client

// GetCollection returns a collection by name
func GetCollection(collectionName string) *mongo.Collection {
	return MongoDatabase.Collection(collectionName)
}

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
	dbName := extractDBName(uri)

	MongoDatabase = client.Database(dbName)
	DebateVsBotCollection = MongoDatabase.Collection("debates_vs_bot")
	VotesCollection = MongoDatabase.Collection("votes")
	return nil
}

// SaveDebateVsBot saves a bot debate session to MongoDB
func SaveDebateVsBot(debate models.DebateVsBot) error {
	_, err := DebateVsBotCollection.InsertOne(context.Background(), debate)
	if err != nil {
		return err
	}
	return nil
}

// UpdateDebateVsBotOutcome updates the outcome of the most recent bot debate for a user
func UpdateDebateVsBotOutcome(userId, outcome string) error {
	filter := bson.M{"userId": userId}
	update := bson.M{"$set": bson.M{"outcome": outcome}}
	_, err := DebateVsBotCollection.UpdateOne(context.Background(), filter, update, nil)
	if err != nil {
		return err
	}
	return nil
}

// GetLatestDebateVsBot retrieves the most recent bot debate for a user
func GetLatestDebateVsBot(email string) (*models.DebateVsBot, error) {
	filter := bson.M{"email": email}
	opts := options.FindOne().SetSort(bson.M{"createdAt": -1})

	var debate models.DebateVsBot
	err := DebateVsBotCollection.FindOne(context.Background(), filter, opts).Decode(&debate)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("no debate found for user: %s", email)
		}
		return nil, err
	}
	return &debate, nil
}

// ConnectRedis establishes a connection to Redis
func ConnectRedis(addr, password string, db int) error {
	RedisClient = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Test the connection with a ping
	_, err := RedisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Println("Connected to Redis")
	return nil
}
