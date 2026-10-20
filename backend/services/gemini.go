package services

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	"google.golang.org/genai"
)

const defaultGeminiModel = "gemini-3.6-flash"

func initGemini(apiKey string) (*genai.Client, error) {
	config := &genai.ClientConfig{}
	if apiKey != "" {
		config.APIKey = apiKey
	}
	return genai.NewClient(context.Background(), config)
}

func generateModelText(ctx context.Context, modelName, prompt string) (string, error) {
	return generateModelTextWithConfig(ctx, modelName, prompt, defaultGenerateContentConfig())
}

func generateJSONModelText(ctx context.Context, modelName, prompt string) (string, error) {
	config := defaultGenerateContentConfig()
	config.ResponseMIMEType = "application/json"
	return generateModelTextWithConfig(ctx, modelName, prompt, config)
}

func generateModelTextWithConfig(ctx context.Context, modelName, prompt string, config *genai.GenerateContentConfig) (string, error) {
	if geminiClient == nil {
		return "", errors.New("gemini client not initialized")
	}

	// Gemini returns transient 503/500 errors when a model is overloaded.
	// Retry those with a short backoff instead of failing the whole request.
	backoff := 2 * time.Second
	var lastErr error
	for attempt := 1; attempt <= geminiMaxAttempts; attempt++ {
		resp, err := geminiClient.Models.GenerateContent(ctx, modelName, genai.Text(prompt), config)
		if err == nil {
			return cleanModelOutput(resp.Text()), nil
		}
		lastErr = err
		if !isTransientGeminiError(err) || attempt == geminiMaxAttempts {
			break
		}
		log.Printf("Gemini attempt %d/%d failed with a transient error, retrying in %s: %v", attempt, geminiMaxAttempts, backoff, err)
		select {
		case <-ctx.Done():
			return "", lastErr
		case <-time.After(backoff):
		}
		backoff *= 2
	}
	return "", lastErr
}

const geminiMaxAttempts = 4

// isTransientGeminiError reports whether a Gemini error is a temporary
// overload or internal error worth retrying. Quota errors (429
// RESOURCE_EXHAUSTED) are not retried: Google asks callers to wait minutes,
// and retrying within seconds only consumes more of the quota.
func isTransientGeminiError(err error) bool {
	msg := err.Error()
	for _, marker := range []string{"Error 503", "Error 500", "UNAVAILABLE", "INTERNAL"} {
		if strings.Contains(msg, marker) {
			return true
		}
	}
	return false
}

func defaultGenerateContentConfig() *genai.GenerateContentConfig {
	return &genai.GenerateContentConfig{
		SafetySettings: []*genai.SafetySetting{
			{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockThresholdBlockNone},
			{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockThresholdBlockNone},
			{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockThresholdBlockNone},
			{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockThresholdBlockNone},
		},
	}
}

func cleanModelOutput(text string) string {
	cleaned := strings.TrimSpace(text)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```JSON")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	return strings.TrimSpace(cleaned)
}

func generateDefaultModelText(ctx context.Context, prompt string) (string, error) {
	return generateModelText(ctx, defaultGeminiModel, prompt)
}

func generateDefaultModelJSONText(ctx context.Context, prompt string) (string, error) {
	return generateJSONModelText(ctx, defaultGeminiModel, prompt)
}
