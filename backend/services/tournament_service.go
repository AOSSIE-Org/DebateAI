package services

import (
	"errors"
	"fmt"
	"math/bits"
	"strings"

	"arguehub/models"
)

const (
	MinParticipants = 2
	MaxParticipants = 64
)

// IsPowerOfTwo checks if an integer is a positive power of two
func IsPowerOfTwo(n int) bool {
	return n > 0 && (n&(n-1)) == 0
}

// CalculateTotalRounds calculates the number of rounds in a single-elimination tournament
// where n is a power of two (e.g. 2 -> 1, 4 -> 2, 8 -> 3, 16 -> 4, etc.)
func CalculateTotalRounds(n int) int {
	if n < 2 || !IsPowerOfTwo(n) {
		return 0
	}
	return bits.TrailingZeros(uint(n))
}

// GetRoundName returns the descriptive display name for a round based on remaining matches
func GetRoundName(roundIndex int, totalRounds int) string {
	roundsFromFinal := totalRounds - 1 - roundIndex
	switch roundsFromFinal {
	case 0:
		return "Final"
	case 1:
		return "Semifinals"
	case 2:
		return "Quarterfinals"
	case 3:
		return "Round of 16"
	case 4:
		return "Round of 32"
	case 5:
		return "Round of 64"
	default:
		return fmt.Sprintf("Round %d", roundIndex+1)
	}
}

// ValidateParticipants validates the participant list for single-elimination tournament generation
func ValidateParticipants(participants []models.TournamentParticipant) error {
	count := len(participants)
	if count < MinParticipants {
		return fmt.Errorf("participant count %d is below minimum required of %d", count, MinParticipants)
	}
	if count > MaxParticipants {
		return fmt.Errorf("participant count %d exceeds maximum allowed of %d", count, MaxParticipants)
	}
	if !IsPowerOfTwo(count) {
		return fmt.Errorf("participant count %d must be a power of 2 (e.g. 2, 4, 8, 16, 32, 64)", count)
	}

	seenIDs := make(map[string]bool, count)
	for i, p := range participants {
		trimmedID := strings.TrimSpace(p.ID)
		if trimmedID == "" {
			return fmt.Errorf("participant at index %d has an empty ID", i)
		}
		trimmedName := strings.TrimSpace(p.Name)
		if trimmedName == "" {
			return fmt.Errorf("participant %s has an empty name", p.ID)
		}
		if seenIDs[trimmedID] {
			return fmt.Errorf("duplicate participant ID detected: %s", trimmedID)
		}
		seenIDs[trimmedID] = true
	}

	return nil
}

// GenerateBracket constructs a complete, empty-ready single elimination tournament bracket
// for any valid power of 2 participant count between 2 and 64.
func GenerateBracket(participants []models.TournamentParticipant) (*models.TournamentBracket, error) {
	if err := ValidateParticipants(participants); err != nil {
		return nil, err
	}

	totalParticipants := len(participants)
	totalRounds := CalculateTotalRounds(totalParticipants)
	rounds := make([]models.TournamentRound, totalRounds)

	for r := 0; r < totalRounds; r++ {
		matchesInRound := totalParticipants >> (r + 1)
		roundMatches := make([]models.TournamentMatch, matchesInRound)

		for m := 0; m < matchesInRound; m++ {
			matchID := fmt.Sprintf("R%d-M%d", r+1, m+1)
			match := models.TournamentMatch{
				ID:         matchID,
				RoundIndex: r,
				MatchIndex: m,
				Scores:     make(map[string]string),
			}

			// Determine linkage to subsequent round match
			if r < totalRounds-1 {
				match.NextMatchID = fmt.Sprintf("R%d-M%d", r+2, (m/2)+1)
				match.NextMatchSlot = (m % 2) + 1
			}

			if r == 0 {
				// Round 1: seeded directly from participants list
				p1 := participants[2*m]
				p2 := participants[2*m+1]
				match.Participant1 = &p1
				match.Participant2 = &p2
				match.Status = models.MatchStatusReady
			} else {
				// Subsequent rounds: awaiting winners from previous round
				match.Status = models.MatchStatusPending
			}

			roundMatches[m] = match
		}

		rounds[r] = models.TournamentRound{
			RoundIndex: r,
			Name:       GetRoundName(r, totalRounds),
			Matches:    roundMatches,
		}
	}

	return &models.TournamentBracket{
		TotalParticipants: totalParticipants,
		TotalRounds:       totalRounds,
		Rounds:            rounds,
		Status:            models.TournamentStatusUpcoming,
	}, nil
}

