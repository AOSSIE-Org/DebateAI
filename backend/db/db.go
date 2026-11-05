package db

import (
	"arguehub/models"
	"context"
	"fmt"
	"log"
	"net/url"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var MongoClient *mongo.Client
var MongoDatabase *mongo.Database
var DebateVsBotCollection *mongo.Collection
var TournamentCollection *mongo.Collection
var RedisClient *redis.Client

func GetCollection(collectionName string) *mongo.Collection {
	return MongoDatabase.Collection(collectionName)
}

func extractDBName(uri string) string {
	u, err := url.Parse(uri)
	if err != nil {
		return "test"
	}
	if u.Path != "" && u.Path != "/" {
		return u.Path[1:]
	}
	return "test"
}

func ConnectMongoDB(uri string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		return fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	MongoClient = client
	dbName := extractDBName(uri)
	MongoDatabase = client.Database(dbName)
	DebateVsBotCollection = MongoDatabase.Collection("debates_vs_bot")
	TournamentCollection = MongoDatabase.Collection("tournaments")
	return nil
}

func EnsureIndexes() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersCol := MongoDatabase.Collection("users")

	indexModel := mongo.IndexModel{
		Keys:    bson.D{{Key: "displayName", Value: 1}},
		Options: options.Index().SetUnique(true).SetSparse(true).SetName("unique_displayName"),
	}

	_, err := usersCol.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		return fmt.Errorf("failed to create displayName index: %w", err)
	}
	log.Println("DisplayName unique index ensured")
	return nil
}

func SaveDebateVsBot(debate models.DebateVsBot) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := DebateVsBotCollection.InsertOne(ctx, debate)
	if err != nil {
		return err
	}
	return nil
}

// UpdateDebateVsBotHistory updates the message history of an existing debate session
func UpdateDebateVsBotHistory(id primitive.ObjectID, email string, history []models.Message) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	filter := bson.M{"_id": id, "email": email}
	update := bson.M{"$set": bson.M{"history": history}}
	_, err := DebateVsBotCollection.UpdateOne(ctx, filter, update)
	return err
}

// UpdateDebateVsBotOutcomeById updates the outcome of a specific debate vs bot session
func UpdateDebateVsBotOutcomeById(id primitive.ObjectID, email, outcome string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if DebateVsBotCollection == nil {
		return fmt.Errorf("database not initialized")
	}
	filter := bson.M{"_id": id, "email": email}
	update := bson.M{"$set": bson.M{"outcome": outcome}}
	_, err := DebateVsBotCollection.UpdateOne(ctx, filter, update)
	return err
}

// UpdateDebateVsBotOutcomeAndHistory updates both outcome and history atomically on the targeted session
func UpdateDebateVsBotOutcomeAndHistory(id primitive.ObjectID, email, outcome string, history []models.Message) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if DebateVsBotCollection == nil {
		return fmt.Errorf("database not initialized")
	}
	filter := bson.M{"_id": id, "email": email}
	update := bson.M{"$set": bson.M{
		"outcome": outcome,
		"history": history,
	}}
	_, err := DebateVsBotCollection.UpdateOne(ctx, filter, update)
	return err
}

func UpdateDebateVsBotOutcome(identifier, outcome string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if DebateVsBotCollection == nil {
		return fmt.Errorf("database not initialized")
	}

	if objID, err := primitive.ObjectIDFromHex(identifier); err == nil {
		filter := bson.M{"_id": objID}
		update := bson.M{"$set": bson.M{"outcome": outcome}}
		_, err := DebateVsBotCollection.UpdateOne(ctx, filter, update)
		return err
	}

	filter := bson.M{
		"$or": []bson.M{
			{"email": identifier},
			{"userId": identifier},
		},
	}

	// Resolve the most recent matching session first; updating with an un-ordered
	// filter could otherwise target an arbitrary (older) debate.
	opts := options.FindOne().SetSort(bson.M{"createdAt": -1})
	var debate models.DebateVsBot
	if err := DebateVsBotCollection.FindOne(ctx, filter, opts).Decode(&debate); err != nil {
		return err
	}

	update := bson.M{"$set": bson.M{"outcome": outcome}}
	_, err := DebateVsBotCollection.UpdateOne(ctx, bson.M{"_id": debate.ID}, update)
	return err
}

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

func ConnectRedis(addr, password string, db int) error {
	RedisClient = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := RedisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Println("Connected to Redis")
	return nil
}
