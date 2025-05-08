package services

import (
	"arguehub/db"
	"arguehub/models"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/google/generative-ai-go/genai"
	"go.mongodb.org/mongo-driver/bson"
)

// InitCoachService is now a no-op since we don’t need a collection anymore
func InitCoachService() {
	log.Println("Coach service initialized")
}

// GenerateWeakStatement generates a weak opening statement for a given topic and stance using Gemini
func GenerateWeakStatement(topic, stance string) (models.WeakStatement, error) {
	if geminiClient == nil {
		log.Println("Gemini client not initialized")
		return models.WeakStatement{}, errors.New("Gemini client not initialized")
	}

	// Construct the prompt for Gemini to generate a full-fledged weak statement
	prompt := fmt.Sprintf(
		`Act as a debate coach and generate a weak opening statement for the topic "%s" taking the stance "%s". 
The statement should:
- Be a full paragraph or more.
- Be vague or lack specific reasoning.
- Avoid strong evidence or persuasive language.
- Be simple and open to improvement.

Required Output Format (JSON):
{
  "id": "generated",
  "text": "your weak statement here"
}

Provide ONLY the JSON output without additional text or markdown formatting.`,
		topic, stance,
	)

	ctx := context.Background()
	model := geminiClient.GenerativeModel("gemini-1.5-flash")

	// Set safety settings to BLOCK_NONE
	model.SafetySettings = []*genai.SafetySetting{
		{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockNone},
		{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockNone},
		{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockNone},
		{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockNone},
	}

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		log.Printf("Gemini error generating weak statement: %v", err)
		return models.WeakStatement{}, fmt.Errorf("failed to generate weak statement: %v", err)
	}

	if resp.PromptFeedback != nil && resp.PromptFeedback.BlockReason != 0 {
		log.Printf("Prompt blocked: %v", resp.PromptFeedback.BlockReason)
		return models.WeakStatement{}, fmt.Errorf("prompt blocked: %v", resp.PromptFeedback.BlockReason)
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		log.Println("No valid response from Gemini")
		return models.WeakStatement{}, errors.New("no weak statement generated")
	}

	for _, part := range resp.Candidates[0].Content.Parts {
		if text, ok := part.(genai.Text); ok {
			cleanedText := string(text)
			cleanedText = strings.TrimSpace(cleanedText)
			cleanedText = strings.TrimPrefix(cleanedText, "```json")
			cleanedText = strings.TrimSuffix(cleanedText, "```")
			cleanedText = strings.TrimPrefix(cleanedText, "```")
			cleanedText = strings.TrimSpace(cleanedText)

			log.Printf("Cleaned Gemini response: %s", cleanedText)

			// Temporary struct to parse Gemini's JSON response
			type geminiResponse struct {
				ID   string `json:"id"`
				Text string `json:"text"`
			}
			var gr geminiResponse
			err = json.Unmarshal([]byte(cleanedText), &gr)
			if err != nil {
				log.Printf("Failed to parse weak statement JSON: %v. Raw response: %s", err, cleanedText)
				return models.WeakStatement{}, fmt.Errorf("invalid weak statement format: %v", err)
			}

			// Validate required fields are present
			if gr.ID == "" || gr.Text == "" {
				log.Printf("Generated weak statement missing required fields: %+v", gr)
				return models.WeakStatement{}, errors.New("invalid response format: missing fields")
			}

			// Create the WeakStatement with topic and stance included
			weakStatement := models.WeakStatement{
				ID:     gr.ID,
				Topic:  topic,
				Stance: stance,
				Text:   gr.Text,
			}
			return weakStatement, nil
		}
	}

	return models.WeakStatement{}, errors.New("no valid weak statement returned")
}

// EvaluateArgument evaluates the user's improved argument against the weak statement
func EvaluateArgument(topic, stance, weakStatementText, userResponse string) (models.Evaluation, error) {
	if geminiClient == nil {
		log.Println("Gemini client not initialized")
		return models.Evaluation{}, errors.New("Gemini client not initialized")
	}

	prompt := fmt.Sprintf(
		`Act as a debate coach and evaluate the user's improved argument for the topic "%s" with stance "%s", based on the original weak statement. Provide feedback and a score out of 10 in JSON format.

Evaluation Criteria:
1. Strength of Argument (up to 4 points): Clarity of position, persuasiveness, and logical flow.
2. Use of Evidence (up to 3 points): Inclusion of supporting details or reasoning.
3. Expression (up to 3 points): Language proficiency and articulation.

Original Weak Statement: "%s"
User's Improved Argument: "%s"

Required Output Format:
{
  "score": X,
  "feedback": "text describing strengths and areas for improvement"
}

Provide ONLY the JSON output without additional text or markdown formatting.`,
		topic, stance, weakStatementText, userResponse,
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
		return models.Evaluation{}, fmt.Errorf("failed to evaluate argument: %v", err)
	}

	if resp.PromptFeedback != nil && resp.PromptFeedback.BlockReason != 0 {
		log.Printf("Prompt blocked: %v", resp.PromptFeedback.BlockReason)
		return models.Evaluation{}, fmt.Errorf("prompt blocked due to safety settings: %v", resp.PromptFeedback.BlockReason)
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		log.Println("No valid response from Gemini")
		return models.Evaluation{}, errors.New("no evaluation returned")
	}

	for _, part := range resp.Candidates[0].Content.Parts {
		if text, ok := part.(genai.Text); ok {
			cleanedText := string(text)
			cleanedText = strings.TrimSpace(cleanedText)
			cleanedText = strings.TrimPrefix(cleanedText, "```json")
			cleanedText = strings.TrimSuffix(cleanedText, "```")
			cleanedText = strings.TrimPrefix(cleanedText, "```")
			cleanedText = strings.TrimSpace(cleanedText)

			log.Printf("Cleaned Gemini response: %s", cleanedText)

			var evaluation models.Evaluation
			err = json.Unmarshal([]byte(cleanedText), &evaluation)
			if err != nil {
				log.Printf("Failed to parse evaluation JSON: %v. Raw response: %s", err, cleanedText)
				return models.Evaluation{}, fmt.Errorf("invalid evaluation format: %v", err)
			}
			return evaluation, nil
		}
	}

	return models.Evaluation{}, errors.New("no valid evaluation returned")
}

// UpdateUserPoints increments the user's total points in the database
func UpdateUserPoints(userID string, points int) error {
	_, err := db.MongoDatabase.Collection("users").UpdateOne(
		context.Background(),
		bson.M{"_id": userID},
		bson.M{"$inc": bson.M{"total_points": points}},
	)
	return err
}
