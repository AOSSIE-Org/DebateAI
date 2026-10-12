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

	// Find teams with matching size and similar elo
	for teamID, entry := range teamMatchmakingPool {
		if teamID == lookingTeamID.Hex() {
			continue
		}

		// Check if sizes match
		if entry.MaxSize == lookingEntry.MaxSize {
			// Check if elo difference is acceptable (within 200 points)
			eloDiff := entry.AverageElo - lookingEntry.AverageElo
			if eloDiff < 0 {
				eloDiff = -eloDiff
			}

			if eloDiff <= 200 {
				return &entry.Team, nil
			}
		}
	}

	return nil, mongo.ErrNoDocuments
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

// ClaimMatchedTeams atomically validates that both teams are present in the matchmaking pool,
// share matching team sizes, and have an Elo difference within the allowed 200 threshold,
// then removes both entries from the pool to prevent concurrent requests from claiming them.
func ClaimMatchedTeams(team1ID, team2ID primitive.ObjectID) (map[string]*TeamMatchmakingEntry, error) {
	teamMatchmakingMutex.Lock()
	defer teamMatchmakingMutex.Unlock()

	if teamMatchmakingPool == nil {
		return nil, errors.New("neither team is in the matchmaking pool")
	}

	entry1, exists1 := teamMatchmakingPool[team1ID.Hex()]
	if !exists1 {
		return nil, errors.New("team 1 is not in the matchmaking pool")
	}

	entry2, exists2 := teamMatchmakingPool[team2ID.Hex()]
	if !exists2 {
		return nil, errors.New("team 2 is not in the matchmaking pool")
	}

	if entry1.MaxSize != entry2.MaxSize {
		return nil, errors.New("teams do not have matching team sizes")
	}

	eloDiff := entry1.AverageElo - entry2.AverageElo
	if eloDiff < 0 {
		eloDiff = -eloDiff
	}
	if eloDiff > 200 {
		return nil, errors.New("team Elo difference exceeds acceptable matchmaking range")
	}

	delete(teamMatchmakingPool, team1ID.Hex())
	delete(teamMatchmakingPool, team2ID.Hex())

	return map[string]*TeamMatchmakingEntry{
		team1ID.Hex(): entry1,
		team2ID.Hex(): entry2,
	}, nil
}

// RestoreClaimedTeams restores previously claimed matchmaking entries back to the pool
// if debate creation fails, ensuring newer pool updates are not overwritten.
func RestoreClaimedTeams(claimed map[string]*TeamMatchmakingEntry) {
	if len(claimed) == 0 {
		return
	}
	teamMatchmakingMutex.Lock()
	defer teamMatchmakingMutex.Unlock()

	if teamMatchmakingPool == nil {
		teamMatchmakingPool = make(map[string]*TeamMatchmakingEntry)
	}

	for id, entry := range claimed {
		existing, exists := teamMatchmakingPool[id]
		if !exists || existing.Timestamp.Before(entry.Timestamp) {
			teamMatchmakingPool[id] = entry
		}
	}
}

// ValidateTeamsMatch checks whether both teams are currently in the matchmaking pool
// and meet matching criteria (same size and Elo difference <= 200) without removing them.
func ValidateTeamsMatch(team1ID, team2ID primitive.ObjectID) error {
	teamMatchmakingMutex.RLock()
	defer teamMatchmakingMutex.RUnlock()

	if teamMatchmakingPool == nil {
		return errors.New("neither team is in the matchmaking pool")
	}

	entry1, exists1 := teamMatchmakingPool[team1ID.Hex()]
	if !exists1 {
		return errors.New("team 1 is not in the matchmaking pool")
	}

	entry2, exists2 := teamMatchmakingPool[team2ID.Hex()]
	if !exists2 {
		return errors.New("team 2 is not in the matchmaking pool")
	}

	if entry1.MaxSize != entry2.MaxSize {
		return errors.New("teams do not have matching team sizes")
	}

	eloDiff := entry1.AverageElo - entry2.AverageElo
	if eloDiff < 0 {
		eloDiff = -eloDiff
	}
	if eloDiff > 200 {
		return errors.New("team Elo difference exceeds acceptable matchmaking range")
	}

	return nil
}

// IsTeamInMatchmaking reports whether the specified team currently resides in the matchmaking pool.
func IsTeamInMatchmaking(teamID primitive.ObjectID) bool {
	teamMatchmakingMutex.RLock()
	defer teamMatchmakingMutex.RUnlock()

	if teamMatchmakingPool == nil {
		return false
	}
	_, exists := teamMatchmakingPool[teamID.Hex()]
	return exists
}

// AddTeamToMatchmakingPoolDirect inserts a team directly into the pool for testing or direct matching.
func AddTeamToMatchmakingPoolDirect(team models.Team) {
	teamMatchmakingMutex.Lock()
	defer teamMatchmakingMutex.Unlock()

	if teamMatchmakingPool == nil {
		teamMatchmakingPool = make(map[string]*TeamMatchmakingEntry)
	}

	teamMatchmakingPool[team.ID.Hex()] = &TeamMatchmakingEntry{
		TeamID:     team.ID,
		Team:       team,
		MaxSize:    team.MaxSize,
		AverageElo: team.AverageElo,
		Timestamp:  time.Now(),
	}
}

// ClearMatchmakingPool removes all queued entries from the matchmaking pool.
func ClearMatchmakingPool() {
	teamMatchmakingMutex.Lock()
	defer teamMatchmakingMutex.Unlock()

	teamMatchmakingPool = make(map[string]*TeamMatchmakingEntry)
}
