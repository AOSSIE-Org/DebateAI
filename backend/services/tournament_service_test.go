package services

import (
	"encoding/json"
	"fmt"
	"testing"

	"arguehub/models"
)

// helper to generate n mock participants
func makeParticipants(n int) []models.TournamentParticipant {
	participants := make([]models.TournamentParticipant, n)
	for i := 0; i < n; i++ {
		participants[i] = models.TournamentParticipant{
			ID:        fmt.Sprintf("user-%d", i+1),
			Name:      fmt.Sprintf("Player %d", i+1),
			AvatarURL: fmt.Sprintf("https://example.com/avatar/%d.png", i+1),
			Seed:      i + 1,
			Elo:       1200.0 + float64(i*25),
		}
	}
	return participants
}

func TestIsPowerOfTwo(t *testing.T) {
	tests := []struct {
		n    int
		want bool
	}{
		{-4, false},
		{-1, false},
		{0, false},
		{1, true}, // mathematically 2^0 = 1, but for tournaments MinParticipants is 2
		{2, true},
		{3, false},
		{4, true},
		{5, false},
		{6, false},
		{7, false},
		{8, true},
		{15, false},
		{16, true},
		{31, false},
		{32, true},
		{63, false},
		{64, true},
		{65, false},
		{128, true},
	}

	for _, tt := range tests {
		got := IsPowerOfTwo(tt.n)
		if got != tt.want {
			t.Errorf("IsPowerOfTwo(%d) = %v; want %v", tt.n, got, tt.want)
		}
	}
}

func TestCalculateTotalRounds(t *testing.T) {
	tests := []struct {
		n    int
		want int
	}{
		{0, 0},
		{1, 0}, // n < 2 returns 0
		{2, 1},
		{3, 0},
		{4, 2},
		{8, 3},
		{16, 4},
		{32, 5},
		{64, 6},
		{100, 0},
	}

	for _, tt := range tests {
		got := CalculateTotalRounds(tt.n)
		if got != tt.want {
			t.Errorf("CalculateTotalRounds(%d) = %d; want %d", tt.n, got, tt.want)
		}
	}
}

func TestGetRoundName(t *testing.T) {
	// For an 8-player tournament (3 rounds: 0, 1, 2)
	totalRounds := 3
	if got := GetRoundName(0, totalRounds); got != "Quarterfinals" {
		t.Errorf("Round 0 of 3: got %s, want Quarterfinals", got)
	}
	if got := GetRoundName(1, totalRounds); got != "Semifinals" {
		t.Errorf("Round 1 of 3: got %s, want Semifinals", got)
	}
	if got := GetRoundName(2, totalRounds); got != "Final" {
		t.Errorf("Round 2 of 3: got %s, want Final", got)
	}

	// For a 2-player tournament (1 round: 0)
	if got := GetRoundName(0, 1); got != "Final" {
		t.Errorf("Round 0 of 1: got %s, want Final", got)
	}

	// For 16 players (4 rounds)
	if got := GetRoundName(0, 4); got != "Round of 16" {
		t.Errorf("Round 0 of 4: got %s, want Round of 16", got)
	}
}

func TestValidateParticipants_ValidCounts(t *testing.T) {
	validCounts := []int{2, 4, 8, 16, 32, 64}
	for _, count := range validCounts {
		p := makeParticipants(count)
		if err := ValidateParticipants(p); err != nil {
			t.Errorf("ValidateParticipants(%d) returned unexpected error: %v", count, err)
		}
	}
}

func TestValidateParticipants_InvalidCounts(t *testing.T) {
	invalidCounts := []int{0, 1, 3, 5, 6, 7, 9, 10, 12, 15, 17, 33, 63, 65, 128}
	for _, count := range invalidCounts {
		p := makeParticipants(count)
		if err := ValidateParticipants(p); err == nil {
			t.Errorf("ValidateParticipants(%d) expected error, but got nil", count)
		}
	}
}

