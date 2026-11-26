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
