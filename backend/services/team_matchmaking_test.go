package services

import (
	"testing"
	"time"

	"arguehub/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestValidateTeamsMatch(t *testing.T) {
	ClearMatchmakingPool()
	defer ClearMatchmakingPool()

	team1ID := primitive.NewObjectID()
	team2ID := primitive.NewObjectID()
	captain1ID := primitive.NewObjectID()
	captain2ID := primitive.NewObjectID()

	// Case 1: Empty pool - neither team is in matchmaking
	err := ValidateTeamsMatch(team1ID, team2ID)
	if err == nil {
		t.Fatal("Expected error when neither team is in matchmaking pool, got nil")
	}

	team1 := models.Team{
		ID:         team1ID,
		Name:       "Alpha",
		CaptainID:  captain1ID,
		MaxSize:    2,
		AverageElo: 1200,
		CreatedAt:  time.Now(),
	}

	team2 := models.Team{
		ID:         team2ID,
		Name:       "Beta",
		CaptainID:  captain2ID,
		MaxSize:    2,
		AverageElo: 1250,
		CreatedAt:  time.Now(),
	}

	// Case 2: Only Team 1 in pool
	AddTeamToMatchmakingPoolDirect(team1)
	err = ValidateTeamsMatch(team1ID, team2ID)
	if err == nil {
		t.Fatal("Expected error when only team 1 is in matchmaking pool, got nil")
	}
	if err.Error() != "team 2 is not in the matchmaking pool" {
		t.Errorf("Unexpected error message: %v", err)
	}

	// Case 3: Only Team 2 in pool
	ClearMatchmakingPool()
	AddTeamToMatchmakingPoolDirect(team2)
	err = ValidateTeamsMatch(team1ID, team2ID)
	if err == nil {
		t.Fatal("Expected error when only team 2 is in matchmaking pool, got nil")
	}
	if err.Error() != "team 1 is not in the matchmaking pool" {
		t.Errorf("Unexpected error message: %v", err)
	}

	// Case 4: Both in pool with mismatched team sizes
	ClearMatchmakingPool()
	team1MismatchedSize := team1
	team1MismatchedSize.MaxSize = 3
	AddTeamToMatchmakingPoolDirect(team1MismatchedSize)
	AddTeamToMatchmakingPoolDirect(team2)
	err = ValidateTeamsMatch(team1ID, team2ID)
	if err == nil {
		t.Fatal("Expected error when team sizes do not match, got nil")
	}
	if err.Error() != "teams do not have matching team sizes" {
		t.Errorf("Unexpected error message: %v", err)
	}

	// Case 5: Both in pool with Elo difference > 200
	ClearMatchmakingPool()
	team2HighElo := team2
	team2HighElo.AverageElo = 1500 // diff is 300 (> 200)
	AddTeamToMatchmakingPoolDirect(team1)
	AddTeamToMatchmakingPoolDirect(team2HighElo)
	err = ValidateTeamsMatch(team1ID, team2ID)
	if err == nil {
		t.Fatal("Expected error when Elo diff > 200, got nil")
	}
	if err.Error() != "team Elo difference exceeds acceptable matchmaking range" {
		t.Errorf("Unexpected error message: %v", err)
	}

	// Case 6: Valid match (both in pool, same size, Elo diff <= 200)
	ClearMatchmakingPool()
	AddTeamToMatchmakingPoolDirect(team1)
	AddTeamToMatchmakingPoolDirect(team2)
	err = ValidateTeamsMatch(team1ID, team2ID)
	if err != nil {
		t.Fatalf("Expected valid match with nil error, got: %v", err)
	}

	// Case 7: Removal from pool
	RemoveFromMatchmaking(team1ID)
	if IsTeamInMatchmaking(team1ID) {
		t.Errorf("Expected team1 to be removed from matchmaking pool")
	}
	if !IsTeamInMatchmaking(team2ID) {
		t.Errorf("Expected team2 to remain in matchmaking pool")
	}

	err = ValidateTeamsMatch(team1ID, team2ID)
	if err == nil {
		t.Fatal("Expected error after team1 was removed, got nil")
	}
}
