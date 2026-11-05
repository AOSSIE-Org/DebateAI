package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"unicode/utf8"

	"arguehub/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const TournamentRubricVersion = "tournament-v1-35-25-25-15"
const TournamentProviderOutputLimit = 32768

var ErrTournamentEvaluationInput = errors.New("invalid frozen evaluation input")
var ErrTournamentEvaluationOutput = errors.New("invalid evaluation output")

type TournamentJudgeSubmission struct {
	Speaker string `json:"speaker"`
	Content string `json:"content"`
}

type TournamentJudgeContext struct {
	Round     string `json:"round"`
	Speaker   string `json:"speaker"`
	Content   string `json:"content"`
	Truncated bool   `json:"truncated"`
}

// The provider receives pseudonyms, not profile names, IDs, invite codes or receipts.
type TournamentJudgeRequest struct {
	RubricVersion string                      `json:"rubricVersion"`
	Topic         string                      `json:"topic"`
	Round         string                      `json:"round"`
	Submissions   []TournamentJudgeSubmission `json:"submissions"`
	Context       []TournamentJudgeContext    `json:"context"`
	Corrective    bool                        `json:"corrective"`
}

func validateEvaluationInput(t models.Tournament) error {
	e := t.Execution
	if t.Evaluation == nil || !validTournamentExecution(e) || e.State != models.ExecutionFinished || e.PhaseIndex != 7 || e.FinishedAt == nil || e.DeadlineAt != nil || t.Evaluation.ID.IsZero() || t.Evaluation.TournamentID != t.ID || t.Evaluation.RunID != e.RunID || t.Evaluation.InputHash != TournamentInputHash(t) || !utf8.ValidString(t.Topic) || strings.TrimSpace(t.Topic) == "" || utf8.RuneCountInString(t.Topic) > 100 || strings.ContainsRune(t.Topic, 0) {
		return ErrTournamentEvaluationInput
	}
	frozen := t
	frozen.Participants = e.Roster
	frozen.ScheduleAt = nil
	if validateTournamentRoster(frozen, e.StartedAt) != nil {
		return ErrTournamentEvaluationInput
	}
	for index, definition := range TournamentPhaseDefinitions() {
		p := e.Phases[index]
		if p.Round != definition.Round || p.Status != models.PhaseClosed || p.ClosedAt == nil {
			return ErrTournamentEvaluationInput
		}
		expected := map[primitive.ObjectID]bool{}
		for _, member := range e.Roster {
			if member.Stance == definition.Stance {
				expected[member.UserID] = true
			}
		}
		if len(p.Slots) != len(expected) {
			return ErrTournamentEvaluationInput
		}
		for _, slot := range p.Slots {
			if !expected[slot.UserID] {
				return ErrTournamentEvaluationInput
			}
			delete(expected, slot.UserID)
			switch slot.Status {
			case models.SlotSubmitted:
				text, hash, err := CanonicalTournamentTranscript(slot.Content)
				if err != nil || text != slot.Content || hash != slot.ContentHash || slot.SubmittedAt == nil {
					return ErrTournamentEvaluationInput
				}
			case models.SlotMissing:
				if slot.Content != "" || slot.ContentHash != "" || slot.SubmittedAt != nil {
					return ErrTournamentEvaluationInput
				}
			default:
				return ErrTournamentEvaluationInput
			}
		}
	}
	return nil
}

func judgeAliases(t models.Tournament) map[primitive.ObjectID]string {
	aliases := map[primitive.ObjectID]string{}
	for i, member := range t.Execution.Roster {
		aliases[member.UserID] = fmt.Sprintf("speaker_%02d", i+1)
	}
	return aliases
}

func runeSafePrefix(s string, budget int) string {
	if len(s) <= budget {
		return s
	}
	for budget > 0 && !utf8.RuneStart(s[budget]) {
		budget--
	}
	return s[:budget]
}

func tournamentJudgeRequest(t models.Tournament, index int) TournamentJudgeRequest {
	aliases := judgeAliases(t)
	request := TournamentJudgeRequest{RubricVersion: TournamentRubricVersion, Topic: t.Topic, Round: t.Execution.Phases[index].Round, Submissions: []TournamentJudgeSubmission{}, Context: []TournamentJudgeContext{}}
	for _, slot := range t.Execution.Phases[index].Slots {
		if slot.Status == models.SlotSubmitted {
			request.Submissions = append(request.Submissions, TournamentJudgeSubmission{aliases[slot.UserID], slot.Content})
		}
	}
	previous := 0
	for _, phase := range t.Execution.Phases[:index] {
		for _, slot := range phase.Slots {
			if slot.Status == models.SlotSubmitted {
				previous++
			}
		}
	}
	if previous > 0 {
		budget := 16384 / previous
		for _, phase := range t.Execution.Phases[:index] {
			for _, slot := range phase.Slots {
				if slot.Status == models.SlotSubmitted {
					text := runeSafePrefix(slot.Content, budget)
					request.Context = append(request.Context, TournamentJudgeContext{phase.Round, aliases[slot.UserID], text, len(text) < len(slot.Content)})
				}
			}
		}
	}
	return request
}

