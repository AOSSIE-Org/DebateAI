package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// OverallScores represents the numeric performance metrics (0-100)
type OverallScores struct {
	Persuasion           int `bson:"persuasion" json:"persuasion"`
	Clarity              int `bson:"clarity" json:"clarity"`
	RebuttalEffectiveness int `bson:"rebuttal_effectiveness" json:"rebuttal_effectiveness"`
}

// ArgumentItem represents the evaluation of an argument made by the user
type ArgumentItem struct {
	Statement string `bson:"statement" json:"statement"`
	Tag       string `bson:"tag" json:"tag"` // "Strong", "Moderate", "Weak"
	Reason    string `bson:"reason" json:"reason"`
}

// FallacyFlag represents a logical fallacy detected in the user's speech
type FallacyFlag struct {
	Statement   string `bson:"statement" json:"statement"`
	FallacyType string `bson:"fallacy_type" json:"fallacy_type"`
	Explanation string `bson:"explanation" json:"explanation"`
}

// PerformanceReport represents the complete AI performance evaluation
type PerformanceReport struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	DebateID          string             `bson:"debateId" json:"debateId"`
	UserID            primitive.ObjectID `bson:"userId,omitempty" json:"userId,omitempty"`
	Email             string             `bson:"email,omitempty" json:"email,omitempty"`
	Topic             string             `bson:"topic" json:"topic"`
	Stance            string             `bson:"stance" json:"stance"`
	OverallScores     OverallScores      `bson:"overall_scores" json:"overall_scores"`
	ArgumentBreakdown []ArgumentItem     `bson:"argument_breakdown" json:"argument_breakdown"`
	FallacyFlags      []FallacyFlag      `bson:"fallacy_flags" json:"fallacy_flags"`
	ImprovementTips   []string           `bson:"improvement_tips" json:"improvement_tips"`
	IsFallback        bool               `bson:"is_fallback,omitempty" json:"is_fallback,omitempty"`
	GeneratedAt       time.Time          `bson:"generated_at" json:"generated_at"`
}

// PerformanceReportRequest represents the incoming payload to request report generation
type PerformanceReportRequest struct {
	DebateID    string            `json:"debateId"`
	Topic       string            `json:"topic,omitempty"`
	Stance      string            `json:"stance,omitempty"`
	DebateType  string            `json:"debateType,omitempty"` // "vs-bot", "vs-human", "team"
	Messages    []Message         `json:"messages,omitempty"`
	Transcripts map[string]string `json:"transcripts,omitempty"`
}
