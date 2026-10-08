package rating

import (
	"math"
	"testing"
	"time"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.InitialRating != 1500.0 {
		t.Errorf("Expected InitialRating 1500.0, got %f", cfg.InitialRating)
	}
	if cfg.InitialRD != 350.0 {
		t.Errorf("Expected InitialRD 350.0, got %f", cfg.InitialRD)
	}
	if cfg.InitialVol != 0.06 {
		t.Errorf("Expected InitialVol 0.06, got %f", cfg.InitialVol)
	}
	if cfg.Tau != 0.5 {
		t.Errorf("Expected Tau 0.5, got %f", cfg.Tau)
	}
	if cfg.RatingPeriodSec != 86400 {
		t.Errorf("Expected RatingPeriodSec 86400, got %f", cfg.RatingPeriodSec)
	}
	if cfg.MaxRD != 350.0 {
		t.Errorf("Expected MaxRD 350.0, got %f", cfg.MaxRD)
	}
}

func TestNew(t *testing.T) {
	// Nil config should fall back to DefaultConfig
	g := New(nil)
	if g == nil || g.Config == nil {
		t.Fatal("Expected non-nil Glicko2 with default config")
	}
	if g.Config.InitialRating != defaultInitialRating {
		t.Errorf("Expected initial rating %f, got %f", defaultInitialRating, g.Config.InitialRating)
	}

	// Custom config
	customCfg := &Config{
		InitialRating:   1200.0,
		InitialRD:       200.0,
		InitialVol:      0.05,
		Tau:             0.6,
		RatingPeriodSec: 3600,
		MaxRD:           300.0,
	}
	gCustom := New(customCfg)
	if gCustom.Config.InitialRating != 1200.0 {
		t.Errorf("Expected custom initial rating 1200.0, got %f", gCustom.Config.InitialRating)
	}
}

func TestNewPlayer(t *testing.T) {
	g := New(nil)
	player := g.NewPlayer()

	if player.Rating != 1500.0 {
		t.Errorf("Expected player rating 1500.0, got %f", player.Rating)
	}
	if player.RD != 350.0 {
		t.Errorf("Expected player RD 350.0, got %f", player.RD)
	}
	if player.Volatility != 0.06 {
		t.Errorf("Expected player Volatility 0.06, got %f", player.Volatility)
	}
	if player.LastUpdate.IsZero() {
		t.Error("Expected player LastUpdate to be non-zero")
	}
}

func TestUpdateMatch_P1Wins(t *testing.T) {
	g := New(nil)
	now := time.Now()
	p1 := &Player{Rating: 1500, RD: 200, Volatility: 0.06, LastUpdate: now}
	p2 := &Player{Rating: 1500, RD: 200, Volatility: 0.06, LastUpdate: now}

	matchTime := now.Add(1 * time.Hour)
	g.UpdateMatch(p1, p2, 1.0, matchTime)

	if p1.Rating <= 1500 {
		t.Errorf("Expected winner p1 rating to increase above 1500, got %f", p1.Rating)
	}
	if p2.Rating >= 1500 {
		t.Errorf("Expected loser p2 rating to decrease below 1500, got %f", p2.Rating)
	}
	if p1.RD >= 200 {
		t.Errorf("Expected p1 RD to decrease after match, got %f", p1.RD)
	}
	if !p1.LastUpdate.Equal(matchTime) {
		t.Errorf("Expected p1 LastUpdate to match matchTime, got %v", p1.LastUpdate)
	}
}

func TestUpdateMatch_P2Wins(t *testing.T) {
	g := New(nil)
	now := time.Now()
	p1 := &Player{Rating: 1500, RD: 200, Volatility: 0.06, LastUpdate: now}
	p2 := &Player{Rating: 1500, RD: 200, Volatility: 0.06, LastUpdate: now}

	matchTime := now.Add(1 * time.Hour)
	g.UpdateMatch(p1, p2, 0.0, matchTime)

	if p1.Rating >= 1500 {
		t.Errorf("Expected loser p1 rating to decrease below 1500, got %f", p1.Rating)
	}
	if p2.Rating <= 1500 {
		t.Errorf("Expected winner p2 rating to increase above 1500, got %f", p2.Rating)
	}
}