// Reject duplicate keys and excessive nesting before decoding into the exact shape.
func validateJSONValue(d *json.Decoder, depth int) error {
	if depth > 12 {
		return ErrTournamentEvaluationOutput
	}
	token, err := d.Token()
	if err != nil {
		return err
	}
	delim, ok := token.(json.Delim)
	if !ok {
		return nil
	}
	switch delim {
	case '{':
		seen := map[string]bool{}
		allowed := map[int]map[string]bool{
			0: {"round": true, "scores": true},
			2: {"speaker": true, "criteria": true, "explanation": true},
			3: {"reasoning": true, "relevance": true, "phaseSkill": true, "clarity": true},
		}[depth]
		for d.More() {
			key, err := d.Token()
			if err != nil {
				return err
			}
			name, ok := key.(string)
			if !ok || seen[name] || !allowed[name] {
				return ErrTournamentEvaluationOutput
			}
			seen[name] = true
			if err := validateJSONValue(d, depth+1); err != nil {
				return err
			}
		}
		if len(seen) != len(allowed) {
			return ErrTournamentEvaluationOutput
		}
	case '[':
		for d.More() {
			if err := validateJSONValue(d, depth+1); err != nil {
				return err
			}
		}
	default:
		return ErrTournamentEvaluationOutput
	}
	_, err = d.Token()
	return err
}

func decodeJudgeOutput(raw []byte, request TournamentJudgeRequest) (map[string]models.ParticipantScore, error) {
	invalid := func() (map[string]models.ParticipantScore, error) { return nil, ErrTournamentEvaluationOutput }
	if len(raw) == 0 || len(raw) > TournamentProviderOutputLimit || !utf8.Valid(raw) {
		return invalid()
	}
	scan := json.NewDecoder(bytes.NewReader(raw))
	scan.UseNumber()
	if validateJSONValue(scan, 0) != nil {
		return invalid()
	}
	if _, err := scan.Token(); err != io.EOF {
		return invalid()
	}
	type criteria struct {
		Reasoning  *int `json:"reasoning"`
		Relevance  *int `json:"relevance"`
		PhaseSkill *int `json:"phaseSkill"`
		Clarity    *int `json:"clarity"`
	}
	var response struct {
		Round  string `json:"round"`
		Scores *[]struct {
			Speaker     string    `json:"speaker"`
			Criteria    *criteria `json:"criteria"`
			Explanation *string   `json:"explanation"`
		} `json:"scores"`
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if d.Decode(&response) != nil || response.Round != request.Round || response.Scores == nil || len(*response.Scores) != len(request.Submissions) {
		return invalid()
	}
	expected := map[string]bool{}
	for _, submission := range request.Submissions {
		expected[submission.Speaker] = true
	}
	scores := map[string]models.ParticipantScore{}
	for _, entry := range *response.Scores {
		c := entry.Criteria
		if !expected[entry.Speaker] || c == nil || c.Reasoning == nil || c.Relevance == nil || c.PhaseSkill == nil || c.Clarity == nil || entry.Explanation == nil {
			return invalid()
		}
		delete(expected, entry.Speaker)
		if *c.Reasoning < 0 || *c.Reasoning > 35 || *c.Relevance < 0 || *c.Relevance > 25 || *c.PhaseSkill < 0 || *c.PhaseSkill > 25 || *c.Clarity < 0 || *c.Clarity > 15 || strings.TrimSpace(*entry.Explanation) == "" || utf8.RuneCountInString(*entry.Explanation) > 500 || strings.ContainsRune(*entry.Explanation, 0) {
			return invalid()
		}
		score := models.CriteriaScore{Reasoning: *c.Reasoning, Relevance: *c.Relevance, PhaseSkill: *c.PhaseSkill, Clarity: *c.Clarity}
		scores[entry.Speaker] = models.ParticipantScore{Score: score.Reasoning + score.Relevance + score.PhaseSkill + score.Clarity, Criteria: score, Explanation: *entry.Explanation, SubmissionStatus: models.SlotSubmitted}
	}
	return scores, nil
}

func aggregateTournamentScores(t models.Tournament, result models.EvaluationResult) (models.Winner, []models.WinningIndividual, []models.TournamentSideMean) {
	totals := make(map[primitive.ObjectID]int)
	for _, round := range result.Rounds() {
		for _, score := range round.Scores {
			totals[score.UserID] += score.Score
		}
	}
	participants := []models.WinningIndividual{}
	best, tied := -1, []models.WinningIndividual{}
	means := []models.TournamentSideMean{{Side: models.StanceFor}, {Side: models.StanceAgainst}}
	for _, member := range t.Execution.Roster {
		entry := models.WinningIndividual{UserID: member.UserID, TotalScore: totals[member.UserID]}
		participants = append(participants, entry)
		if entry.TotalScore > best {
			best, tied = entry.TotalScore, []models.WinningIndividual{entry}
		} else if entry.TotalScore == best {
			tied = append(tied, entry)
		}
		side := 0
		if member.Stance == models.StanceAgainst {
			side = 1
		}
		means[side].TotalScore += entry.TotalScore
		means[side].ParticipantCount++
	}
	for i := range means {
		means[i].Mean = float64(means[i].TotalScore) / float64(means[i].ParticipantCount)
	}
	winner := models.Winner{Side: "draw", TiedIndividuals: []models.WinningIndividual{}}
	left, right := means[0].TotalScore*means[1].ParticipantCount, means[1].TotalScore*means[0].ParticipantCount
	if left > right {
		winner.Side = models.StanceFor
	} else if right > left {
		winner.Side = models.StanceAgainst
	}
	if len(tied) == 1 {
		winner.Individual = &tied[0]
	} else {
		winner.TiedIndividuals = tied
	}
	return winner, participants, means
}
