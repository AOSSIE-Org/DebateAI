package services

import (
	"errors"
	"testing"
	"time"

	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// resetTeamPool replaces the package-level pool with exactly the given entries,
// so each test starts from a known state.
func resetTeamPool(entries ...*TeamMatchmakingEntry) {
	teamMatchmakingMutex.Lock()
	defer teamMatchmakingMutex.Unlock()
	teamMatchmakingPool = make(map[string]*TeamMatchmakingEntry)
	for _, e := range entries {
		teamMatchmakingPool[e.TeamID.Hex()] = e
	}
}

// newPoolEntry builds a pool entry with a fresh team ID.
func newPoolEntry(maxSize int, elo float64) *TeamMatchmakingEntry {
	id := primitive.NewObjectID()
	return &TeamMatchmakingEntry{
		TeamID:     id,
		Team:       models.Team{ID: id},
		MaxSize:    maxSize,
		AverageElo: elo,
		Timestamp:  time.Now(),
	}
}

func TestClaimMatchedTeamsRejectsTeamsNotInPool(t *testing.T) {
	a, b := newPoolEntry(2, 1200), newPoolEntry(2, 1200)

	// Empty pool: neither team is matchmaking (this is the bug from #638).
	resetTeamPool()
	if _, err := ClaimMatchedTeams(a.TeamID, b.TeamID); !errors.Is(err, ErrTeamsNotMatched) {
		t.Fatalf("expected ErrTeamsNotMatched for empty pool, got %v", err)
	}

	// Only one of the two is in the pool.
	resetTeamPool(a)
	if _, err := ClaimMatchedTeams(a.TeamID, b.TeamID); !errors.Is(err, ErrTeamsNotMatched) {
		t.Fatalf("expected ErrTeamsNotMatched when one team missing, got %v", err)
	}
	// A failed claim must not have removed the team that WAS in the pool.
	if _, ok := GetMatchmakingPool()[a.TeamID.Hex()]; !ok {
		t.Fatal("failed claim must not remove the team that was in the pool")
	}
}

func TestClaimMatchedTeamsRejectsIncompatibleTeams(t *testing.T) {
	// Different team sizes.
	a, b := newPoolEntry(2, 1200), newPoolEntry(3, 1200)
	resetTeamPool(a, b)
	if _, err := ClaimMatchedTeams(a.TeamID, b.TeamID); !errors.Is(err, ErrTeamsNotMatched) {
		t.Fatalf("expected rejection for mismatched sizes, got %v", err)
	}

	// Elo gap of 300 is over the 200 limit.
	c, d := newPoolEntry(2, 1000), newPoolEntry(2, 1300)
	resetTeamPool(c, d)
	if _, err := ClaimMatchedTeams(c.TeamID, d.TeamID); !errors.Is(err, ErrTeamsNotMatched) {
		t.Fatalf("expected rejection for Elo gap > 200, got %v", err)
	}

	// Same team on both sides.
	resetTeamPool(c)
	if _, err := ClaimMatchedTeams(c.TeamID, c.TeamID); !errors.Is(err, ErrTeamsNotMatched) {
		t.Fatalf("expected rejection for same team on both sides, got %v", err)
	}
}

func TestClaimMatchedTeamsClaimsOnceAndRestores(t *testing.T) {
	a, b := newPoolEntry(2, 1200), newPoolEntry(2, 1350)
	resetTeamPool(a, b)

	claimed, err := ClaimMatchedTeams(a.TeamID, b.TeamID)
	if err != nil || len(claimed) != 2 {
		t.Fatalf("expected successful claim of 2 teams, got %v, %v", claimed, err)
	}
	if n := len(GetMatchmakingPool()); n != 0 {
		t.Fatalf("claimed teams must leave the pool, pool size = %d", n)
	}

	// A second claim of the same pair must fail (no duplicate debates).
	if _, err := ClaimMatchedTeams(a.TeamID, b.TeamID); !errors.Is(err, ErrTeamsNotMatched) {
		t.Fatalf("second claim must fail, got %v", err)
	}

	// Restore puts both teams back, so a failed debate creation isn't fatal.
	RestoreToMatchmaking(claimed)
	if n := len(GetMatchmakingPool()); n != 2 {
		t.Fatalf("restore must put both teams back, pool size = %d", n)
	}
}
