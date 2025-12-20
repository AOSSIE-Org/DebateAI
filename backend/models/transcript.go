package models

import (
	"encoding/json"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type DebateTranscript struct {
	RoomID      string            `bson:"roomId" json:"roomId"`
	Role        string            `bson:"role" json:"role"`
	Email       string            `bson:"email" json:"email"`
	Transcripts map[string]string `bson:"transcripts" json:"transcripts"`
	CreatedAt   time.Time         `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time         `bson:"updatedAt" json:"updatedAt"`
}

type DebateResult struct {
	RoomID    string    `bson:"roomId" json:"roomId"`
	Result    string    `bson:"result" json:"result"`
	CreatedAt time.Time `bson:"createdAt" json:"createdAt"`
}

// SavedDebateTranscript represents a saved debate transcript that users can view later
type SavedDebateTranscript struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserID      primitive.ObjectID `bson:"userId" json:"userId,omitempty"`
	Email       string             `bson:"email" json:"email"`
	DebateType  string             `bson:"debateType" json:"debateType"` // "user_vs_bot" or "user_vs_user"
	Topic       string             `bson:"topic" json:"topic"`
	Opponent    string             `bson:"opponent" json:"opponent"` // Bot name or opponent email
	Result      string             `bson:"result" json:"result"`     // "win", "loss", "draw", "pending"
	Messages    []Message          `bson:"messages" json:"messages"`
	Transcripts map[string]string  `bson:"transcripts,omitempty" json:"transcripts,omitempty"` // For user vs user debates
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time          `bson:"updatedAt" json:"updatedAt"`
}

func (s SavedDebateTranscript) MarshalJSON() ([]byte, error) {
	type Alias SavedDebateTranscript
	a := Alias(s)
	a.ID = primitive.NilObjectID
	a.UserID = primitive.NilObjectID
	return json.Marshal(&struct {
		ID     string `json:"id"`
		UserID string `json:"userId"`
		Alias
	}{
		ID:     s.ID.Hex(),
		UserID: s.UserID.Hex(),
		Alias:  a,
	})
}
