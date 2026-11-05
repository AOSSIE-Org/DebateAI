package db

import (
	"context"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func EnsureTournamentIndexes(ctx context.Context, collection *mongo.Collection) error {
	_, err := collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "inviteCode", Value: 1}}, Options: options.Index().SetName("unique_private_invite_code").SetUnique(true).SetPartialFilterExpression(bson.M{"visibility": "private", "inviteCode": bson.M{"$type": "string", "$gt": ""}})},
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "createdAt", Value: -1}}},
		{Keys: bson.D{{Key: "hostId", Value: 1}}},
		{Keys: bson.D{{Key: "participants.userId", Value: 1}}},
		{Keys: bson.D{{Key: "execution.state", Value: 1}, {Key: "execution.deadlineAt", Value: 1}, {Key: "_id", Value: 1}}},
		{Keys: bson.D{{Key: "evaluation.state", Value: 1}, {Key: "evaluation.nextAttemptAt", Value: 1}, {Key: "evaluation.createdAt", Value: 1}}},
		{Keys: bson.D{{Key: "evaluation.state", Value: 1}, {Key: "evaluation.leaseUntil", Value: 1}, {Key: "evaluation.createdAt", Value: 1}}},
	})
	return err
}
