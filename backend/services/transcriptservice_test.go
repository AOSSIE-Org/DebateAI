package services

import (
	"encoding/json"
	"strings"
	"testing"

	"arguehub/models"
)

const validJudgeResult = `{
  "opening_statement": {
    "for": {"score": 8, "reason": "Clear claim with relevant reasoning."},
    "against": {"score": 7, "reason": "Relevant position with limited support."}
  },
  "cross_examination_questions": {
    "for": {"score": 6, "reason": "The question tests an important assumption."},
    "against": {"score": 5, "reason": "The question is only partly relevant."}
  },
  "cross_examination_answers": {
    "for": {"score": 7, "reason": "The answer addresses the challenge."},
    "against": {"score": 6, "reason": "The answer leaves part of the challenge unresolved."}
  },
  "closing": {
    "for": {"score": 8, "reason": "The closing weighs the central impacts."},
    "against": {"score": 7, "reason": "The closing summarizes the opposition."}
  },
  "total": {"for": 0, "against": 0},
  "verdict": {
    "winner": "for",
    "reason": "The For side better supports and weighs its central claim.",
    "congratulations": "The For side wins.",
    "opponent_analysis": "The Against side should answer the key impact comparison."
  }
}`

func TestNormalizeJudgeResult(t *testing.T) {
	normalized, err := normalizeJudgeResult("```json\n" + validJudgeResult + "\n```")
	if err != nil {
		t.Fatalf("normalizeJudgeResult() error = %v", err)
	}

	var result struct {
		Total struct {
			For     int `json:"for"`
			Against int `json:"against"`
		} `json:"total"`
		Verdict struct {
			Winner string `json:"winner"`
		} `json:"verdict"`
	}
	if err := json.Unmarshal([]byte(normalized), &result); err != nil {
		t.Fatalf("normalized result is not JSON: %v", err)
	}
	if result.Total.For != 29 || result.Total.Against != 25 {
		t.Errorf("normalized totals = (%d, %d), want (29, 25)", result.Total.For, result.Total.Against)
	}
	if result.Verdict.Winner != "For" {
		t.Errorf("normalized winner = %q, want For", result.Verdict.Winner)
	}
}

func TestNormalizeJudgeResultRejectsInvalidJudgments(t *testing.T) {
	tests := []struct {
		name     string
		response string
	}{
		{name: "non-JSON model failure", response: "Unable to judge."},
		{name: "out-of-range score", response: strings.Replace(validJudgeResult, `"score": 8`, `"score": 11`, 1)},
		{name: "missing score explanation", response: strings.Replace(validJudgeResult, `"reason": "Clear claim with relevant reasoning."`, `"reason": ""`, 1)},
		{name: "invalid winner", response: strings.Replace(validJudgeResult, `"winner": "for"`, `"winner": "maybe"`, 1)},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if _, err := normalizeJudgeResult(test.response); err == nil {
				t.Fatal("normalizeJudgeResult() error = nil, want invalid judgment error")
			}
		})
	}
}

func TestMergeTeamTranscriptsCombinesMembersWithoutDuplicateLines(t *testing.T) {
	merged := mergeTeamTranscripts(
		map[string]string{
			"openingFor": "Alex: First argument\nNo response",
			"closingFor": "No response",
		},
		map[string]string{
			"openingFor": "Alex: First argument\nSam: Supporting argument",
			"closingFor": "Sam: Final summary",
		},
	)

	if got, want := merged["openingFor"], "Alex: First argument\nSam: Supporting argument"; got != want {
		t.Errorf("openingFor = %q, want %q", got, want)
	}
	if got, want := merged["closingFor"], "Sam: Final summary"; got != want {
		t.Errorf("closingFor = %q, want %q", got, want)
	}
}

func TestMergeTeamTranscriptsKeepsNoResponseWhenNobodySpoke(t *testing.T) {
	merged := mergeTeamTranscripts(
		map[string]string{"openingFor": "No response"},
		map[string]string{"openingFor": " No response "},
	)
	if got := merged["openingFor"]; got != "No response" {
		t.Errorf("openingFor = %q, want %q", got, "No response")
	}
}

