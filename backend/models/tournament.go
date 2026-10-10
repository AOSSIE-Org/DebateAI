package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Tournament Status constants
const (
	StatusUpcoming  = "upcoming"
	StatusLive      = "live"
	StatusCompleted = "completed"
)

// Tournament Visibility constants
const (
	VisibilityPublic  = "public"
	VisibilityPrivate = "private"
)

// Stance constants
const (
	StanceFor     = "for"
	StanceAgainst = "against"
)

// Join Request Status constants
const (
	JoinRequestPending  = "pending"
	JoinRequestApproved = "approved"
	JoinRequestRejected = "rejected"
)

// JoinRequest holds a participant's request to join a private tournament
type JoinRequest struct {
	UserID primitive.ObjectID `bson:"userId" json:"userId" validate:"required"`
	Name   string             `bson:"name" json:"name" validate:"required"`
	Status string             `bson:"status" json:"status" validate:"required,oneof=pending approved rejected"`
}

// Transcript holds a single round submission by a participant
type Transcript struct {
	Round   string `bson:"round" json:"round"`
	Content string `bson:"content" json:"content"`
}

// TournamentParticipant holds participant details including stance and transcripts
type TournamentParticipant struct {
	UserID primitive.ObjectID `bson:"userId" json:"userId" validate:"required"`
	Name   string             `bson:"name" json:"name" validate:"required"`
	Stance string             `bson:"stance" json:"stance" validate:"required,oneof=for against"`
}

// Tournament defines a single tournament record
type Tournament struct {
	ID              primitive.ObjectID      `bson:"_id,omitempty" json:"id,omitempty"`
	HostID          primitive.ObjectID      `bson:"hostId" json:"hostId" validate:"required"`
	ModeratorName   string                  `bson:"moderatorName" json:"moderatorName" validate:"required"`
	Topic           string                  `bson:"topic" json:"topic" validate:"required"`
	Description     string                  `bson:"description" json:"description" validate:"required"`
	Status          string                  `bson:"status" json:"status" validate:"required,oneof=upcoming live completed"`
	Visibility      string                  `bson:"visibility" json:"visibility" validate:"required,oneof=public private"`
	MinParticipants int                     `bson:"minParticipants" json:"minParticipants" validate:"required,min=3"`
	MaxParticipants int                     `bson:"maxParticipants" json:"maxParticipants" validate:"required"`
	Participants    []TournamentParticipant `bson:"participants" json:"participants"`
	JoinRequests    []JoinRequest           `bson:"joinRequests,omitempty" json:"joinRequests,omitempty"`
	InviteCode      string                  `bson:"inviteCode,omitempty" json:"inviteCode,omitempty"`
	ScheduleAt      *time.Time              `bson:"scheduleAt,omitempty" json:"scheduleAt,omitempty"`
	CreatedAt       time.Time               `bson:"createdAt" json:"createdAt" validate:"required"`
}