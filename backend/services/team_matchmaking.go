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
	// reservedTeams holds teams that were claimed for a debate that is still
	// being created. They cannot re-enter the pool until released.
	reservedTeams = make(map[string]struct{})
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
	return addTeamToPool(team)
}

// addTeamToPool inserts a team into the pool unless it is reserved.
func addTeamToPool(team models.Team) error {
	teamMatchmakingMutex.Lock()
	defer teamMatchmakingMutex.Unlock()

	if _, reserved := reservedTeams[team.ID.Hex()]; reserved {
		return ErrTeamReserved
	}

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

// maxMatchmakingEloDiff is the largest Elo gap allowed between matched teams.
const maxMatchmakingEloDiff = 200

// teamsCompatible reports whether two pool entries have the same size and a close Elo.
func teamsCompatible(a, b *TeamMatchmakingEntry) bool {
	return withinMatchCriteria(a.MaxSize, b.MaxSize, a.AverageElo, b.AverageElo)
}

// TeamsStillEligible re-checks the criteria against current team data;
func TeamsStillEligible(a, b *models.Team) bool {
	if len(a.Members) < a.MaxSize || len(b.Members) < b.MaxSize {
		return false
	}
	return withinMatchCriteria(a.MaxSize, b.MaxSize, a.AverageElo, b.AverageElo)
}

// withinMatchCriteria applies the shared size and Elo matching rule.
func withinMatchCriteria(size1, size2 int, elo1, elo2 float64) bool {
	if size1 != size2 {
		return false
	}
	eloDiff := elo1 - elo2
	if eloDiff < 0 {
		eloDiff = -eloDiff
	}
	return eloDiff <= maxMatchmakingEloDiff
}

// ErrTeamReserved is returned when a team joins while reserved for a debate being created.
var ErrTeamReserved = errors.New("team is reserved for a debate being created")

// ErrTeamsNotMatched is returned when the teams are not both matched in the pool.
var ErrTeamsNotMatched = errors.New("teams are not matched in matchmaking")

// ClaimMatchedTeams atomically verifies both teams are in the pool and
// compatible. It then removes them from the pool and reserves them. They
// cannot rejoin (or be claimed again) until the caller calls ReleaseClaim.
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
	reservedTeams[team1ID.Hex()] = struct{}{}
	reservedTeams[team2ID.Hex()] = struct{}{}
	return []*TeamMatchmakingEntry{entry1, entry2}, nil
}

// ReleaseClaim ends a reservation, optionally putting the teams back in the pool.
func ReleaseClaim(entries []*TeamMatchmakingEntry, requeue bool) {
	teamMatchmakingMutex.Lock()
	defer teamMatchmakingMutex.Unlock()

	if teamMatchmakingPool == nil {
		teamMatchmakingPool = make(map[string]*TeamMatchmakingEntry)
	}
	for _, entry := range entries {
		delete(reservedTeams, entry.TeamID.Hex())
		if requeue {
			teamMatchmakingPool[entry.TeamID.Hex()] = entry
		}
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
