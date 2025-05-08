package models

import (
	"time"
)

type DebateTranscript struct {
	RoomID      string            `bson:"roomId" json:"roomId"`
	Role        string            `bson:"role" json:"role"`
	Transcripts map[string]string `bson:"transcripts" json:"transcripts"`
	CreatedAt   time.Time         `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time         `bson:"updatedAt" json:"updatedAt"`
}

type DebateResult struct {
	RoomID    string    `bson:"roomId" json:"roomId"`
	Result    string    `bson:"result" json:"result"`
	CreatedAt time.Time `bson:"createdAt" json:"createdAt"`
}
