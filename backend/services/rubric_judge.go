package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
)

type DebateTurn struct {
	Speaker string `json:"speaker" binding:"required"`
	Role    string `json:"role" binding:"required"` // "Affirmative", "Negative", "For", "Against"
	Phase   string `json:"phase"`                  // "Opening", "CrossExamination", "Rebuttal", "Closing"
	Content string `json:"content" binding:"required"`
}

type DimensionBreakdown struct {
	MatterScore    float64 `json:"matter_score"`    // 0 - 40
	MannerScore    float64 `json:"manner_score"`    // 0 - 40
	MethodScore    float64 `json:"method_score"`    // 0 - 20
	TotalScore     float64 `json:"total_score"`     // 0 - 100
	MatterFeedback string  `json:"matter_feedback"`
	MannerFeedback string  `json:"manner_feedback"`
	MethodFeedback string  `json:"method_feedback"`
}

type ClashEvaluation struct {
	ClashPoint          string `json:"clash_point"`
	AffirmativeArgument string `json:"affirmative_argument"`
	NegativeArgument    string `json:"negative_argument"`
	WinningSide         string `json:"winning_side"` // "Affirmative", "Negative", "Draw"
	Analysis            string `json:"analysis"`
}

type ParticipantRubricScore struct {
	ParticipantID       string             `json:"participant_id"`
	Role                string             `json:"role"`
	Dimensions          DimensionBreakdown `json:"dimensions"`
	Strengths           []string           `json:"strengths"`
	AreasForImprovement []string           `json:"areas_for_improvement"`
	Fallacies           []string           `json:"fallacies"`
}

type ComprehensiveJudgementReport struct {
	Topic               string                 `json:"topic"`
	Format              string                 `json:"format"`
	Affirmative         ParticipantRubricScore `json:"affirmative"`
	Negative            ParticipantRubricScore `json:"negative"`
	Clashes             []ClashEvaluation      `json:"clashes"`
	Winner              string                 `json:"winner"` // "Affirmative", "Negative", "Draw"
	Margin              string                 `json:"margin"` // "Decisive", "Clear", "Narrow", "Tie"
	ScoreDifference     float64                `json:"score_difference"`
	AdjudicationSummary string                 `json:"adjudication_summary"`
	JudgedAt            time.Time              `json:"judged_at"`
}

