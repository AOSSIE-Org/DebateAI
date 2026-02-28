package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Vote represents a spectator's vote on a debate outcome
type Vote struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	DebateID  primitive.ObjectID `json:"debateId" bson:"debateId"`
	Vote      string             `json:"vote" bson:"vote"` // "User", "Bot", or "for", "against"
	VoterID   string             `json:"voterId" bson:"voterId"` // IP address or fingerprint
	Timestamp time.Time          `json:"timestamp" bson:"timestamp"`
}
