package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Debate defines a single debate record
type Debate struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Email     string             `bson:"email" json:"email"`
	Topic     string             `bson:"topic" json:"topic"`
	Result    string             `bson:"result" json:"result"`
	EloChange int                `bson:"eloChange" json:"eloChange"`
	Date      time.Time          `bson:"date" json:"date"`
}

type DebateTopic struct {
	Topic      string `bson:"topic" json:"topic"`
	Difficulty string `bson:"difficulty" json:"difficulty"` // "beginner", "intermediate", "advanced"
}

// ProsConsEvaluation holds the evaluation results for pros and cons
type ProsConsEvaluation struct {
	Pros  []ArgumentEvaluation `json:"pros"`
	Cons  []ArgumentEvaluation `json:"cons"`
	Score int                  `json:"score"` // Total score out of 50
}

// ArgumentEvaluation represents the evaluation of a single argument
type ArgumentEvaluation struct {
	Score    int    `json:"score"` // 1-10
	Feedback string `json:"feedback"`
	Counter  string `json:"counter"` // Counterargument
}
