package services

import (
	"context"
	"errors"
	"strings"

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

	resp, err := geminiClient.Models.GenerateContent(ctx, modelName, genai.Text(prompt), config)
	if err != nil {
		return "", err
	}
	return cleanModelOutput(resp.Text()), nil
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
