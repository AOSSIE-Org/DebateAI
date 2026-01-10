package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PersonalityProfile holds the AI-generated personality analysis for a debate participant
type PersonalityProfile struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	DebateID       primitive.ObjectID `bson:"debateId" json:"debateId"`
	ParticipantID  string             `bson:"participantId" json:"participantId"` // User email or Bot name
	ArgumentStyle  string             `bson:"argument_style" json:"argument_style"`
	Tone           string             `bson:"tone" json:"tone"`
	EvidenceUsage  int                `bson:"evidence_usage" json:"evidence_usage"`
	Clarity        int                `bson:"clarity" json:"clarity"`
	Responsiveness int                `bson:"responsiveness" json:"responsiveness"`
	Summary        string             `bson:"summary" json:"summary"`
	CreatedAt      time.Time          `bson:"createdAt" json:"createdAt"`
}
