package models

import "go.mongodb.org/mongo-driver/bson/primitive"

// Message represents a single message in the debate
type Message struct {
	Sender string `json:"sender" bson:"sender"` // "User", "Bot", or "Judge"
	Text   string `json:"text" bson:"text"`
	Phase  string `json:"phase,omitempty" bson:"phase,omitempty"` // Added for phase-specific tracking
}

// PhaseTiming represents the timing configuration for a debate phase
type PhaseTiming struct {
	Name     string `json:"name" bson:"name"`
	UserTime int    `json:"userTime" bson:"userTime"` // Time in seconds for user
	BotTime  int    `json:"botTime" bson:"botTime"`   // Time in seconds for bot
}

// DebateVsBot represents a debate session against a bot
type DebateVsBot struct {
	ID           primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Email        string             `json:"email" bson:"email"`
	BotName      string             `json:"botName" bson:"botName"`
	BotLevel     string             `json:"botLevel" bson:"botLevel"`
	Topic        string             `json:"topic" bson:"topic"`
	Stance       string             `json:"stance" bson:"stance"` // Added to track bot's stance
	History      []Message          `json:"history" bson:"history"`
	PhaseTimings []PhaseTiming      `json:"phaseTimings" bson:"phaseTimings"` // Added for custom timings
	Outcome      string             `json:"outcome" bson:"outcome"`           // Result of the debate (e.g., "User wins")
	CreatedAt    int64              `json:"createdAt" bson:"createdAt"`
}