func TestTeamDebateSubmittersUseParticipantsRecordedAtStart(t *testing.T) {
	debate := &models.TeamDebate{
		Team1Stance: "for",
		Team1Members: []models.TeamMember{
			{Email: "new-member@example.com"},
		},
		Participants: []models.TeamDebateParticipant{
			{Email: "participant@example.com", Role: "for"},
			{Email: "opponent@example.com", Role: "against"},
		},
	}

	submitters, err := teamDebateSubmitters(debate, "for")
	if err != nil {
		t.Fatalf("teamDebateSubmitters() error = %v", err)
	}
	if len(submitters) != 1 || submitters[0] != "participant@example.com" {
		t.Fatalf("teamDebateSubmitters() = %v, want [participant@example.com]", submitters)
	}
	if !teamDebateHasSubmitter(debate, "for", "PARTICIPANT@example.com") {
		t.Fatal("teamDebateHasSubmitter() rejected a recorded participant")
	}
	if teamDebateHasSubmitter(debate, "for", "new-member@example.com") {
		t.Fatal("teamDebateHasSubmitter() accepted a member added after the debate started")
	}
}

func TestTeamDebateSubmittersFallBackToRosterForLegacyDebates(t *testing.T) {
	debate := &models.TeamDebate{
		Team1Stance: "for",
		Team1Members: []models.TeamMember{
			{Email: "legacy-member@example.com"},
		},
	}

	submitters, err := teamDebateSubmitters(debate, "for")
	if err != nil {
		t.Fatalf("teamDebateSubmitters() error = %v", err)
	}
	if len(submitters) != 1 || submitters[0] != "legacy-member@example.com" {
		t.Fatalf("teamDebateSubmitters() = %v, want [legacy-member@example.com]", submitters)
	}
}

func TestResolveRoomOpponentUsesOnlyRoomParticipants(t *testing.T) {
	caller := roomParticipant{ID: "user-1", Email: "caller@example.com"}
	opponent := roomParticipant{ID: "user-2", Email: "opponent@example.com"}

	got, err := resolveRoomOpponent([]roomParticipant{caller, opponent}, caller)
	if err != nil {
		t.Fatalf("resolveRoomOpponent() error = %v", err)
	}
	if got.ID != opponent.ID {
		t.Fatalf("resolveRoomOpponent() = %#v, want opponent %#v", got, opponent)
	}
}

func TestResolveRoomOpponentRejectsAmbiguousOrMissingParticipants(t *testing.T) {
	caller := roomParticipant{ID: "user-1", Email: "caller@example.com"}
	opponent := roomParticipant{ID: "user-2", Email: "opponent@example.com"}
	third := roomParticipant{ID: "user-3", Email: "third@example.com"}

	if _, err := resolveRoomOpponent([]roomParticipant{caller}, caller); err == nil {
		t.Fatal("expected an error when the room has no opponent")
	}
	if _, err := resolveRoomOpponent([]roomParticipant{caller, opponent, third}, caller); err == nil {
		t.Fatal("expected an error when the room has more than two participants")
	}
}

func TestSameRoomParticipantMatchesByIDBeforeEmail(t *testing.T) {
	a := roomParticipant{ID: "user-1", Email: "old@example.com"}
	b := roomParticipant{ID: "user-1", Email: "new@example.com"}
	if !sameRoomParticipant(a, b) {
		t.Fatal("same user ID with a changed email should be the same participant")
	}
	c := roomParticipant{ID: "user-2", Email: "new@example.com"}
	if sameRoomParticipant(b, c) {
		t.Fatal("different user IDs should not match even when emails are equal")
	}
}

func TestValidateSubmittedRole(t *testing.T) {
	if err := validateSubmittedRole("for", "for"); err != nil {
		t.Fatalf("matching assigned role rejected: %v", err)
	}
	if err := validateSubmittedRole("against", "for"); err == nil {
		t.Fatal("expected an error when the submitted role differs from the assigned side")
	}
	if err := validateSubmittedRole("", "for"); err != nil {
		t.Fatalf("legacy rooms without a stored role should not be blocked: %v", err)
	}
}

func TestValidateTranscriptPhases(t *testing.T) {
	ownPhases := map[string]string{
		"openingFor":       "opening",
		"crossForQuestion": "question",
		"crossForAnswer":   "answer",
		"closingFor":       "closing",
		"topic":            "metadata",
	}
	if err := validateTranscriptPhases("for", ownPhases); err != nil {
		t.Fatalf("own-side phases rejected: %v", err)
	}

	opponentPhase := map[string]string{"openingAgainst": "forged"}
	if err := validateTranscriptPhases("for", opponentPhase); err == nil {
		t.Fatal("expected opponent-side phases to be rejected")
	}
	if err := validateTranscriptPhases("unknown", ownPhases); err == nil {
		t.Fatal("expected an unknown role to be rejected")
	}
}
