package utils

import (
	"arguehub/db"
	"arguehub/models"
	"context"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"strings"
	"time"
)

// GetUserIDFromEmail retrieves the user ID from the database using the email
func GetUserIDFromEmail(email string) (primitive.ObjectID, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var user models.User
	normalized := strings.ToLower(strings.TrimSpace(email))
	err := db.MongoDatabase.Collection("users").FindOne(ctx, bson.M{"email": normalized}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return primitive.NilObjectID, mongo.ErrNoDocuments
		}
		return primitive.NilObjectID, err
	}
	return user.ID, nil
}
