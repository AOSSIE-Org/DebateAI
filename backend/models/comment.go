package models

import (
	"encoding/json"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Comment represents a nested comment on a debate transcript
type Comment struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	TranscriptID primitive.ObjectID `bson:"transcriptId" json:"transcriptId"`
	ParentID  *primitive.ObjectID `bson:"parentId,omitempty" json:"parentId,omitempty"`
	Path      []string           `bson:"path" json:"path"` // Array of IDs for nesting
	Content   string             `bson:"content" json:"content"`
	UserID    primitive.ObjectID `bson:"userId" json:"userId"`
	Email     string             `bson:"email" json:"email"`
	DisplayName string           `bson:"displayName" json:"displayName"`
	AvatarURL string             `bson:"avatarUrl,omitempty" json:"avatarUrl,omitempty"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// MarshalJSON customizes JSON serialization for Comment to convert ObjectIDs to hex strings
func (c Comment) MarshalJSON() ([]byte, error) {
	type Alias Comment
	parentIDStr := ""
	if c.ParentID != nil {
		parentIDStr = c.ParentID.Hex()
	}
	return json.Marshal(&struct {
		ID          string `json:"id"`
		TranscriptID string `json:"transcriptId"`
		ParentID    string `json:"parentId,omitempty"`
		UserID      string `json:"userId"`
		Alias
	}{
		ID:          c.ID.Hex(),
		TranscriptID: c.TranscriptID.Hex(),
		ParentID:    parentIDStr,
		UserID:      c.UserID.Hex(),
		Alias:       (Alias)(c),
	})
}

// DebatePost represents a public post (debate transcript) that can be commented on
type DebatePost struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	TranscriptID    primitive.ObjectID `bson:"transcriptId" json:"transcriptId"`
	UserID          primitive.ObjectID `bson:"userId" json:"userId"`
	Email           string             `bson:"email" json:"email"`
	DisplayName     string             `bson:"displayName" json:"displayName"`
	AvatarURL       string             `bson:"avatarUrl,omitempty" json:"avatarUrl,omitempty"`
	Topic           string             `bson:"topic" json:"topic"`
	DebateType      string             `bson:"debateType" json:"debateType"`
	Opponent        string             `bson:"opponent" json:"opponent"`
	Result          string             `bson:"result" json:"result"`
	IsPublic        bool               `bson:"isPublic" json:"isPublic"`
	LikeCount       int64              `bson:"likeCount" json:"likeCount"`
	CommentCount    int64              `bson:"commentCount" json:"commentCount"`
	CreatedAt       time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// UserFollow represents a follow relationship between users
type UserFollow struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	FollowerID  primitive.ObjectID `bson:"followerId" json:"followerId"`
	FollowingID primitive.ObjectID `bson:"followingId" json:"followingId"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
}

