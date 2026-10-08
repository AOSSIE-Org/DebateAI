package services

import (
	"context"
	"errors"
	"strings"

	"google.golang.org/genai"
)

const defaultGeminiModel = "gemini-2.0-flash"
const fallbackGeminiModel = "gemini-1.5-flash"

func initGemini(apiKey string) (*genai.Client, error) {
	config := &genai.ClientConfig{}
	if apiKey != "" {
		config.APIKey = apiKey
	}
	return genai.NewClient(context.Background(), config)
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

	resp, err := geminiClient.Models.GenerateContent(ctx, modelName, genai.Text(prompt), config)
	if err != nil {
		if modelName != fallbackGeminiModel {
			resp, err = geminiClient.Models.GenerateContent(ctx, fallbackGeminiModel, genai.Text(prompt), config)
			if err != nil {
				return "", err
			}
			return cleanModelOutput(resp.Text()), nil
		}
		return "", err
	}
	return cleanModelOutput(resp.Text()), nil
}

// StreamModelText streams tokens from Gemini in real-time chunk-by-chunk.
func StreamModelText(ctx context.Context, modelName, prompt string, onChunk func(chunk string) error) (string, error) {
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

	var fullBuilder strings.Builder
	for resp, err := range geminiClient.Models.GenerateContentStream(ctx, modelName, genai.Text(prompt), config) {
		if err != nil {
			return fullBuilder.String(), err
		}
		if resp != nil {
			chunk := resp.Text()
			if chunk != "" {
				fullBuilder.WriteString(chunk)
				if onChunk != nil {
					if chunkErr := onChunk(chunk); chunkErr != nil {
						return fullBuilder.String(), chunkErr
					}
				}
			}
		}
	}
	return cleanModelOutput(fullBuilder.String()), nil
}

// StreamDefaultModelText streams using default model with automatic fallback to secondary model.
func StreamDefaultModelText(ctx context.Context, prompt string, onChunk func(chunk string) error) (string, error) {
	text, err := StreamModelText(ctx, defaultGeminiModel, prompt, onChunk)
	if err != nil {
		return StreamModelText(ctx, fallbackGeminiModel, prompt, onChunk)
	}
	return text, nil
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
	text, err := generateModelText(ctx, defaultGeminiModel, prompt)
	if err != nil {
		return generateModelText(ctx, fallbackGeminiModel, prompt)
	}
	return text, nil
}