func EvaluateDebateRubric(ctx context.Context, topic, format string, turns []DebateTurn) (*ComprehensiveJudgementReport, error) {
	if strings.TrimSpace(topic) == "" {
		return nil, errors.New("debate topic is required")
	}
	if len(turns) < 2 {
		return nil, errors.New("at least 2 turns are required to evaluate a debate")
	}
	if format == "" {
		format = "WUDC / World Parliamentary (Matter 40%, Manner 40%, Method 20%)"
	}

	var transcriptBuilder strings.Builder
	for i, turn := range turns {
		transcriptBuilder.WriteString(fmt.Sprintf("Turn %d [%s - %s (%s)]:\n%s\n\n", i+1, turn.Speaker, turn.Role, turn.Phase, turn.Content))
	}

	prompt := fmt.Sprintf(`You are a Chief Adjudicator of the World Universities Debating Championship (WUDC).
Evaluate the following debate transcript using the internationally recognized 3-Pillar Rubric:
1. Matter (40 points): Depth of logic, validity of argumentation, evidence, empirical substantiation, refutation quality.
2. Manner (40 points): Rhetorical persuasiveness, clarity of speech, conviction, eloquence, respectful yet forceful engagement.
3. Method (20 points): Dynamic speech structure, strategic prioritization of critical arguments, clash management, time allocation.

Debate Topic: "%s"
Format Standard: "%s"

Full Transcript:
%s

Adjudicate both the Affirmative side and the Negative side independently according to this rubric.
Identify the critical Clash Points where both sides collided and determine which side won each clash.
Highlight any logical fallacies detected for each participant.

You MUST respond ONLY with a STRICT JSON object in the exact schema below, with NO markdown backticks and NO outside comments:
{
  "affirmative": {
    "participant_id": "Affirmative",
    "role": "Affirmative",
    "dimensions": {
      "matter_score": 32.5,
      "manner_score": 34.0,
      "method_score": 17.0,
      "matter_feedback": "feedback text",
      "manner_feedback": "feedback text",
      "method_feedback": "feedback text"
    },
    "strengths": ["point 1", "point 2"],
    "areas_for_improvement": ["point 1", "point 2"],
    "fallacies": ["Ad Hominem on turn 2", "False Dilemma"]
  },
  "negative": {
    "participant_id": "Negative",
    "role": "Negative",
    "dimensions": {
      "matter_score": 30.0,
      "manner_score": 31.5,
      "method_score": 16.0,
      "matter_feedback": "feedback text",
      "manner_feedback": "feedback text",
      "method_feedback": "feedback text"
    },
    "strengths": ["point 1", "point 2"],
    "areas_for_improvement": ["point 1", "point 2"],
    "fallacies": ["Straw Man"]
  },
  "clashes": [
    {
      "clash_point": "Economic feasibility of transition",
      "affirmative_argument": "summary of aff argument",
      "negative_argument": "summary of neg argument",
      "winning_side": "Affirmative",
      "analysis": "reasoning why affirmative prevailed"
    }
  ],
  "winner": "Affirmative",
  "adjudication_summary": "Comprehensive adjudication notes summarizing the round."
}`, topic, format, transcriptBuilder.String())

	rawResponse, err := generateDefaultModelText(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("failed to generate rubric judgement: %w", err)
	}

	cleaned := cleanModelOutput(rawResponse)

	var parsed struct {
		Affirmative         ParticipantRubricScore `json:"affirmative"`
		Negative            ParticipantRubricScore `json:"negative"`
		Clashes             []ClashEvaluation      `json:"clashes"`
		Winner              string                 `json:"winner"`
		AdjudicationSummary string                 `json:"adjudication_summary"`
	}

	if err := json.Unmarshal([]byte(cleaned), &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse rubric judge JSON: %w", err)
	}

	clampScore := func(val, min, max float64) float64 {
		if val < min {
			return min
		}
		if val > max {
			return max
		}
		return math.Round(val*10) / 10
	}

	parsed.Affirmative.Dimensions.MatterScore = clampScore(parsed.Affirmative.Dimensions.MatterScore, 0, 40)
	parsed.Affirmative.Dimensions.MannerScore = clampScore(parsed.Affirmative.Dimensions.MannerScore, 0, 40)
	parsed.Affirmative.Dimensions.MethodScore = clampScore(parsed.Affirmative.Dimensions.MethodScore, 0, 20)
	parsed.Affirmative.Dimensions.TotalScore = parsed.Affirmative.Dimensions.MatterScore + parsed.Affirmative.Dimensions.MannerScore + parsed.Affirmative.Dimensions.MethodScore

	parsed.Negative.Dimensions.MatterScore = clampScore(parsed.Negative.Dimensions.MatterScore, 0, 40)
	parsed.Negative.Dimensions.MannerScore = clampScore(parsed.Negative.Dimensions.MannerScore, 0, 40)
	parsed.Negative.Dimensions.MethodScore = clampScore(parsed.Negative.Dimensions.MethodScore, 0, 20)
	parsed.Negative.Dimensions.TotalScore = parsed.Negative.Dimensions.MatterScore + parsed.Negative.Dimensions.MannerScore + parsed.Negative.Dimensions.MethodScore

	diff := math.Abs(parsed.Affirmative.Dimensions.TotalScore - parsed.Negative.Dimensions.TotalScore)
	diff = math.Round(diff*10) / 10

	var margin string
	if diff == 0 {
		margin = "Tie"
	} else if diff < 3.0 {
		margin = "Narrow"
	} else if diff < 8.0 {
		margin = "Clear"
	} else {
		margin = "Decisive"
	}

	winner := parsed.Winner
	if winner != "Affirmative" && winner != "Negative" && winner != "Draw" {
		if parsed.Affirmative.Dimensions.TotalScore > parsed.Negative.Dimensions.TotalScore {
			winner = "Affirmative"
		} else if parsed.Negative.Dimensions.TotalScore > parsed.Affirmative.Dimensions.TotalScore {
			winner = "Negative"
		} else {
			winner = "Draw"
		}
	}

	report := &ComprehensiveJudgementReport{
		Topic:               topic,
		Format:              format,
		Affirmative:         parsed.Affirmative,
		Negative:            parsed.Negative,
		Clashes:             parsed.Clashes,
		Winner:              winner,
		Margin:              margin,
		ScoreDifference:     diff,
		AdjudicationSummary: parsed.AdjudicationSummary,
		JudgedAt:            time.Now().UTC(),
	}

	return report, nil
}
