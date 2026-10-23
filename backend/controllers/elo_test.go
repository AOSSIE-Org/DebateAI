package controllers

import (
	"math"
	"testing"
)

func TestCalculateEloRating(t *testing.T) {
	winner, loser := calculateEloRating(1500, 1500, 1)
	if math.Abs(winner-1516) > 1e-9 || math.Abs(loser-1484) > 1e-9 {
		t.Fatalf("even win = %v, %v; want 1516, 1484", winner, loser)
	}

	left, right := calculateEloRating(1500, 1500, 0.5)
	if left != 1500 || right != 1500 {
		t.Fatalf("even draw = %v, %v", left, right)
	}

	underdog, favorite := calculateEloRating(1200, 1800, 1)
	gain := underdog - 1200
	loss := 1800 - favorite
	if math.Abs(gain-loss) > 1e-9 {
		t.Fatalf("elo exchange is not zero-sum: gain %v loss %v", gain, loss)
	}
	if gain <= 16 {
		t.Fatalf("upset gain = %v, want more than the 16 point even-match gain", gain)
	}
}
