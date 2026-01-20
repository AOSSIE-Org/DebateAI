package repositories

import (
	"context"
	"errors"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// DebateRepository defines data access methods for Debates (specifically DebateVsBot for now)
type DebateRepository interface {
	Create(ctx context.Context, debate *models.DebateVsBot) (string, error)
	FindLatestByEmail(ctx context.Context, email string) (*models.DebateVsBot, error)
	UpdateOutcome(ctx context.Context, email, outcome string) error
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.DebateVsBot, error)
	UpdateOne(ctx context.Context, filter interface{}, update interface{}) error
}

// MongoDebateRepository is the MongoDB implementation of DebateRepository
type MongoDebateRepository struct {
	Collection *mongo.Collection
}

// NewMongoDebateRepository creates a new MongoDebateRepository
func NewMongoDebateRepository() *MongoDebateRepository {
	if db.MongoDatabase == nil {
		return &MongoDebateRepository{}
	}
	return &MongoDebateRepository{
		Collection: db.MongoDatabase.Collection("debates_vs_bot"),
	}
}

func (r *MongoDebateRepository) Create(ctx context.Context, debate *models.DebateVsBot) (string, error) {
	if r.Collection == nil {
		return "", errors.New("database not initialized")
	}
	result, err := r.Collection.InsertOne(ctx, debate)
	if err != nil {
		return "", err
	}
	id := result.InsertedID.(primitive.ObjectID)
	return id.Hex(), nil
}

func (r *MongoDebateRepository) FindLatestByEmail(ctx context.Context, email string) (*models.DebateVsBot, error) {
	if r.Collection == nil {
		return nil, errors.New("database not initialized")
	}
	filter := bson.M{"email": email}
	opts := options.FindOne().SetSort(bson.M{"createdAt": -1})
	var debate models.DebateVsBot
	err := r.Collection.FindOne(ctx, filter, opts).Decode(&debate)
	if err != nil {
		return nil, err
	}
	return &debate, nil
}

func (r *MongoDebateRepository) UpdateOutcome(ctx context.Context, userId, outcome string) error {
	if r.Collection == nil {
		return errors.New("database not initialized")
	}
	filter := bson.M{"userId": userId} // Note: This logic existed in db.go, but userId might mean user ID hex or email context dependent.
	// Looking at db.go logic: UpdateDebateVsBotOutcome uses userId string field.
	update := bson.M{"$set": bson.M{"outcome": outcome}}
	_, err := r.Collection.UpdateOne(ctx, filter, update, nil)
	return err
}

func (r *MongoDebateRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.DebateVsBot, error) {
	if r.Collection == nil {
		return nil, errors.New("database not initialized")
	}
	var debate models.DebateVsBot
	err := r.Collection.FindOne(ctx, bson.M{"_id": id}).Decode(&debate)
	if err != nil {
		return nil, err
	}
	return &debate, nil
}

func (r *MongoDebateRepository) UpdateOne(ctx context.Context, filter interface{}, update interface{}) error {
	if r.Collection == nil {
		return errors.New("database not initialized")
	}
	_, err := r.Collection.UpdateOne(ctx, filter, update)
	return err
}
