package services

import (
	"context"
	"errors"
	"strings"

	"google.golang.org/genai"
)

const defaultGeminiModel = "gemini-2.0-flash" // Recommended version for 2026


var geminiClient *genai.Client

// InitGemini (Capitalized) so it can be called from main.go
func InitGemini(apiKey string) error {
	config := &genai.ClientConfig{}
	if apiKey != "" {
		config.APIKey = apiKey
	}
	
	client, err := genai.NewClient(context.Background(), config)
	if err != nil {
		return err
	}

	geminiClient = client // Assign to the global variable
	return nil
}

func generateModelText(ctx context.Context, modelName, prompt string) (string, error) {
	if geminiClient == nil {
		return "", errors.New("gemini client not initialized")
	}

	config := &genai.GenerateContentConfig{
		SafetySettings: []*genai.SafetySetting{
			{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockThresholdBlockNone},
			{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockThresholdBlockNone},
			{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockThresholdBlockNone},
			{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockThresholdBlockNone},
		},
	}

	// Use the modelName passed in or the default
	resp, err := geminiClient.Models.GenerateContent(ctx, modelName, genai.Text(prompt), config)
	if err != nil {
		return "", err
	}
	return cleanModelOutput(resp.Text()), nil
}

func cleanModelOutput(text string) string {
	cleaned := strings.TrimSpace(text)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```JSON")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	return strings.TrimSpace(cleaned)
}

func GenerateDefaultModelText(ctx context.Context, prompt string) (string, error) {
	return generateModelText(ctx, defaultGeminiModel, prompt)
}
