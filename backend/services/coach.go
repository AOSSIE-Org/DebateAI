package services

import (
	"arguehub/db"
	"arguehub/models"
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"go.mongodb.org/mongo-driver/bson"
)

// InitCoachService is now a no-op since we don’t need a collection anymore
func InitCoachService() {
}

// GenerateWeakStatement generates a weak opening statement for a given topic and stance using Gemini
func GenerateWeakStatement(topic, stance string) (models.WeakStatement, error) {
	if geminiClient == nil {
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
	response, err := generateDefaultModelText(ctx, prompt)
	if err != nil {
		return models.WeakStatement{}, fmt.Errorf("failed to generate weak statement: %v", err)
	}
	if response == "" {
		return models.WeakStatement{}, errors.New("no weak statement generated")
	}

	type geminiResponse struct {
		ID   string `json:"id"`
		Text string `json:"text"`
	}
	var gr geminiResponse
	if err := json.Unmarshal([]byte(response), &gr); err != nil {
		return models.WeakStatement{}, fmt.Errorf("invalid weak statement format: %v", err)
	}

	if gr.ID == "" || gr.Text == "" {
		return models.WeakStatement{}, errors.New("invalid response format: missing fields")
	}

	return models.WeakStatement{
		ID:     gr.ID,
		Topic:  topic,
		Stance: stance,
		Text:   gr.Text,
	}, nil
}

// EvaluateArgument evaluates the user's improved argument against the weak statement
func EvaluateArgument(topic, stance, weakStatementText, userResponse string) (models.Evaluation, error) {
	if geminiClient == nil {
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
	response, err := generateDefaultModelText(ctx, prompt)
	if err != nil {
		return models.Evaluation{}, fmt.Errorf("failed to evaluate argument: %v", err)
	}
	if response == "" {
		return models.Evaluation{}, errors.New("no evaluation returned")
	}

	var evaluation models.Evaluation
	if err := json.Unmarshal([]byte(response), &evaluation); err != nil {
		return models.Evaluation{}, fmt.Errorf("invalid evaluation format: %v", err)
	}
	return evaluation, nil
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
