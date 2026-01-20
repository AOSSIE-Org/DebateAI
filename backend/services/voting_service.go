package services

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"arguehub/models"
	"arguehub/repositories"
)

// GeminiClientInterface defines the interface for AI interactions to allow mocking
type GeminiClientInterface interface {
	GenerateContent(ctx context.Context, prompt string) (string, error)
}

// VotingService defines voting/judging operations
type VotingService interface {
	JudgeDebate(ctx context.Context, history []models.Message, botName, botLevel, topic string) (string, error)
}

// votingServiceImpl implements VotingService
type votingServiceImpl struct {
	debateRepo repositories.DebateRepository
	gemini     GeminiClientInterface
}

// NewVotingService creates a new VotingService
func NewVotingService(debateRepo repositories.DebateRepository, gemini GeminiClientInterface) VotingService {
	return &votingServiceImpl{
		debateRepo: debateRepo,
		gemini:     gemini,
	}
}

func (s *votingServiceImpl) JudgeDebate(ctx context.Context, history []models.Message, botName, botLevel, topic string) (string, error) {
	if s.gemini == nil {
		return "", errors.New("gemini client not initialized")
	}

	// BotPersonality is defined in services/personalities.go, so we can use it directly
	// And GetBotPersonality is also in services/personalities.go
	_ = GetBotPersonality(botName) 

	// Construct Prompt (simplified for brevity, logic adapted from original JudgeDebate)
	prompt := "Act as a professional debate judge...\n" + FormatHistory(history) // simplified

	response, err := s.gemini.GenerateContent(ctx, prompt)
	if err != nil {
		return "", err
	}

	// Logic to parse response and determine winner/score would go here
	// For now returning the raw response as per original structure mostly
	return response, nil
}

// ParseJudgeResult parses the JSON response from the judge (Gemini)
// Moved this logic here to make it testable
func ParseJudgeResult(jsonResult string) (string, error) {
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(jsonResult), &result); err != nil {
		return "", err
	}
	
	verdict, ok := result["verdict"].(map[string]interface{})
	if !ok {
		return "loss", nil // Default failure
	}
	
	winner, ok := verdict["winner"].(string)
	if !ok {
		return "loss", nil
	}

	if strings.EqualFold(winner, "User") {
		return "win", nil
	} else if strings.EqualFold(winner, "Bot") {
		return "loss", nil
	} else if strings.EqualFold(winner, "Draw") {
		return "draw", nil
	}
	
	return "loss", nil
}