func TestValidateParticipants_EdgeCases(t *testing.T) {
	// Empty ID
	p := makeParticipants(4)
	p[1].ID = "   "
	if err := ValidateParticipants(p); err == nil {
		t.Error("ValidateParticipants expected error for empty ID, got nil")
	}

	// Empty Name
	p = makeParticipants(4)
	p[2].Name = ""
	if err := ValidateParticipants(p); err == nil {
		t.Error("ValidateParticipants expected error for empty Name, got nil")
	}

	// Duplicate ID
	p = makeParticipants(4)
	p[3].ID = p[0].ID
	if err := ValidateParticipants(p); err == nil {
		t.Error("ValidateParticipants expected error for duplicate ID, got nil")
	}
}

func TestGenerateBracket_Structure(t *testing.T) {
	tests := []struct {
		participants     int
		expectedRounds   int
		expectedMatches  []int // matches per round
		firstRoundStatus models.MatchStatus
	}{
		{2, 1, []int{1}, models.MatchStatusReady},
		{4, 2, []int{2, 1}, models.MatchStatusReady},
		{8, 3, []int{4, 2, 1}, models.MatchStatusReady},
		{16, 4, []int{8, 4, 2, 1}, models.MatchStatusReady},
		{32, 5, []int{16, 8, 4, 2, 1}, models.MatchStatusReady},
		{64, 6, []int{32, 16, 8, 4, 2, 1}, models.MatchStatusReady},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%d_participants", tt.participants), func(t *testing.T) {
			p := makeParticipants(tt.participants)
			bracket, err := GenerateBracket(p)
			if err != nil {
				t.Fatalf("GenerateBracket failed: %v", err)
			}

			if bracket.TotalParticipants != tt.participants {
				t.Errorf("TotalParticipants = %d; want %d", bracket.TotalParticipants, tt.participants)
			}
			if bracket.TotalRounds != tt.expectedRounds {
				t.Errorf("TotalRounds = %d; want %d", bracket.TotalRounds, tt.expectedRounds)
			}
			if len(bracket.Rounds) != tt.expectedRounds {
				t.Fatalf("len(bracket.Rounds) = %d; want %d", len(bracket.Rounds), tt.expectedRounds)
			}

			for rIdx, count := range tt.expectedMatches {
				round := bracket.Rounds[rIdx]
				if len(round.Matches) != count {
					t.Errorf("Round %d matches = %d; want %d", rIdx, len(round.Matches), count)
				}

				for mIdx, match := range round.Matches {
					if rIdx == 0 {
						// Round 1 must have both participants filled and status Ready
						if match.Participant1 == nil || match.Participant2 == nil {
							t.Errorf("Round 0 Match %d has unassigned participant", mIdx)
						}
						if match.Status != models.MatchStatusReady {
							t.Errorf("Round 0 Match %d status = %s; want ready", mIdx, match.Status)
						}
					} else {
						// Subsequent rounds start with nil participants and status Pending
						if match.Participant1 != nil || match.Participant2 != nil {
							t.Errorf("Round %d Match %d should have nil participants initially", rIdx, mIdx)
						}
						if match.Status != models.MatchStatusPending {
							t.Errorf("Round %d Match %d status = %s; want pending", rIdx, mIdx, match.Status)
						}
					}

					// Verify linkage
					if rIdx < tt.expectedRounds-1 {
						expectedNextMatchID := fmt.Sprintf("R%d-M%d", rIdx+2, (mIdx/2)+1)
						expectedNextSlot := (mIdx % 2) + 1
						if match.NextMatchID != expectedNextMatchID {
							t.Errorf("Match %s NextMatchID = %s; want %s", match.ID, match.NextMatchID, expectedNextMatchID)
						}
						if match.NextMatchSlot != expectedNextSlot {
							t.Errorf("Match %s NextMatchSlot = %d; want %d", match.ID, match.NextMatchSlot, expectedNextSlot)
						}
					} else {
						if match.NextMatchID != "" {
							t.Errorf("Final match %s should not have NextMatchID", match.ID)
						}
					}
				}
			}
		})
	}
}

