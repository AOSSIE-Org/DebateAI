package models

import (
	"encoding/json"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// DebateAssumption represents implicit assumptions extracted from a debate
type DebateAssumption struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	DebateID         string             `bson:"debateId" json:"debateId"`
	ParticipantID    string             `bson:"participantId,omitempty" json:"participantId,omitempty"`
	ParticipantEmail string             `bson:"participantEmail,omitempty" json:"participantEmail,omitempty"`
	Side             string             `bson:"side" json:"side"` // "for" or "against"
	Assumptions      []string           `bson:"assumptions" json:"assumptions"`
	CreatedAt        time.Time          `bson:"createdAt" json:"createdAt"`
}

// MarshalJSON customizes the JSON serialization to convert ObjectID to string
func (d DebateAssumption) MarshalJSON() ([]byte, error) {
	type Alias DebateAssumption
	a := Alias(d)
	a.ID = primitive.NilObjectID
	return json.Marshal(&struct {
		ID string `json:"id"`
		Alias
	}{
		ID:    d.ID.Hex(),
		Alias: a,
	})
}