func TestUpdateMatch_Draw(t *testing.T) {
	g := New(nil)
	now := time.Now()
	// Stronger player vs weaker player drawing
	p1 := &Player{Rating: 1700, RD: 100, Volatility: 0.06, LastUpdate: now}
	p2 := &Player{Rating: 1300, RD: 100, Volatility: 0.06, LastUpdate: now}

	matchTime := now.Add(1 * time.Hour)
	g.UpdateMatch(p1, p2, 0.5, matchTime)

	// In a draw against a weaker player, higher-rated player should lose points
	if p1.Rating >= 1700 {
		t.Errorf("Expected higher-rated p1 rating to drop on draw with weaker player, got %f", p1.Rating)
	}
	if p2.Rating <= 1300 {
		t.Errorf("Expected lower-rated p2 rating to gain on draw with stronger player, got %f", p2.Rating)
	}
}

func TestUpdateMatch_ClampedOutcome(t *testing.T) {
	g := New(nil)
	now := time.Now()
	p1 := &Player{Rating: 1500, RD: 200, Volatility: 0.06, LastUpdate: now}
	p2 := &Player{Rating: 1500, RD: 200, Volatility: 0.06, LastUpdate: now}

	// Outcome > 1 should be clamped to 1
	g.UpdateMatch(p1, p2, 10.0, now.Add(1*time.Hour))
	if p1.Rating <= 1500 {
		t.Errorf("Expected p1 rating to increase, got %f", p1.Rating)
	}

	// Outcome < 0 should be clamped to 0
	p3 := &Player{Rating: 1500, RD: 200, Volatility: 0.06, LastUpdate: now}
	p4 := &Player{Rating: 1500, RD: 200, Volatility: 0.06, LastUpdate: now}
	g.UpdateMatch(p3, p4, -5.0, now.Add(1*time.Hour))
	if p3.Rating >= 1500 {
		t.Errorf("Expected p3 rating to decrease, got %f", p3.Rating)
	}
}

func TestUpdateTimeRD_Inactivity(t *testing.T) {
	g := New(nil)
	lastTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	player := &Player{
		Rating:     1500,
		RD:         100,
		Volatility: 0.06,
		LastUpdate: lastTime,
	}

	// 30 days later
	currentTime := lastTime.Add(30 * 24 * time.Hour)
	g.updateTimeRD(player, currentTime)

	if player.RD <= 100 {
		t.Errorf("Expected RD to increase due to inactivity decay, got %f", player.RD)
	}
	if player.RD > g.Config.MaxRD {
		t.Errorf("Expected RD to be capped at MaxRD %f, got %f", g.Config.MaxRD, player.RD)
	}

	// Zero timestamp test
	zeroPlayer := &Player{Rating: 1500, RD: 100, Volatility: 0.06}
	g.updateTimeRD(zeroPlayer, currentTime)
	if zeroPlayer.RD != 100 {
		t.Errorf("Expected zero LastUpdate player RD to remain unchanged, got %f", zeroPlayer.RD)
	}
}

func TestScaleConversions(t *testing.T) {
	g := New(nil)
	origRating := 1600.0
	origRD := 150.0

	mu, phi := g.scaleToGlicko2(origRating, origRD)
	backRating, backRD := g.scaleFromGlicko2(mu, phi)

	if math.Abs(origRating-backRating) > 1e-6 {
		t.Errorf("Rating scale conversion mismatch: expected %f, got %f", origRating, backRating)
	}
	if math.Abs(origRD-backRD) > 1e-6 {
		t.Errorf("RD scale conversion mismatch: expected %f, got %f", origRD, backRD)
	}
}
