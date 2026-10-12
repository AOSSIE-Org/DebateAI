package services

import (
	"testing"
	"time"

	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func TestRemoveFromMatchmaking(t *testing.T) {
	teamID := primitive.NewObjectID()

	teamMatchmakingMutex.Lock()
	if teamMatchmakingPool == nil {
		teamMatchmakingPool = make(map[string]*TeamMatchmakingEntry)
	}
	teamMatchmakingPool[teamID.Hex()] = &TeamMatchmakingEntry{
		TeamID:     teamID,
		Team:       models.Team{ID: teamID, Name: "Test Team", MaxSize: 2},
		MaxSize:    2,
		AverageElo: 1500,
		Timestamp:  time.Now(),
	}
	teamMatchmakingMutex.Unlock()

	pool := GetMatchmakingPool()
	if _, exists := pool[teamID.Hex()]; !exists {
		t.Fatalf("expected team %s to be in pool before removal", teamID.Hex())
	}

	RemoveFromMatchmaking(teamID)

	poolAfter := GetMatchmakingPool()
	if _, exists := poolAfter[teamID.Hex()]; exists {
		t.Errorf("expected team %s to be removed from matchmaking pool", teamID.Hex())
	}
}

func TestFindMatchingTeam_RemovedTeamCannotBeMatched(t *testing.T) {
	team1ID := primitive.NewObjectID()
	team2ID := primitive.NewObjectID()

	teamMatchmakingMutex.Lock()
	if teamMatchmakingPool == nil {
		teamMatchmakingPool = make(map[string]*TeamMatchmakingEntry)
	}
	teamMatchmakingPool[team1ID.Hex()] = &TeamMatchmakingEntry{
		TeamID:     team1ID,
		Team:       models.Team{ID: team1ID, Name: "Team Alpha", MaxSize: 2},
		MaxSize:    2,
		AverageElo: 1500,
		Timestamp:  time.Now(),
	}
	teamMatchmakingPool[team2ID.Hex()] = &TeamMatchmakingEntry{
		TeamID:     team2ID,
		Team:       models.Team{ID: team2ID, Name: "Team Beta", MaxSize: 2},
		MaxSize:    2,
		AverageElo: 1520,
		Timestamp:  time.Now(),
	}
	teamMatchmakingMutex.Unlock()

	// Initial match should succeed
	matched, err := FindMatchingTeam(team1ID)
	if err != nil {
		t.Fatalf("expected team1 to find a match, got err: %v", err)
	}
	if matched.ID != team2ID {
		t.Errorf("expected matched team ID %s, got %s", team2ID.Hex(), matched.ID.Hex())
	}

	// Remove team2 from matchmaking (e.g., LeaveTeam or UpdateTeamSize called)
	RemoveFromMatchmaking(team2ID)

	// Now team1 should find no match
	_, err = FindMatchingTeam(team1ID)
	if err != mongo.ErrNoDocuments {
		t.Errorf("expected mongo.ErrNoDocuments after team2 was removed, got %v", err)
	}

	// Cleanup
	RemoveFromMatchmaking(team1ID)
}

func TestRemoveFromMatchmaking_NonExistentTeam(t *testing.T) {
	nonExistentID := primitive.NewObjectID()
	// Should not panic or error
	RemoveFromMatchmaking(nonExistentID)
}
