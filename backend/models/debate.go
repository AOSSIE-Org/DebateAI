package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Debate defines a single debate record
type Debate struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserEmail string             `bson:"userEmail" json:"userEmail"`
	Topic     string             `bson:"topic" json:"topic"`
	Result    string             `bson:"result" json:"result"`
	EloChange int                `bson:"eloChange" json:"eloChange"`
	Date      time.Time          `bson:"date" json:"date"`
}
