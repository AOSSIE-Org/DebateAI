package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Admin represents an admin or moderator user
type Admin struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Email     string             `bson:"email" json:"email"`
	Password  string             `bson:"password" json:"-"` // Never return password in JSON
	Role      string             `bson:"role" json:"role"`  // "admin" or "moderator"
	Name      string             `bson:"name" json:"name"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// AdminComment represents a comment that can be moderated
// Renamed from Comment to AdminComment to avoid collision with models/comment.go
type AdminComment struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Type        string             `bson:"type" json:"type"` // "team_debate_message", "team_chat_message", "debate_vs_bot_message"
	Content     string             `bson:"content" json:"content"`
	UserID      primitive.ObjectID `bson:"userId" json:"userId"`
	UserEmail   string             `bson:"userEmail" json:"userEmail"`
	DisplayName string             `bson:"displayName" json:"displayName"`
	DebateID    primitive.ObjectID `bson:"debateId,omitempty" json:"debateId,omitempty"`
	TeamID      primitive.ObjectID `bson:"teamId,omitempty" json:"teamId,omitempty"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	IsDeleted   bool               `bson:"isDeleted" json:"isDeleted"`
	DeletedAt   *time.Time         `bson:"deletedAt,omitempty" json:"deletedAt,omitempty"`
	DeletedBy   *primitive.ObjectID `bson:"deletedBy,omitempty" json:"deletedBy,omitempty"`
}

// AdminActionLog represents a log entry for admin actions
type AdminActionLog struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	AdminID     primitive.ObjectID `bson:"adminId" json:"adminId"`
	AdminEmail  string             `bson:"adminEmail" json:"adminEmail"`
	Action      string             `bson:"action" json:"action"` // "delete_debate", "delete_comment", etc.
	ResourceType string            `bson:"resourceType" json:"resourceType"` // "debate", "comment", etc.
	ResourceID   primitive.ObjectID `bson:"resourceId" json:"resourceId"`
	IPAddress    string            `bson:"ipAddress" json:"ipAddress"`
	UserAgent    string            `bson:"userAgent" json:"userAgent"`
	DeviceInfo   string            `bson:"deviceInfo,omitempty" json:"deviceInfo,omitempty"`
	Timestamp    time.Time         `bson:"timestamp" json:"timestamp"`
	Details      map[string]interface{} `bson:"details,omitempty" json:"details,omitempty"`
}

// AnalyticsSnapshot represents analytics data at a point in time
type AnalyticsSnapshot struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Timestamp     time.Time          `bson:"timestamp" json:"timestamp"`
	TotalDebates  int64              `bson:"totalDebates" json:"totalDebates"`
	ActiveUsers   int64              `bson:"activeUsers" json:"activeUsers"` // Users active in last 30 days
	TotalComments int64              `bson:"totalComments" json:"totalComments"`
	TotalUsers    int64              `bson:"totalUsers" json:"totalUsers"`
	DebatesToday  int64              `bson:"debatesToday" json:"debatesToday"`
	CommentsToday int64              `bson:"commentsToday" json:"commentsToday"`
	NewUsersToday int64              `bson:"newUsersToday" json:"newUsersToday"`
}