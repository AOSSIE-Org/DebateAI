package services

import (
	"context"
	"fmt"
	"log"
	"strings"

	"arguehub/models"
)

// GenerateDevilAdvocateQuestion uses Gemini to generate a neutral, critical question based on the debate history.
func GenerateDevilAdvocateQuestion(topic string, history []models.Message) (string, error) {
	if geminiClient == nil {
		return "", fmt.Errorf("Gemini client not initialized")
	}

	// Construct the transcript for context
	transcript := FormatHistory(history)

	// Construct the prompt
	prompt := fmt.Sprintf(`You are a neutral Devil's Advocate. Your goal is to improve the quality of this debate on the topic "%s" by asking a single, sharp, critical question that challenges both sides or introduces a neglected perspective. 

Debate History:
%s

Instructions:
1. Do not take a side. 
2. Be impartial and objective.
3. Be concise. 
4. Reply with ONLY the question.`, topic, transcript)

	ctx := context.Background()
	response, err := generateDefaultModelText(ctx, prompt)
	if err != nil {
		log.Printf("Error generating Devil's Advocate question: %v", err)
		return "", err
	}

	question := strings.TrimSpace(response)
	if question == "" {
		return "", fmt.Errorf("empty response from Gemini")
	}

	return question, nil
}
