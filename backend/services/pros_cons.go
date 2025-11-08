package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"arguehub/models"
)

// GenerateDebateTopic generates a debate topic using the Gemini API based on the user's skill level
func GenerateDebateTopic(skillLevel string) (string, error) {
	if geminiClient == nil {
		return "", errors.New("Gemini client not initialized")
	}

	// Construct the prompt for generating a debate topic
	prompt := fmt.Sprintf(
		`Generate a concise debate topic suitable for a %s level debater. The topic must:
- Be a clear statement that can be argued for or against.
- Be specific enough for detailed arguments but avoid overly broad or narrow topics.
- NOT include formal debate phrasing like "This house believes that" or similar prefixes.
- Return only the topic statement itself.
Examples:
- Beginner: Should students be allowed to use smartphones in class?
- Intermediate: Is remote work better than office-based work?
- Advanced: Should governments prioritize economic growth over environmental protection?`,
		skillLevel,
	)

	ctx := context.Background()
	response, err := generateDefaultModelText(ctx, prompt)
	if err != nil {
		return getFallbackTopic(skillLevel), nil
	}
	if response == "" {
		return getFallbackTopic(skillLevel), nil
	}
	return strings.TrimSpace(response), nil
}

// getFallbackTopic returns a predefined topic based on skill level
func getFallbackTopic(skillLevel string) string {
	fallbackTopics := map[string][]string{
		"beginner":     {"Should school uniforms be mandatory?", "Is homework necessary for learning?"},
		"intermediate": {"Is social media beneficial for society?", "Should voting be mandatory?"},
		"advanced":     {"Is globalization beneficial for developing countries?", "Should artificial intelligence be regulated?"},
	}
	topics, ok := fallbackTopics[skillLevel]
	if !ok || len(topics) == 0 {
		return "Should technology be used in education?"
	}
	return topics[0] // Return the first fallback topic for simplicity
}

// EvaluateProsCons evaluates the user's pros and cons
func EvaluateProsCons(topic string, pros, cons []string) (models.ProsConsEvaluation, error) {
	if geminiClient == nil {
		return models.ProsConsEvaluation{}, errors.New("Gemini client not initialized")
	}

	if len(pros) > 5 || len(cons) > 5 {
		return models.ProsConsEvaluation{}, errors.New("maximum of 5 pros and 5 cons allowed")
	}

	prompt := fmt.Sprintf(
		`Act as a debate coach and evaluate the following pros and cons for the topic "%s". For each argument:
- Score it out of 10 based on clarity (3), relevance (3), logic (2), and persuasiveness (2).
- Provide feedback explaining the score.
- Suggest a counterargument.

Pros:
%s

Cons:
%s

Required Output Format (JSON):
{
  "pros": [
    {"score": X, "feedback": "text", "counter": "text"},
    ...
  ],
  "cons": [
    {"score": X, "feedback": "text", "counter": "text"},
    ...
  ]
}`,
		topic,
		strings.Join(pros, "\n"),
		strings.Join(cons, "\n"),
	)

	ctx := context.Background()
	response, err := generateDefaultModelText(ctx, prompt)
	if err != nil {
		return models.ProsConsEvaluation{}, err
	}
	if response == "" {
		return models.ProsConsEvaluation{}, errors.New("no evaluation returned")
	}

	var eval models.ProsConsEvaluation
	if err := json.Unmarshal([]byte(response), &eval); err != nil {
		return models.ProsConsEvaluation{}, err
	}

	totalScore := 0
	for _, pro := range eval.Pros {
		totalScore += pro.Score
	}
	for _, con := range eval.Cons {
		totalScore += con.Score
	}
	eval.Score = totalScore

	return eval, nil
}
