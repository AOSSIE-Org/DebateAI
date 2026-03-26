package services

import (
	"context"
	"errors"
	"strings"

	"google.golang.org/genai"
)

const defaultGeminiModel = "gemini-2.5-flash"

func initGemini(apiKey string) (*genai.Client, error) {
	config := &genai.ClientConfig{}
	if apiKey != "" {
		config.APIKey = apiKey
	}
	return genai.NewClient(context.Background(), config)
}

func generateModelText(ctx context.Context, modelName, prompt string) (string, *genai.GenerateContentResponseUsageMetadata, error) {
	if geminiClient == nil {
		return "", nil, errors.New("gemini client not initialized")
	}

	config := &genai.GenerateContentConfig{
		SafetySettings: []*genai.SafetySetting{
			{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockThresholdBlockNone},
			{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockThresholdBlockNone},
			{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockThresholdBlockNone},
			{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockThresholdBlockNone},
		},
	}

	resp, err := geminiClient.Models.GenerateContent(ctx, modelName, genai.Text(prompt), config)
	if err != nil {
		return "", nil, err
	}
	return cleanModelOutput(resp.Text()), resp.UsageMetadata, nil
}

func cleanModelOutput(text string) string {
	cleaned := strings.TrimSpace(text)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```JSON")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	return strings.TrimSpace(cleaned)
}

func generateDefaultModelText(ctx context.Context, prompt string) (string, *genai.GenerateContentResponseUsageMetadata, error) {
	return generateModelText(ctx, defaultGeminiModel, prompt)
}
