package services

import (
	"context"
	"errors"
	"sync"
	"time"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

var (
	teamMatchmakingPool  map[string]*TeamMatchmakingEntry // teamID -> entry
	teamMatchmakingMutex sync.RWMutex
)

type TeamMatchmakingEntry struct {
	TeamID     primitive.ObjectID
	Team       models.Team
	MaxSize    int
	AverageElo float64
	Timestamp  time.Time
}

// StartTeamMatchmaking adds a team to the matchmaking pool
func StartTeamMatchmaking(teamID primitive.ObjectID) error {
	// Get team details
	collection := db.GetCollection("teams")
	var team models.Team
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err := collection.FindOne(ctx, bson.M{"_id": teamID}).Decode(&team)
	if err != nil {
		return err
	}

	// Check if team is full
	if len(team.Members) < team.MaxSize {
		return mongo.ErrNoDocuments // Team not ready
	}

	teamMatchmakingMutex.Lock()
	defer teamMatchmakingMutex.Unlock()

	// Initialize pool if it doesn't exist
	if teamMatchmakingPool == nil {
		teamMatchmakingPool = make(map[string]*TeamMatchmakingEntry)
	}

	teamMatchmakingPool[teamID.Hex()] = &TeamMatchmakingEntry{
		TeamID:     teamID,
		Team:       team,
		MaxSize:    team.MaxSize,
		AverageElo: team.AverageElo,
		Timestamp:  time.Now(),
	}

	return nil
}

// FindMatchingTeam finds a team that matches the given team's criteria
func FindMatchingTeam(lookingTeamID primitive.ObjectID) (*models.Team, error) {
	teamMatchmakingMutex.RLock()
	defer teamMatchmakingMutex.RUnlock()

	if teamMatchmakingPool == nil {
		return nil, mongo.ErrNoDocuments
	}

	lookingEntry, exists := teamMatchmakingPool[lookingTeamID.Hex()]
	if !exists {
		return nil, mongo.ErrNoDocuments
	}

	for teamID, entry := range teamMatchmakingPool {
		if teamID == lookingTeamID.Hex() {
			continue
		}

		if teamsCompatible(lookingEntry, entry) {
			return &entry.Team, nil
		}
	}
	return nil, mongo.ErrNoDocuments
}

const maxMatchmakingEloDiff = 200

func teamsCompatible(a, b *TeamMatchmakingEntry) bool {
	if a.MaxSize != b.MaxSize {
		return false
	}
	eloDiff := a.AverageElo - b.AverageElo
	if eloDiff < 0 {
		eloDiff = -eloDiff
	}
	return eloDiff <= maxMatchmakingEloDiff
}

// ErrTeamsNotMatched is returned when two teams are not both in the
// matchmaking pool or do not satisfy the matchmaking criteria.
var ErrTeamsNotMatched = errors.New("teams are not matched in matchmaking")

// ClaimMatchedTeams atomically verifies both teams are in the pool and
// compatible, then removes them so no other request can reuse them. Callers
// should call RestoreToMatchmaking if later steps fail.
func ClaimMatchedTeams(team1ID, team2ID primitive.ObjectID) ([]*TeamMatchmakingEntry, error) {
	teamMatchmakingMutex.Lock()
	defer teamMatchmakingMutex.Unlock()

	if teamMatchmakingPool == nil || team1ID == team2ID {
		return nil, ErrTeamsNotMatched
	}

	entry1, ok1 := teamMatchmakingPool[team1ID.Hex()]
	entry2, ok2 := teamMatchmakingPool[team2ID.Hex()]
	if !ok1 || !ok2 || !teamsCompatible(entry1, entry2) {
		return nil, ErrTeamsNotMatched
	}

	delete(teamMatchmakingPool, team1ID.Hex())
	delete(teamMatchmakingPool, team2ID.Hex())
	return []*TeamMatchmakingEntry{entry1, entry2}, nil
}

// RestoreToMatchmaking puts previously claimed entries back in the pool.
func RestoreToMatchmaking(entries []*TeamMatchmakingEntry) {
	teamMatchmakingMutex.Lock()
	defer teamMatchmakingMutex.Unlock()

	if teamMatchmakingPool == nil {
		teamMatchmakingPool = make(map[string]*TeamMatchmakingEntry)
	}
	for _, entry := range entries {
		teamMatchmakingPool[entry.TeamID.Hex()] = entry
	}
}

// RemoveFromMatchmaking removes a team from the matchmaking pool
func RemoveFromMatchmaking(teamID primitive.ObjectID) {
	teamMatchmakingMutex.Lock()
	defer teamMatchmakingMutex.Unlock()

	if teamMatchmakingPool != nil {
		delete(teamMatchmakingPool, teamID.Hex())
	}
}

// GetMatchmakingPool returns all teams in matchmaking pool
func GetMatchmakingPool() map[string]*TeamMatchmakingEntry {
	teamMatchmakingMutex.RLock()
	defer teamMatchmakingMutex.RUnlock()

	if teamMatchmakingPool == nil {
		return make(map[string]*TeamMatchmakingEntry)
	}
	snapshot := make(map[string]*TeamMatchmakingEntry, len(teamMatchmakingPool))
	for teamID, entry := range teamMatchmakingPool {
		clone := *entry
		snapshot[teamID] = &clone
	}
	return snapshot
}
