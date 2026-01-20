package repositories

import (
	"context"
	"errors"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// UserRepository defines data access methods for Users
type UserRepository interface {
	FindByEmail(ctx context.Context, email string) (*models.User, error)
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.User, error)
	Create(ctx context.Context, user *models.User) (*models.User, error)
	UpdateByID(ctx context.Context, id primitive.ObjectID, update interface{}) error
	UpdateByEmail(ctx context.Context, email string, update interface{}) error
}

// MongoUserRepository is the MongoDB implementation of UserRepository
type MongoUserRepository struct {
	Collection *mongo.Collection
}

// NewMongoUserRepository creates a new MongoUserRepository
func NewMongoUserRepository() *MongoUserRepository {
	// Assuming db.MongoDatabase is initialized globally as per existing code
	if db.MongoDatabase == nil {
		return &MongoUserRepository{}
	}
	return &MongoUserRepository{
		Collection: db.MongoDatabase.Collection("users"),
	}
}

func (r *MongoUserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	if r.Collection == nil {
		return nil, errors.New("database not initialized")
	}
	var user models.User
	err := r.Collection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *MongoUserRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.User, error) {
	if r.Collection == nil {
		return nil, errors.New("database not initialized")
	}
	var user models.User
	err := r.Collection.FindOne(ctx, bson.M{"_id": id}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *MongoUserRepository) Create(ctx context.Context, user *models.User) (*models.User, error) {
	if r.Collection == nil {
		return nil, errors.New("database not initialized")
	}
	result, err := r.Collection.InsertOne(ctx, user)
	if err != nil {
		return nil, err
	}
	user.ID = result.InsertedID.(primitive.ObjectID)
	return user, nil
}

func (r *MongoUserRepository) UpdateByID(ctx context.Context, id primitive.ObjectID, update interface{}) error {
	if r.Collection == nil {
		return errors.New("database not initialized")
	}
	_, err := r.Collection.UpdateByID(ctx, id, update)
	return err
}

func (r *MongoUserRepository) UpdateByEmail(ctx context.Context, email string, update interface{}) error {
	if r.Collection == nil {
		return errors.New("database not initialized")
	}
	_, err := r.Collection.UpdateOne(ctx, bson.M{"email": email}, update)
	return err
}
