package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Category constants
const (
	CategoryChatOnly   = "chat_only"
	CategoryVoiceOnly  = "voice_only"
	CategoryVoiceVideo = "voice_video"
)

// Status constants
const (
	StatusUpcoming  = "upcoming"
	StatusLive      = "live"
	StatusCompleted = "completed"
)

// Visibility constants
const (
	VisibilityPublic  = "public"
	VisibilityPrivate = "private"
)

type Tournament struct {
	ID              primitive.ObjectID   `bson:"_id,omitempty" json:"id,omitempty"`
	HostID          primitive.ObjectID   `bson:"hostId" json:"hostId"`
	HostName        string               `bson:"hostName" json:"hostName"`
	ModeratorName   string               `bson:"moderatorName" json:"moderatorName"`
	Name            string               `bson:"name" json:"name"`
	Description     string               `bson:"description" json:"description"`
	Category        string               `bson:"category" json:"category"`
	Status          string               `bson:"status" json:"status"`
	Visibility      string               `bson:"visibility" json:"visibility"`
	MinParticipants int                  `bson:"minParticipants" json:"minParticipants"`
	MaxParticipants int                  `bson:"maxParticipants" json:"maxParticipants"`
	Participants    []primitive.ObjectID `bson:"participants" json:"participants"`
	InviteCode      string               `bson:"inviteCode,omitempty" json:"inviteCode,omitempty"`
	ScheduleAt      *time.Time           `bson:"scheduleAt,omitempty" json:"scheduleAt,omitempty"`
	CreatedAt       time.Time            `bson:"createdAt" json:"createdAt"`
}