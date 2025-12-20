package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Badge represents a badge that can be earned
type Badge struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Name        string             `bson:"name" json:"name"`
	Description string             `bson:"description" json:"description"`
	Icon        string             `bson:"icon" json:"icon"`
	Category    string             `bson:"category" json:"category"` // "achievement", "streak", "skill"
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
}

// UserBadge represents a badge earned by a user
type UserBadge struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserID    primitive.ObjectID `bson:"userId" json:"userId"`
	BadgeName string             `bson:"badgeName" json:"badgeName"`
	EarnedAt  time.Time          `bson:"earnedAt" json:"earnedAt"`
	Metadata  map[string]interface{} `bson:"metadata,omitempty" json:"metadata,omitempty"` // Optional metadata about how badge was earned
}

// ScoreUpdate represents a score update event
type ScoreUpdate struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserID    primitive.ObjectID `bson:"userId" json:"userId"`
	Points    int                `bson:"points" json:"points"`
	Action    string             `bson:"action" json:"action"` // "debate_complete", "win", "streak", etc.
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	Metadata  map[string]interface{} `bson:"metadata,omitempty" json:"metadata,omitempty"`
}

// RateLimitEntry tracks rate limiting for score updates
type RateLimitEntry struct {
	UserID    primitive.ObjectID `bson:"userId" json:"userId"`
	Action    string             `bson:"action" json:"action"`
	Count     int                `bson:"count" json:"count"`
	WindowStart time.Time        `bson:"windowStart" json:"windowStart"`
}

// GamificationEvent represents a gamification event to broadcast via WebSocket
type GamificationEvent struct {
	Type      string    `json:"type"`      // "badge_awarded", "score_updated"
	UserID    string    `json:"userId"`
	BadgeName string    `json:"badgeName,omitempty"`
	Points    int       `json:"points,omitempty"`
	NewScore  int       `json:"newScore,omitempty"`
	Action    string    `json:"action,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