// AdvanceWinner records the winner of a match and advances them to the appropriate slot
// in the subsequent round of the tournament bracket. If the final match is completed,
// it declares the champion and completes the tournament.
func AdvanceWinner(bracket *models.TournamentBracket, matchID string, winnerID string, scores map[string]string) error {
	if bracket == nil {
		return errors.New("bracket cannot be nil")
	}
	if len(bracket.Rounds) == 0 {
		return errors.New("bracket has no rounds")
	}

	trimmedWinnerID := strings.TrimSpace(winnerID)
	if trimmedWinnerID == "" {
		return errors.New("winnerID cannot be empty")
	}

	// Locate the target match
	var targetMatch *models.TournamentMatch
	var targetRoundIdx int
	found := false

	for rIdx := range bracket.Rounds {
		for mIdx := range bracket.Rounds[rIdx].Matches {
			if bracket.Rounds[rIdx].Matches[mIdx].ID == matchID {
				targetMatch = &bracket.Rounds[rIdx].Matches[mIdx]
				targetRoundIdx = rIdx
				found = true
				break
			}
		}
		if found {
			break
		}
	}

	if !found {
		return fmt.Errorf("match %s not found in bracket", matchID)
	}

	if targetMatch.Status == models.MatchStatusCompleted {
		return fmt.Errorf("match %s is already completed", matchID)
	}

	if targetMatch.Participant1 == nil || targetMatch.Participant2 == nil {
		return fmt.Errorf("match %s cannot be completed: both participants must be present", matchID)
	}

	// Validate winner is one of the match participants
	var winnerParticipant *models.TournamentParticipant
	if targetMatch.Participant1.ID == trimmedWinnerID {
		winnerParticipant = targetMatch.Participant1
	} else if targetMatch.Participant2.ID == trimmedWinnerID {
		winnerParticipant = targetMatch.Participant2
	} else {
		return fmt.Errorf("participant %s is not part of match %s", trimmedWinnerID, matchID)
	}

	// Complete the match
	targetMatch.Winner = winnerParticipant
	targetMatch.WinnerID = trimmedWinnerID
	targetMatch.Status = models.MatchStatusCompleted
	if scores != nil {
		targetMatch.Scores = scores
	}

	// If this is the Final match, designate the champion and mark tournament completed
	if targetRoundIdx == bracket.TotalRounds-1 {
		bracket.Champion = winnerParticipant
		bracket.Status = models.TournamentStatusCompleted
		return nil
	}

	// Otherwise, advance winner into the next round's match
	nextRoundIdx := targetRoundIdx + 1
	var nextMatch *models.TournamentMatch
	for mIdx := range bracket.Rounds[nextRoundIdx].Matches {
		if bracket.Rounds[nextRoundIdx].Matches[mIdx].ID == targetMatch.NextMatchID {
			nextMatch = &bracket.Rounds[nextRoundIdx].Matches[mIdx]
			break
		}
	}

	if nextMatch == nil {
		return fmt.Errorf("next match %s not found in round %d", targetMatch.NextMatchID, nextRoundIdx+1)
	}

	if targetMatch.NextMatchSlot == 1 {
		nextMatch.Participant1 = winnerParticipant
	} else if targetMatch.NextMatchSlot == 2 {
		nextMatch.Participant2 = winnerParticipant
	} else {
		return fmt.Errorf("invalid next match slot %d for match %s", targetMatch.NextMatchSlot, matchID)
	}

	// If both participants in the next match are now present, mark it ready
	if nextMatch.Participant1 != nil && nextMatch.Participant2 != nil {
		nextMatch.Status = models.MatchStatusReady
	}

	// Update overall bracket status to live if it was upcoming
	if bracket.Status == models.TournamentStatusUpcoming {
		bracket.Status = models.TournamentStatusLive
	}

	return nil
}

// GetMatch searches the bracket for a match by its unique identifier
func GetMatch(bracket *models.TournamentBracket, matchID string) (*models.TournamentMatch, error) {
	if bracket == nil {
		return nil, errors.New("bracket cannot be nil")
	}
	for rIdx := range bracket.Rounds {
		for mIdx := range bracket.Rounds[rIdx].Matches {
			if bracket.Rounds[rIdx].Matches[mIdx].ID == matchID {
				return &bracket.Rounds[rIdx].Matches[mIdx], nil
			}
		}
	}
	return nil, fmt.Errorf("match %s not found in bracket", matchID)
}

// IsRoundCompleted returns true if every match in the specified round is completed
func IsRoundCompleted(bracket *models.TournamentBracket, roundIndex int) (bool, error) {
	if bracket == nil {
		return false, errors.New("bracket cannot be nil")
	}
	if roundIndex < 0 || roundIndex >= len(bracket.Rounds) {
		return false, fmt.Errorf("invalid round index %d (bracket has %d rounds)", roundIndex, len(bracket.Rounds))
	}
	for _, m := range bracket.Rounds[roundIndex].Matches {
		if m.Status != models.MatchStatusCompleted {
			return false, nil
		}
	}
	return true, nil
}

// GetBracketWinner returns the champion of the tournament if concluded, or nil
func GetBracketWinner(bracket *models.TournamentBracket) *models.TournamentParticipant {
	if bracket == nil {
		return nil
	}
	return bracket.Champion
}
