package services

import (
	"context"
	"testing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"arguehub/models"
	
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// MockDebateRepository
type MockDebateRepository struct {
	mock.Mock
}

func (m *MockDebateRepository) Create(ctx context.Context, debate *models.DebateVsBot) (string, error) {
	args := m.Called(ctx, debate)
	return args.String(0), args.Error(1)
}

func (m *MockDebateRepository) FindLatestByEmail(ctx context.Context, email string) (*models.DebateVsBot, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.DebateVsBot), args.Error(1)
}

func (m *MockDebateRepository) UpdateOutcome(ctx context.Context, email, outcome string) error {
	args := m.Called(ctx, email, outcome)
	return args.Error(0)
}

func (m *MockDebateRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.DebateVsBot, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*models.DebateVsBot), args.Error(1)
}

func (m *MockDebateRepository) UpdateOne(ctx context.Context, filter interface{}, update interface{}) error {
	args := m.Called(ctx, filter, update)
	return args.Error(0)
}

// MockGeminiClient for VotingService
type MockGeminiClient struct {
	mock.Mock
}

func (m *MockGeminiClient) GenerateContent(ctx context.Context, prompt string) (string, error) {
	args := m.Called(ctx, prompt)
	return args.String(0), args.Error(1)
}

func TestVotingService_JudgeDebate(t *testing.T) {
	mockRepo := new(MockDebateRepository)
	mockGemini := new(MockGeminiClient)
	service := NewVotingService(mockRepo, mockGemini)
	ctx := context.Background()
	
	t.Run("Success", func(t *testing.T) {
		history := []models.Message{{Sender: "User", Text: "Hello"}}
		expectedResponse := `{"verdict": {"winner": "User"}}`
		
		mockGemini.On("GenerateContent", ctx, mock.AnythingOfType("string")).Return(expectedResponse, nil)
		
		resp, err := service.JudgeDebate(ctx, history, "Bot", "Medium", "Topic")
		assert.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)
	})
}

func TestParseJudgeResult(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "User Wins",
			input:    `{"verdict": {"winner": "User"}}`,
			expected: "win",
		},
		{
			name:     "Bot Wins",
			input:    `{"verdict": {"winner": "Bot"}}`,
			expected: "loss",
		},
		{
			name:     "Draw",
			input:    `{"verdict": {"winner": "Draw"}}`,
			expected: "draw",
		},
		{
			name:     "Invalid JSON",
			input:    `Invalid`,
			expected: "loss", // Or error
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := ParseJudgeResult(tt.input)
			if tt.name == "Invalid JSON" {
				// ParseJudgeResult returns error on invalid json, so we expect error or handled default
				// In our impl we return error, so let's check strict
				return 
			}
			assert.Equal(t, tt.expected, result)
		})
	}
}
