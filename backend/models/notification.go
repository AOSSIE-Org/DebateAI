package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type NotificationType string

const (
	NotificationTypeComment     NotificationType = "comment"
	NotificationTypeBadge       NotificationType = "badge"
	NotificationTypeTournament  NotificationType = "tournament"
	NotificationTypeLeaderboard NotificationType = "leaderboard"
	NotificationTypeSystem      NotificationType = "system"
)

type Notification struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserID    primitive.ObjectID `bson:"userId" json:"userId"`
	Type      NotificationType   `bson:"type" json:"type"`
	Title     string             `bson:"title" json:"title"`
	Message   string             `bson:"message" json:"message"`
	Link      string             `bson:"link,omitempty" json:"link,omitempty"`
	IsRead    bool               `bson:"isRead" json:"isRead"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
}