func TestAdvanceWinner_2Participants(t *testing.T) {
	p := makeParticipants(2)
	bracket, err := GenerateBracket(p)
	if err != nil {
		t.Fatalf("GenerateBracket failed: %v", err)
	}

	scores := map[string]string{
		"opening": "9-8",
		"QA":      "8-9",
		"closing": "10-8",
		"total":   "27-25",
	}

	// Winner: Player 1
	err = AdvanceWinner(bracket, "R1-M1", "user-1", scores)
	if err != nil {
		t.Fatalf("AdvanceWinner failed: %v", err)
	}

	match, err := GetMatch(bracket, "R1-M1")
	if err != nil {
		t.Fatalf("GetMatch failed: %v", err)
	}
	if match.Status != models.MatchStatusCompleted {
		t.Errorf("Match status = %s; want completed", match.Status)
	}
	if match.WinnerID != "user-1" {
		t.Errorf("Match WinnerID = %s; want user-1", match.WinnerID)
	}
	if bracket.Champion == nil || bracket.Champion.ID != "user-1" {
		t.Errorf("Champion = %v; want user-1", bracket.Champion)
	}
	if bracket.Status != models.TournamentStatusCompleted {
		t.Errorf("Bracket status = %s; want completed", bracket.Status)
	}
}

func TestAdvanceWinner_4Participants_Progression(t *testing.T) {
	p := makeParticipants(4)
	bracket, err := GenerateBracket(p)
	if err != nil {
		t.Fatalf("GenerateBracket failed: %v", err)
	}

	// Semifinal 1: user-1 vs user-2 -> user-1 wins
	err = AdvanceWinner(bracket, "R1-M1", "user-1", nil)
	if err != nil {
		t.Fatalf("Advancing R1-M1 failed: %v", err)
	}
	if bracket.Status != models.TournamentStatusLive {
		t.Errorf("Bracket status should be live after first match, got %s", bracket.Status)
	}

	finalMatch, _ := GetMatch(bracket, "R2-M1")
	if finalMatch.Participant1 == nil || finalMatch.Participant1.ID != "user-1" {
		t.Errorf("Final Match Participant1 = %v; want user-1", finalMatch.Participant1)
	}
	if finalMatch.Participant2 != nil {
		t.Errorf("Final Match Participant2 should be nil before R1-M2 completes")
	}
	if finalMatch.Status != models.MatchStatusPending {
		t.Errorf("Final Match status should remain pending; got %s", finalMatch.Status)
	}

	// Semifinal 2: user-3 vs user-4 -> user-4 wins
	err = AdvanceWinner(bracket, "R1-M2", "user-4", nil)
	if err != nil {
		t.Fatalf("Advancing R1-M2 failed: %v", err)
	}

	finalMatch, _ = GetMatch(bracket, "R2-M1")
	if finalMatch.Participant2 == nil || finalMatch.Participant2.ID != "user-4" {
		t.Errorf("Final Match Participant2 = %v; want user-4", finalMatch.Participant2)
	}
	if finalMatch.Status != models.MatchStatusReady {
		t.Errorf("Final Match status should be ready now; got %s", finalMatch.Status)
	}

	// Advance Final: user-4 beats user-1
	finalScores := map[string]string{"total": "29-28"}
	err = AdvanceWinner(bracket, "R2-M1", "user-4", finalScores)
	if err != nil {
		t.Fatalf("Advancing Final failed: %v", err)
	}

	if bracket.Status != models.TournamentStatusCompleted {
		t.Errorf("Bracket status = %s; want completed", bracket.Status)
	}
	if bracket.Champion == nil || bracket.Champion.ID != "user-4" {
		t.Errorf("Champion = %v; want user-4", bracket.Champion)
	}
	if GetBracketWinner(bracket) == nil || GetBracketWinner(bracket).ID != "user-4" {
		t.Errorf("GetBracketWinner = %v; want user-4", GetBracketWinner(bracket))
	}
}

