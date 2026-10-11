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

// ValidateTeamsMatch checks whether both teams are currently in the matchmaking pool
// and meet the criteria to be matched against each other.
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

	// Verify that the team sizes match
	if entry1.MaxSize != entry2.MaxSize {
		return errors.New("teams do not have matching team sizes")
	}

	// Verify that the Elo difference is within the acceptable range (<= 200)
	eloDiff := entry1.AverageElo - entry2.AverageElo
	if eloDiff < 0 {
		eloDiff = -eloDiff
	}
	if eloDiff > 200 {
		return errors.New("team Elo difference exceeds acceptable matchmaking range")
	}

	return nil
}

// IsTeamInMatchmaking checks if a specific team is currently in the matchmaking pool
func IsTeamInMatchmaking(teamID primitive.ObjectID) bool {
	teamMatchmakingMutex.RLock()
	defer teamMatchmakingMutex.RUnlock()

	if teamMatchmakingPool == nil {
		return false
	}
	_, exists := teamMatchmakingPool[teamID.Hex()]
	return exists
}

// AddTeamToMatchmakingPoolDirect adds a team directly to the pool (useful for testing or direct matching)
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

// ClearMatchmakingPool clears all teams from the matchmaking pool (useful for cleanup and testing)
func ClearMatchmakingPool() {
	teamMatchmakingMutex.Lock()
	defer teamMatchmakingMutex.Unlock()

	teamMatchmakingPool = make(map[string]*TeamMatchmakingEntry)
}
