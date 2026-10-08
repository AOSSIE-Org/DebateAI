package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type TournamentFormat string

const (
	FormatSingleElimination TournamentFormat = "SingleElimination"
	FormatSwiss             TournamentFormat = "Swiss"
	FormatRoundRobin        TournamentFormat = "RoundRobin"
)

type TournamentStatus string

const (
	TournamentStatusRegistration TournamentStatus = "Registration"
	TournamentStatusInProgress   TournamentStatus = "InProgress"
	TournamentStatusCompleted    TournamentStatus = "Completed"
	TournamentStatusCancelled    TournamentStatus = "Cancelled"
)

type MatchStatus string

const (
	MatchStatusScheduled  MatchStatus = "Scheduled"
	MatchStatusInProgress MatchStatus = "InProgress"
	MatchStatusCompleted  MatchStatus = "Completed"
	MatchStatusBye        MatchStatus = "Bye"
)

type TournamentParticipant struct {
	UserID       primitive.ObjectID `json:"user_id" bson:"user_id"`
	Username     string             `json:"username" bson:"username"`
	DisplayName  string             `json:"display_name" bson:"display_name"`
	Seed         int                `json:"seed" bson:"seed"`
	Score        float64            `json:"score" bson:"score"`
	Eliminated   bool               `json:"eliminated" bson:"eliminated"`
	RegisteredAt time.Time          `json:"registered_at" bson:"registered_at"`
}

type TournamentMatch struct {
	MatchID     string                 `json:"match_id" bson:"match_id"`
	RoundNumber int                    `json:"round_number" bson:"round_number"`
	MatchNumber int                    `json:"match_number" bson:"match_number"`
	Debater1    *TournamentParticipant `json:"debater1,omitempty" bson:"debater1,omitempty"`
	Debater2    *TournamentParticipant `json:"debater2,omitempty" bson:"debater2,omitempty"`
	WinnerID    *primitive.ObjectID    `json:"winner_id,omitempty" bson:"winner_id,omitempty"`
	Score1      float64                `json:"score1" bson:"score1"`
	Score2      float64                `json:"score2" bson:"score2"`
	Topic       string                 `json:"topic" bson:"topic"`
	Status      MatchStatus            `json:"status" bson:"status"`
	RoomID      string                 `json:"room_id,omitempty" bson:"room_id,omitempty"`
	StartedAt   *time.Time             `json:"started_at,omitempty" bson:"started_at,omitempty"`
	CompletedAt *time.Time             `json:"completed_at,omitempty" bson:"completed_at,omitempty"`
}

type TournamentRound struct {
	RoundNumber int               `json:"round_number" bson:"round_number"`
	Name        string            `json:"name" bson:"name"`
	Status      string            `json:"status" bson:"status"` // "Pending", "Active", "Completed"
	Matches     []TournamentMatch `json:"matches" bson:"matches"`
}

type Tournament struct {
	ID              primitive.ObjectID      `json:"id" bson:"_id,omitempty"`
	Title           string                  `json:"title" bson:"title"`
	Description     string                  `json:"description" bson:"description"`
	Topic           string                  `json:"topic" bson:"topic"`
	TopicsPool      []string                `json:"topics_pool,omitempty" bson:"topics_pool,omitempty"`
	Format          TournamentFormat        `json:"format" bson:"format"`
	Status          TournamentStatus        `json:"status" bson:"status"`
	MaxParticipants int                     `json:"max_participants" bson:"max_participants"`
	CurrentRound    int                     `json:"current_round" bson:"current_round"`
	TotalRounds     int                     `json:"total_rounds" bson:"total_rounds"`
	Participants    []TournamentParticipant `json:"participants" bson:"participants"`
	Rounds          []TournamentRound       `json:"rounds" bson:"rounds"`
	Winner          *TournamentParticipant  `json:"winner,omitempty" bson:"winner,omitempty"`
	CreatedBy       primitive.ObjectID      `json:"created_by" bson:"created_by"`
	CreatedAt       time.Time               `json:"created_at" bson:"created_at"`
	UpdatedAt       time.Time               `json:"updated_at" bson:"updated_at"`
}
