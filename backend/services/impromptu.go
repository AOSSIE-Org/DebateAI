package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"time"
)

type ImpromptuEvaluation struct {
	Score    int    `json:"score"`
	Result   string `json:"result"`
	Feedback string `json:"feedback"`
}

// Static list of impromptu topics
var impromptuTopics = []string{
	"Higher education should be fully subsidized by the government.",
	"Remote work (WFH) should become the permanent standard for all companies.",
	"Artificial Intelligence is the greatest threat to human creativity.",
	"Social media usage for children under 16 should be legally banned.",
	"Standardized testing is not an accurate measure of a student's intelligence.",
}

// GetRandomImpromptuTopic returns a single random topic for the impromptu session
func GetRandomImpromptuTopic() string {
	rand.Seed(time.Now().UnixNano())
	return impromptuTopics[rand.Intn(len(impromptuTopics))]
}

// ImpromptuJudgmentData uses the exact structure expected by the JudgmentPopup component
type ImpromptuJudgmentData struct {
	OpeningStatement struct {
		User struct{ Score int `json:"score"`; Reason string `json:"reason"` } `json:"user"`
		Bot  struct{ Score int `json:"score"`; Reason string `json:"reason"` } `json:"bot"`
	} `json:"opening_statement"`
	CrossExamination struct {
		User struct{ Score int `json:"score"`; Reason string `json:"reason"` } `json:"user"`
		Bot  struct{ Score int `json:"score"`; Reason string `json:"reason"` } `json:"bot"`
	} `json:"cross_examination"`
	Answers struct {
		User struct{ Score int `json:"score"`; Reason string `json:"reason"` } `json:"user"`
		Bot  struct{ Score int `json:"score"`; Reason string `json:"reason"` } `json:"bot"`
	} `json:"answers"`
	Closing struct {
		User struct{ Score int `json:"score"`; Reason string `json:"reason"` } `json:"user"`
		Bot  struct{ Score int `json:"score"`; Reason string `json:"reason"` } `json:"bot"`
	} `json:"closing"`
	Total struct {
		User int `json:"user"`
		Bot  int `json:"bot"`
	} `json:"total"`
	Verdict struct {
		Winner           string `json:"winner"`
		Reason           string `json:"reason"`
		Congratulations  string `json:"congratulations"`
		OpponentAnalysis string `json:"opponent_analysis"`
	} `json:"verdict"`
}

// EvaluateImpromptuSpeech evaluates the text and returns the judgment structure
func EvaluateImpromptuSpeech(topic string, transcript string) (*ImpromptuJudgmentData, error) {
	if geminiClient == nil {
		return nil, fmt.Errorf("gemini client is not initialized")
	}

	prompt := fmt.Sprintf(`Act as a professional debate judge. Analyze the following impromptu speech transcript and provide scores in STRICT JSON format.

Topic: "%s"
Speech Transcript: "%s"

Judgment Criteria:
1. Opening Statement (0-10 points):
   - Clarity of position, strength of the hook, and initial reasoning.
2. Cross Examination (0-10 points):
   - Since this is a solo impromptu speech, evaluate the speaker's ability to preemptively address potential counter-arguments or opposing views.
3. Answers / Justification (0-10 points):
   - Evaluate the depth of the arguments and how well the speaker justifies their claims with logic or examples.
4. Closing (0-10 points):
   - Comprehensive summary of key points and the persuasiveness of the final conclusion.

Because this is a solo impromptu challenge, the "bot" scores MUST be exactly 0, and the bot reasons MUST be "N/A".

Required Output Format:
{
  "opening_statement": {
    "user": { "score": X, "reason": "text" },
    "bot": { "score": 0, "reason": "N/A" }
  },
  "cross_examination": {
    "user": { "score": X, "reason": "text" },
    "bot": { "score": 0, "reason": "N/A" }
  },
  "answers": {
    "user": { "score": X, "reason": "text" },
    "bot": { "score": 0, "reason": "N/A" }
  },
  "closing": {
    "user": { "score": X, "reason": "text" },
    "bot": { "score": 0, "reason": "N/A" }
  },
  "total": {
    "user": X,
    "bot": 0
  },
  "verdict": {
    "winner": "<'User' if total >= 20, otherwise 'AI Evaluator'>",
    "reason": "<Overall conclusion about this speech>",
    "congratulations": "<Encouraging message or praise>",
    "opponent_analysis": "<Specific advice for improvising better in the future>"
  }
}

Provide ONLY the JSON output without any additional text.`, topic, transcript)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	resp, err := generateDefaultModelText(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var eval ImpromptuJudgmentData
	if err := json.Unmarshal([]byte(resp), &eval); err != nil {
		log.Printf("Failed to parse JSON for impromptu evaluation: %v", err)
		return nil, err
	}

	return &eval, nil
}