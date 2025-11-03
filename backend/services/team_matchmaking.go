package services

import (
	"context"
	"log"
	"sync"
	"time"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

var (
	teamMatchmakingPool map[string]*TeamMatchmakingEntry // teamID -> entry
	teamMatchmakingMutex sync.RWMutex
)

type TeamMatchmakingEntry struct {
	TeamID    primitive.ObjectID
	Team      models.Team
	MaxSize   int
	AverageElo float64
	Timestamp time.Time
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
		TeamID:    teamID,
		Team:      team,
		MaxSize:   team.MaxSize,
		AverageElo: team.AverageElo,
		Timestamp: time.Now(),
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

	// Log pool status for debugging
	log.Printf("Matchmaking pool size: %d, looking team: %s (Elo: %.2f)", 
		len(teamMatchmakingPool), lookingTeamID.Hex(), lookingEntry.AverageElo)

	// Find teams with matching size and similar elo
	for teamID, entry := range teamMatchmakingPool {
		if teamID == lookingTeamID.Hex() {
			continue
		}

		// Log each comparison
		log.Printf("Comparing %s (Elo: %.2f) with %s (Elo: %.2f)", 
			lookingTeamID.Hex(), lookingEntry.AverageElo,
			teamID, entry.AverageElo)

		// Check if sizes match
		if entry.MaxSize == lookingEntry.MaxSize {
			// Check if elo difference is acceptable (within 200 points)
			eloDiff := entry.AverageElo - lookingEntry.AverageElo
			if eloDiff < 0 {
				eloDiff = -eloDiff
			}
			
			log.Printf("Size match: %d, Elo diff: %.2f (threshold: 200)", entry.MaxSize, eloDiff)
			
			if eloDiff <= 200 {
				log.Printf("Match found! %s vs %s", lookingTeamID.Hex(), teamID)
				return &entry.Team, nil
			}
		}
	}

	log.Printf("No match found for team %s", lookingTeamID.Hex())
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
	return teamMatchmakingPool
}

