package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Debate defines a single debate record
type Debate struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserID        primitive.ObjectID `bson:"userId" json:"userId"`
	Email         string             `bson:"email" json:"email"`
	OpponentID    primitive.ObjectID `bson:"opponentId,omitempty" json:"opponentId,omitempty"`
	OpponentEmail string             `bson:"opponentEmail,omitempty" json:"opponentEmail,omitempty"`
	Topic         string             `bson:"topic" json:"topic"`
	Result        string             `bson:"result" json:"result"` // "win", "loss", "draw"
	RatingChange  float64            `bson:"ratingChange" json:"ratingChange"`
	RDChange      float64            `bson:"rdChange" json:"rdChange"`
	PreRating     float64            `bson:"preRating" json:"preRating"`
	PreRD         float64            `bson:"preRD" json:"preRD"`
	PostRating    float64            `bson:"postRating" json:"postRating"`
	PostRD        float64            `bson:"postRD" json:"postRD"`
	Role          string             `bson:"role" json:"role"`                 // User's role
	OpponentRole  string             `bson:"opponentRole" json:"opponentRole"` // Opponent's role
	Date          time.Time          `bson:"date" json:"date"`
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
