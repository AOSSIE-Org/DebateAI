package services

import (
	"context"
	"errors"

	"google.golang.org/genai"
)

// initGemini initializes the Gemini client.
// For now this is a stub that returns nil without error, so the rest of the
// backend can compile and run. A real implementation can be added later.
func initGemini(apiKey string) (*genai.Client, error) {
	// TODO: real implementation later
	return nil, nil
}

// generateModelText is a stubbed helper that keeps the expected signature
// used throughout the codebase but does not call the real Gemini API yet.
func generateModelText(ctx context.Context, modelName, prompt string) (string, error) {
	// geminiClient is declared in another file (e.g., debatevsbot.go) as *genai.Client.
	if geminiClient == nil {
		return "", errors.New("gemini client not initialized")
	}

	// TODO: Replace with real Gemini API call.
	// Temporary stub: return an empty string and no error.
	return "", nil
}

// generateDefaultModelText is used by several services to call a default model.
func generateDefaultModelText(ctx context.Context, prompt string) (string, error) {
	const defaultModel = "gemini-1.5-flash"
	return generateModelText(ctx, defaultModel, prompt)
}