func TestAdvanceWinner_8Participants_FullTournament(t *testing.T) {
	p := makeParticipants(8)
	bracket, err := GenerateBracket(p)
	if err != nil {
		t.Fatalf("GenerateBracket failed: %v", err)
	}

	// Round 1 (Quarterfinals):
	// Match 1: user-1 vs user-2 -> user-1 wins
	// Match 2: user-3 vs user-4 -> user-3 wins
	// Match 3: user-5 vs user-6 -> user-6 wins
	// Match 4: user-7 vs user-8 -> user-8 wins
	r1Winners := []string{"user-1", "user-3", "user-6", "user-8"}
	for i := 0; i < 4; i++ {
		matchID := fmt.Sprintf("R1-M%d", i+1)
		if err := AdvanceWinner(bracket, matchID, r1Winners[i], nil); err != nil {
			t.Fatalf("Advance %s failed: %v", matchID, err)
		}
	}

	r1Done, _ := IsRoundCompleted(bracket, 0)
	if !r1Done {
		t.Error("Round 1 should be completed")
	}

	// Verify Round 2 (Semifinals) matchups:
	// Semi 1: user-1 vs user-3
	// Semi 2: user-6 vs user-8
	semi1, _ := GetMatch(bracket, "R2-M1")
	if semi1.Participant1.ID != "user-1" || semi1.Participant2.ID != "user-3" {
		t.Errorf("Semi 1 participants = (%s, %s); want (user-1, user-3)",
			semi1.Participant1.ID, semi1.Participant2.ID)
	}
	if semi1.Status != models.MatchStatusReady {
		t.Errorf("Semi 1 status = %s; want ready", semi1.Status)
	}

	semi2, _ := GetMatch(bracket, "R2-M2")
	if semi2.Participant1.ID != "user-6" || semi2.Participant2.ID != "user-8" {
		t.Errorf("Semi 2 participants = (%s, %s); want (user-6, user-8)",
			semi2.Participant1.ID, semi2.Participant2.ID)
	}
	if semi2.Status != models.MatchStatusReady {
		t.Errorf("Semi 2 status = %s; want ready", semi2.Status)
	}

	// Play Semifinals:
	// user-1 beats user-3
	// user-8 beats user-6
	if err := AdvanceWinner(bracket, "R2-M1", "user-1", nil); err != nil {
		t.Fatalf("Advance R2-M1 failed: %v", err)
	}
	if err := AdvanceWinner(bracket, "R2-M2", "user-8", nil); err != nil {
		t.Fatalf("Advance R2-M2 failed: %v", err)
	}

	r2Done, _ := IsRoundCompleted(bracket, 1)
	if !r2Done {
		t.Error("Round 2 should be completed")
	}

	// Verify Final:
	finalMatch, _ := GetMatch(bracket, "R3-M1")
	if finalMatch.Participant1.ID != "user-1" || finalMatch.Participant2.ID != "user-8" {
		t.Errorf("Final participants = (%s, %s); want (user-1, user-8)",
			finalMatch.Participant1.ID, finalMatch.Participant2.ID)
	}
	if finalMatch.Status != models.MatchStatusReady {
		t.Errorf("Final match status = %s; want ready", finalMatch.Status)
	}

	// Play Final: user-8 wins championship
	if err := AdvanceWinner(bracket, "R3-M1", "user-8", map[string]string{"total": "28-26"}); err != nil {
		t.Fatalf("Advance Final failed: %v", err)
	}

	if bracket.Status != models.TournamentStatusCompleted {
		t.Errorf("Tournament status = %s; want completed", bracket.Status)
	}
	if bracket.Champion == nil || bracket.Champion.ID != "user-8" {
		t.Errorf("Champion = %v; want user-8", bracket.Champion)
	}
}

