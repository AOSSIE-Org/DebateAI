package models

import (
	"encoding/json"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// TournamentStatus represents the current lifecycle stage of a tournament
type TournamentStatus string

const (
	TournamentStatusUpcoming  TournamentStatus = "upcoming"
	TournamentStatusLive      TournamentStatus = "live"
	TournamentStatusCompleted TournamentStatus = "completed"
)

// MatchStatus represents the status of an individual tournament match
type MatchStatus string

const (
	MatchStatusPending    MatchStatus = "pending"     // Waiting for participants from previous rounds
	MatchStatusReady      MatchStatus = "ready"       // Both participants assigned, ready to play
	MatchStatusInProgress MatchStatus = "in_progress" // Debate ongoing
	MatchStatusCompleted  MatchStatus = "completed"   // Winner decided
)

// TournamentCategory represents the communication medium for debate matches
type TournamentCategory string

const (
	TournamentCategoryChat       TournamentCategory = "chat"
	TournamentCategoryVoice      TournamentCategory = "voice"
	TournamentCategoryVoiceVideo TournamentCategory = "voice+video"
)

// TournamentFormat defines the bracket structure
type TournamentFormat string

const (
	TournamentFormatSingleElimination TournamentFormat = "single_elimination"
)

// TournamentParticipant represents a competitor in the tournament
type TournamentParticipant struct {
	ID        string  `bson:"id" json:"id"`
	Name      string  `bson:"name" json:"name"`
	AvatarURL string  `bson:"avatarUrl,omitempty" json:"avatarUrl,omitempty"`
	Seed      int     `bson:"seed,omitempty" json:"seed,omitempty"`
	Elo       float64 `bson:"elo,omitempty" json:"elo,omitempty"`
}

// TournamentMatch represents a single debate match within a tournament bracket
type TournamentMatch struct {
	ID            string                 `bson:"id" json:"id"`
	RoundIndex    int                    `bson:"roundIndex" json:"roundIndex"`
	MatchIndex    int                    `bson:"matchIndex" json:"matchIndex"`
	Participant1  *TournamentParticipant `bson:"participant1,omitempty" json:"participant1"`
	Participant2  *TournamentParticipant `bson:"participant2,omitempty" json:"participant2"`
	Winner        *TournamentParticipant `bson:"winner,omitempty" json:"winner"`
	WinnerID      string                 `bson:"winnerId,omitempty" json:"winnerId,omitempty"`
	Status        MatchStatus            `bson:"status" json:"status"`
	DebateRoomID  string                 `bson:"debateRoomId,omitempty" json:"debateRoomId,omitempty"`
	Scores        map[string]string      `bson:"scores,omitempty" json:"scores,omitempty"`
	NextMatchID   string                 `bson:"nextMatchId,omitempty" json:"nextMatchId,omitempty"`
	NextMatchSlot int                    `bson:"nextMatchSlot,omitempty" json:"nextMatchSlot,omitempty"` // 1 for Participant1, 2 for Participant2
}

// TournamentRound represents a column/stage in the tournament bracket
type TournamentRound struct {
	RoundIndex int               `bson:"roundIndex" json:"roundIndex"`
	Name       string            `bson:"name" json:"name"`
	Matches    []TournamentMatch `bson:"matches" json:"matches"`
}

// TournamentBracket represents the full single-elimination tournament tree
type TournamentBracket struct {
	TotalParticipants int                    `bson:"totalParticipants" json:"totalParticipants"`
	TotalRounds       int                    `bson:"totalRounds" json:"totalRounds"`
	Rounds            []TournamentRound      `bson:"rounds" json:"rounds"`
	Champion          *TournamentParticipant `bson:"champion,omitempty" json:"champion"`
	Status            TournamentStatus       `bson:"status" json:"status"`
}

// Tournament represents a full tournament entity in the database
type Tournament struct {
	ID                  primitive.ObjectID      `bson:"_id,omitempty" json:"id,omitempty"`
	Name                string                  `bson:"name" json:"name"`
	Description         string                  `bson:"description" json:"description"`
	Category            TournamentCategory      `bson:"category" json:"category"`
	Format              TournamentFormat        `bson:"format" json:"format"`
	Status              TournamentStatus        `bson:"status" json:"status"`
	MaxParticipants     int                     `bson:"maxParticipants" json:"maxParticipants"`
	CurrentParticipants int                     `bson:"currentParticipants" json:"currentParticipants"`
	Participants        []TournamentParticipant `bson:"participants" json:"participants"`
	IsPrivate           bool                    `bson:"isPrivate" json:"isPrivate"`
	InviteCode          string                  `bson:"inviteCode,omitempty" json:"inviteCode,omitempty"`
	ModeratorID         primitive.ObjectID      `bson:"moderatorId,omitempty" json:"moderatorId,omitempty"`
	ModeratorEmail      string                  `bson:"moderatorEmail,omitempty" json:"moderatorEmail,omitempty"`
	StartDate           time.Time               `bson:"startDate" json:"startDate"`
	Bracket             *TournamentBracket      `bson:"bracket,omitempty" json:"bracket,omitempty"`
	CreatedAt           time.Time               `bson:"createdAt" json:"createdAt"`
	UpdatedAt           time.Time               `bson:"updatedAt" json:"updatedAt"`
}

// MarshalJSON customizes JSON serialization for Tournament to convert ObjectIDs to strings
func (t Tournament) MarshalJSON() ([]byte, error) {
	type Alias Tournament
	idStr := ""
	if !t.ID.IsZero() {
		idStr = t.ID.Hex()
	}
	modStr := ""
	if !t.ModeratorID.IsZero() {
		modStr = t.ModeratorID.Hex()
	}
	return json.Marshal(&struct {
		ID          string `json:"id,omitempty"`
		ModeratorID string `json:"moderatorId,omitempty"`
		*Alias
	}{
		ID:          idStr,
		ModeratorID: modStr,
		Alias:       (*Alias)(&t),
	})
}
