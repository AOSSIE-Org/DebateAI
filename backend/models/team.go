package models

import (
	"encoding/json"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Team represents a debate team
type Team struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Name         string             `bson:"name" json:"name"`
	Code         string             `bson:"code" json:"code"` // Unique team code
	CaptainID    primitive.ObjectID `bson:"captainId" json:"captainId"`
	CaptainEmail string             `bson:"captainEmail" json:"captainEmail"`
	Members      []TeamMember       `bson:"members" json:"members"`
	MaxSize      int                `bson:"maxSize" json:"maxSize"` // Maximum team size for matching
	AverageElo   float64            `bson:"averageElo" json:"averageElo"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// TeamMember represents a member of a team
type TeamMember struct {
	UserID      primitive.ObjectID `bson:"userId" json:"userId"`
	Email       string             `bson:"email" json:"email"`
	DisplayName string             `bson:"displayName" json:"displayName"`
	AvatarURL   string             `bson:"avatarUrl,omitempty" json:"avatarUrl,omitempty"`
	Elo         float64            `bson:"elo" json:"elo"`
	JoinedAt    time.Time          `bson:"joinedAt" json:"joinedAt"`
}

// MarshalJSON customizes JSON serialization for Team to convert ObjectIDs to hex strings
func (t Team) MarshalJSON() ([]byte, error) {
	type Alias Team
	return json.Marshal(&struct {
		ID        string `json:"id,omitempty"`
		CaptainID string `json:"captainId"`
		*Alias
	}{
		ID:        t.ID.Hex(),
		CaptainID: t.CaptainID.Hex(),
		Alias:     (*Alias)(&t),
	})
}

// MarshalJSON customizes JSON serialization for TeamMember to convert ObjectIDs to hex strings
func (tm TeamMember) MarshalJSON() ([]byte, error) {
	type Alias TeamMember
	return json.Marshal(&struct {
		UserID string `json:"userId"`
		*Alias
	}{
		UserID: tm.UserID.Hex(),
		Alias:  (*Alias)(&tm),
	})
}

// TeamDebate represents a debate between two teams
type TeamDebate struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Team1ID       primitive.ObjectID `bson:"team1Id" json:"team1Id"`
	Team2ID       primitive.ObjectID `bson:"team2Id" json:"team2Id"`
	Team1Name     string             `bson:"team1Name" json:"team1Name"`
	Team2Name     string             `bson:"team2Name" json:"team2Name"`
	Team1Members  []TeamMember       `bson:"team1Members" json:"team1Members"`
	Team2Members  []TeamMember       `bson:"team2Members" json:"team2Members"`
	Topic         string             `bson:"topic" json:"topic"`
	Team1Stance   string             `bson:"team1Stance" json:"team1Stance"` // "for" or "against"
	Team2Stance   string             `bson:"team2Stance" json:"team2Stance"` // "for" or "against"
	Status        string             `bson:"status" json:"status"`           // "waiting", "active", "finished"
	CurrentTurn   string             `bson:"currentTurn" json:"currentTurn"` // "team1" or "team2"
	CurrentUserID primitive.ObjectID `bson:"currentUserId,omitempty" json:"currentUserId,omitempty"`
	TurnCount     int                `bson:"turnCount" json:"turnCount"`
	MaxTurns      int                `bson:"maxTurns" json:"maxTurns"`
	Team1Elo      float64            `bson:"team1Elo" json:"team1Elo"`
	Team2Elo      float64            `bson:"team2Elo" json:"team2Elo"`
	CreatedAt     time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt     time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// TeamDebateMessage represents a message in a team debate
type TeamDebateMessage struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	DebateID    primitive.ObjectID `bson:"debateId" json:"debateId"`
	TeamID      primitive.ObjectID `bson:"teamId" json:"teamId"`
	UserID      primitive.ObjectID `bson:"userId" json:"userId"`
	Email       string             `bson:"email" json:"email"`
	DisplayName string             `bson:"displayName" json:"displayName"`
	AvatarURL   string             `bson:"avatarUrl,omitempty" json:"avatarUrl,omitempty"`
	Message     string             `bson:"message" json:"message"`
	Type        string             `bson:"type" json:"type"` // "user", "system"
	Timestamp   time.Time          `bson:"timestamp" json:"timestamp"`
}

// TeamChatMessage represents a message in team chat
type TeamChatMessage struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	TeamID      primitive.ObjectID `bson:"teamId" json:"teamId"`
	UserID      primitive.ObjectID `bson:"userId" json:"userId"`
	Email       string             `bson:"email" json:"email"`
	DisplayName string             `bson:"displayName" json:"displayName"`
	Message     string             `bson:"message" json:"message"`
	Timestamp   time.Time          `bson:"timestamp" json:"timestamp"`
}

// MarshalJSON customizes JSON serialization for TeamDebate to convert ObjectIDs to hex strings
func (td TeamDebate) MarshalJSON() ([]byte, error) {
	type Alias TeamDebate
	var currentUserHex *string
	if !td.CurrentUserID.IsZero() {
		hex := td.CurrentUserID.Hex()
		currentUserHex = &hex
	}
	return json.Marshal(&struct {
		ID            string  `json:"id,omitempty"`
		Team1ID       string  `json:"team1Id"`
		Team2ID       string  `json:"team2Id"`
		CurrentUserID *string `json:"currentUserId,omitempty"`
		*Alias
	}{
		ID:            td.ID.Hex(),
		Team1ID:       td.Team1ID.Hex(),
		Team2ID:       td.Team2ID.Hex(),
		CurrentUserID: currentUserHex,
		Alias:         (*Alias)(&td),
	})
}

// MarshalJSON customizes JSON serialization for TeamDebateMessage to convert ObjectIDs to hex strings
func (tdm TeamDebateMessage) MarshalJSON() ([]byte, error) {
	type Alias TeamDebateMessage
	return json.Marshal(&struct {
		ID       string `json:"id,omitempty"`
		DebateID string `json:"debateId"`
		TeamID   string `json:"teamId"`
		UserID   string `json:"userId"`
		*Alias
	}{
		ID:       tdm.ID.Hex(),
		DebateID: tdm.DebateID.Hex(),
		TeamID:   tdm.TeamID.Hex(),
		UserID:   tdm.UserID.Hex(),
		Alias:    (*Alias)(&tdm),
	})
}

// MarshalJSON customizes JSON serialization for TeamChatMessage to convert ObjectIDs to hex strings
func (tcm TeamChatMessage) MarshalJSON() ([]byte, error) {
	type Alias TeamChatMessage
	return json.Marshal(&struct {
		ID     string `json:"id,omitempty"`
		TeamID string `json:"teamId"`
		UserID string `json:"userId"`
		*Alias
	}{
		ID:     tcm.ID.Hex(),
		TeamID: tcm.TeamID.Hex(),
		UserID: tcm.UserID.Hex(),
		Alias:  (*Alias)(&tcm),
	})
}
