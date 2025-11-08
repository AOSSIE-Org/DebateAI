package rating

import (
	"math"
	"time"
)

const (
	scale                  = 173.7178
	defaultInitialRating   = 1500.0
	defaultInitialRD       = 350.0
	defaultInitialVol      = 0.06
	defaultTau             = 0.5
	defaultRatingPeriodSec = 86400 // 1 day
	defaultMaxRD           = 350.0
	convergenceTolerance   = 0.000001
	maxIterations          = 100
)

// Player represents a user with a Glicko-2 rating
type Player struct {
	Rating     float64   `bson:"rating" json:"rating"`
	RD         float64   `bson:"rd" json:"rd"`
	Volatility float64   `bson:"volatility" json:"volatility"`
	LastUpdate time.Time `bson:"lastRatingUpdate" json:"lastRatingUpdate"`
}

// Config holds system parameters
type Config struct {
	InitialRating   float64 `json:"initial_rating"`
	InitialRD       float64 `json:"initial_rd"`
	InitialVol      float64 `json:"initial_vol"`
	Tau             float64 `json:"tau"`
	RatingPeriodSec float64 `json:"rating_period_sec"`
	MaxRD           float64 `json:"max_rd"`
}

// DefaultConfig returns recommended default parameters
func DefaultConfig() *Config {
	return &Config{
		InitialRating:   defaultInitialRating,
		InitialRD:       defaultInitialRD,
		InitialVol:      defaultInitialVol,
		Tau:             defaultTau,
		RatingPeriodSec: defaultRatingPeriodSec,
		MaxRD:           defaultMaxRD,
	}
}

// Glicko2 implements the rating system
type Glicko2 struct {
	Config *Config
}

// New creates a Glicko-2 rating system with configuration
func New(config *Config) *Glicko2 {
	if config == nil {
		config = DefaultConfig()
	}
	return &Glicko2{Config: config}
}

// NewPlayer creates a new player with initial ratings
func (g *Glicko2) NewPlayer() *Player {
	return &Player{
		Rating:     g.Config.InitialRating,
		RD:         g.Config.InitialRD,
		Volatility: g.Config.InitialVol,
		LastUpdate: time.Now(),
	}
}

// UpdateMatch updates ratings after a match between two players
// outcome: 1 = p1 wins, 0 = p2 wins, 0.5 = draw
func (g *Glicko2) UpdateMatch(p1, p2 *Player, outcome float64, matchTime time.Time) {
	// Ensure valid outcome
	outcome = math.Max(0, math.Min(1, outcome))

	// Update RDs for time decay
	g.updateTimeRD(p1, matchTime)
	g.updateTimeRD(p2, matchTime)

	// Convert to Glicko-2 scale
	mu1, phi1 := g.scaleToGlicko2(p1.Rating, p1.RD)
	mu2, phi2 := g.scaleToGlicko2(p2.Rating, p2.RD)

	// Update both players
	newMu1, newPhi1, newSigma1 := g.calculateUpdate(mu1, phi1, p1.Volatility, mu2, phi2, outcome)
	newMu2, newPhi2, newSigma2 := g.calculateUpdate(mu2, phi2, p2.Volatility, mu1, phi1, 1-outcome)

	// Convert back to original scale
	p1.Rating, p1.RD = g.scaleFromGlicko2(newMu1, newPhi1)
	p2.Rating, p2.RD = g.scaleFromGlicko2(newMu2, newPhi2)

	// Update volatility and timestamp
	p1.Volatility = newSigma1
	p2.Volatility = newSigma2
	p1.LastUpdate = matchTime
	p2.LastUpdate = matchTime
}

// updateTimeRD adjusts RD for time passed since last match
func (g *Glicko2) updateTimeRD(p *Player, currentTime time.Time) {
	if p.LastUpdate.IsZero() {
		return
	}

	secPassed := currentTime.Sub(p.LastUpdate).Seconds()
	periods := secPassed / g.Config.RatingPeriodSec

	if periods > 0 {
		rdSq := p.RD * p.RD
		volSq := p.Volatility * p.Volatility
		newRD := math.Sqrt(rdSq + volSq*periods)
		p.RD = math.Min(newRD, g.Config.MaxRD)
	}
}

// scaleToGlicko2 converts to internal Glicko-2 scale
func (g *Glicko2) scaleToGlicko2(rating, rd float64) (float64, float64) {
	return (rating - g.Config.InitialRating) / scale, rd / scale
}

// scaleFromGlicko2 converts from internal scale to original
func (g *Glicko2) scaleFromGlicko2(mu, phi float64) (float64, float64) {
	return mu*scale + g.Config.InitialRating, phi * scale
}

// calculateUpdate performs core rating calculations
func (g *Glicko2) calculateUpdate(
	mu, phi, sigma float64,
	oppMu, oppPhi float64,
	outcome float64,
) (newMu, newPhi, newSigma float64) {

	// Step 1: Calculate variance and delta
	gVal := gFunc(oppPhi)
	e := eFunc(mu, oppMu, oppPhi)

	v := 1.0 / (gVal * gVal * e * (1 - e))
	delta := v * gVal * (outcome - e)

	// Step 2: Update volatility
	newSigma = g.updateVolatility(sigma, phi, v, delta)

	// Step 3: Update RD and rating
	phiStar := math.Sqrt(phi*phi + newSigma*newSigma)
	newPhi = 1.0 / math.Sqrt(1.0/(phiStar*phiStar)+1.0/v)
	newMu = mu + newPhi*newPhi*gVal*(outcome-e)

	return newMu, newPhi, newSigma
}

// updateVolatility calculates new volatility using iterative algorithm
func (g *Glicko2) updateVolatility(sigma, phi, v, delta float64) float64 {
	a := math.Log(sigma * sigma)
	deltaSq := delta * delta
	phiSq := phi * phi

	// Initialize variables
	x := a
	if deltaSq > phiSq+v {
		x = math.Log(deltaSq - phiSq - v)
	}

	// Define function f(x) to solve
	f := func(x float64) float64 {
		ex := math.Exp(x)
		num := ex * (deltaSq - phiSq - v - ex)
		denom := 2 * math.Pow(phiSq+v+ex, 2)
		return num/denom - (x-a)/(g.Config.Tau*g.Config.Tau)
	}

	// Newton-Raphson iteration
	for i := 0; i < maxIterations; i++ {
		fx := f(x)
		if math.Abs(fx) < convergenceTolerance {
			break
		}

		// Numerical derivative
		h := 0.001
		fxph := f(x + h)
		df := (fxph - fx) / h

		if math.Abs(df) < convergenceTolerance {
			break
		}

		x = x - fx/df
	}

	return math.Exp(x / 2)
}

// gFunc calculates Glicko-2 g(φ) function
func gFunc(phi float64) float64 {
	return 1.0 / math.Sqrt(1.0+3.0*phi*phi/(math.Pi*math.Pi))
}

// eFunc calculates expected outcome
func eFunc(mu, oppMu, oppPhi float64) float64 {
	return 1.0 / (1.0 + math.Exp(-gFunc(oppPhi)*(mu-oppMu)))
}