func TestAdvanceWinner_ErrorHandlingAndEdgeCases(t *testing.T) {
	// Nil bracket
	if err := AdvanceWinner(nil, "R1-M1", "user-1", nil); err == nil {
		t.Error("AdvanceWinner should error on nil bracket")
	}

	p := makeParticipants(4)
	bracket, err := GenerateBracket(p)
	if err != nil {
		t.Fatalf("GenerateBracket failed: %v", err)
	}

	// Empty winnerID
	if err := AdvanceWinner(bracket, "R1-M1", "", nil); err == nil {
		t.Error("AdvanceWinner should error on empty winnerID")
	}

	// Non-existent match ID
	if err := AdvanceWinner(bracket, "R99-M99", "user-1", nil); err == nil {
		t.Error("AdvanceWinner should error on invalid matchID")
	}

	// Winner ID is not in match
	if err := AdvanceWinner(bracket, "R1-M1", "random-spectator", nil); err == nil {
		t.Error("AdvanceWinner should error when winner is not part of match")
	}

	// Cannot advance match before participants are present (Round 2 match is pending)
	if err := AdvanceWinner(bracket, "R2-M1", "user-1", nil); err == nil {
		t.Error("AdvanceWinner should error when match participants are nil")
	}

	// Complete R1-M1 successfully
	if err := AdvanceWinner(bracket, "R1-M1", "user-1", nil); err != nil {
		t.Fatalf("First advance failed: %v", err)
	}

	// Cannot re-advance an already completed match
	if err := AdvanceWinner(bracket, "R1-M1", "user-1", nil); err == nil {
		t.Error("AdvanceWinner should error when match is already completed")
	}
}

func TestIsRoundCompleted_EdgeCases(t *testing.T) {
	if _, err := IsRoundCompleted(nil, 0); err == nil {
		t.Error("IsRoundCompleted should error on nil bracket")
	}

	p := makeParticipants(4)
	bracket, _ := GenerateBracket(p)

	if _, err := IsRoundCompleted(bracket, -1); err == nil {
		t.Error("IsRoundCompleted should error on negative roundIndex")
	}
	if _, err := IsRoundCompleted(bracket, 5); err == nil {
		t.Error("IsRoundCompleted should error on roundIndex >= TotalRounds")
	}

	done, err := IsRoundCompleted(bracket, 0)
	if err != nil || done {
		t.Errorf("IsRoundCompleted round 0 = %v, %v; want false, nil", done, err)
	}
}

func TestGetMatch_EdgeCases(t *testing.T) {
	if _, err := GetMatch(nil, "R1-M1"); err == nil {
		t.Error("GetMatch should error on nil bracket")
	}

	p := makeParticipants(4)
	bracket, _ := GenerateBracket(p)

	if _, err := GetMatch(bracket, "nonexistent"); err == nil {
		t.Error("GetMatch should error when match is not found")
	}

	match, err := GetMatch(bracket, "R1-M1")
	if err != nil || match == nil {
		t.Fatalf("GetMatch R1-M1 failed: %v", err)
	}
	if match.ID != "R1-M1" {
		t.Errorf("Match ID = %s; want R1-M1", match.ID)
	}
}

func TestGetBracketWinner_NilAndInProgress(t *testing.T) {
	if got := GetBracketWinner(nil); got != nil {
		t.Errorf("GetBracketWinner(nil) = %v; want nil", got)
	}

	p := makeParticipants(4)
	bracket, _ := GenerateBracket(p)
	if got := GetBracketWinner(bracket); got != nil {
		t.Errorf("GetBracketWinner before completion = %v; want nil", got)
	}
}

func TestTournament_JSONSerialization(t *testing.T) {
	p := makeParticipants(4)
	bracket, err := GenerateBracket(p)
	if err != nil {
		t.Fatalf("GenerateBracket failed: %v", err)
	}

	tourney := models.Tournament{
		Name:                "Spring Showdown",
		Description:         "Annual debate championship",
		Category:            models.TournamentCategoryVoice,
		Format:              models.TournamentFormatSingleElimination,
		Status:              models.TournamentStatusUpcoming,
		MaxParticipants:     4,
		CurrentParticipants: 4,
		Participants:        p,
		Bracket:             bracket,
	}

	data, err := json.Marshal(tourney)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("json.Unmarshal failed: %v", err)
	}

	if parsed["name"] != "Spring Showdown" {
		t.Errorf("parsed name = %v; want Spring Showdown", parsed["name"])
	}
	if parsed["status"] != "upcoming" {
		t.Errorf("parsed status = %v; want upcoming", parsed["status"])
	}
	if parsed["bracket"] == nil {
		t.Errorf("parsed bracket is nil")
	}
}
