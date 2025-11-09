package services

import (
	"context"
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
	err := collection.FindOne(context.Background(), bson.M{"_id": teamID}).Decode(&team)
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
		teamMatchmakingPool = make(map[string]*TeamMatchmakingEntry)
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
	for id, entry := range teamMatchmakingPool {
		snapshot[id] = entry
	}
	return snapshot
}
