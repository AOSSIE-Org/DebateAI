package services

import (
    "context"
    "encoding/json" // Added this import for json.Unmarshal
    "errors"
    "fmt"
    "log"
    "strings"

    "arguehub/models"
    "github.com/google/generative-ai-go/genai"
)

// GenerateDebateTopic generates a debate topic using the Gemini API based on the user's skill level
func GenerateDebateTopic(skillLevel string) (string, error) {
    if geminiClient == nil {
        return "", errors.New("Gemini client not initialized")
    }

    // Construct the prompt for generating a debate topic
    prompt := fmt.Sprintf(
        "Generate a concise debate topic suitable for a %s level debater. The topic should be a statement that can be argued for or against, and it should be specific enough to allow for detailed arguments. Avoid topics that are too broad or too narrow.",
        skillLevel,
    )

    ctx := context.Background()
    model := geminiClient.GenerativeModel("gemini-1.5-flash")

    // Set safety settings to prevent inappropriate content
    model.SafetySettings = []*genai.SafetySetting{
        {Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockLowAndAbove},
        {Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockLowAndAbove},
        {Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockLowAndAbove},
        {Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockLowAndAbove},
    }

    resp, err := model.GenerateContent(ctx, genai.Text(prompt))
    if err != nil || len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
        log.Printf("Failed to generate topic: %v", err)
        return getFallbackTopic(skillLevel), nil
    }

    for _, part := range resp.Candidates[0].Content.Parts {
        if text, ok := part.(genai.Text); ok {
            return strings.TrimSpace(string(text)), nil
        }
    }

    return getFallbackTopic(skillLevel), nil
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
    model := geminiClient.GenerativeModel("gemini-1.5-flash")
    model.SafetySettings = []*genai.SafetySetting{
        {Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockNone},
        {Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockNone},
        {Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockNone},
        {Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockNone},
    }

    resp, err := model.GenerateContent(ctx, genai.Text(prompt))
    if err != nil {
        log.Printf("Gemini error: %v", err)
        return models.ProsConsEvaluation{}, err
    }

    if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
        return models.ProsConsEvaluation{}, errors.New("no evaluation returned")
    }

    for _, part := range resp.Candidates[0].Content.Parts {
        if text, ok := part.(genai.Text); ok {
            cleanedText := strings.TrimSpace(string(text))
            cleanedText = strings.TrimPrefix(cleanedText, "```json")
            cleanedText = strings.TrimSuffix(cleanedText, "```")
            cleanedText = strings.TrimSpace(cleanedText)

            var eval models.ProsConsEvaluation
            err = json.Unmarshal([]byte(cleanedText), &eval)
            if err != nil {
                log.Printf("Failed to parse evaluation JSON: %v. Raw: %s", err, cleanedText)
                return models.ProsConsEvaluation{}, err
            }

            // Calculate total score based on the number of arguments provided
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
    }

    return models.ProsConsEvaluation{}, errors.New("no valid evaluation returned")
}