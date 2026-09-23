package services

import (
	"context"
	"testing"

	"arguehub/db"
	"arguehub/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestParseReportJSON(t *testing.T) {
	rawJSON := `{
		"overall_scores": {
			"persuasion": 88,
			"clarity": 92,
			"rebuttal_effectiveness": 85
		},
		"argument_breakdown": [
			{
				"statement": "Renewable energy lowers carbon emissions drastically.",
				"tag": "Strong",
				"reason": "Clear empirical backing provided."
			},
			{
				"statement": "Everyone agrees fossil fuels are bad.",
				"tag": "Weak",
				"reason": "Bandwagon fallacy without evidence."
			}
		],
		"fallacy_flags": [
			{
				"statement": "Everyone agrees fossil fuels are bad.",
				"fallacy_type": "Bandwagon Fallacy (Ad Populum)",
				"explanation": "Appeals to popular consensus instead of presenting data."
			}
		],
		"improvement_tips": [
			"Cite numerical solar transition studies.",
			"Counter the grid reliability argument directly."
		]
	}`

	report, err := ParseReportJSON(rawJSON)
	if err != nil {
		t.Fatalf("Expected successful parse, got error: %v", err)
	}

	if report.OverallScores.Persuasion != 88 {
		t.Errorf("Expected persuasion 88, got %d", report.OverallScores.Persuasion)
	}
	if report.OverallScores.Clarity != 92 {
		t.Errorf("Expected clarity 92, got %d", report.OverallScores.Clarity)
	}
	if report.OverallScores.RebuttalEffectiveness != 85 {
		t.Errorf("Expected rebuttal 85, got %d", report.OverallScores.RebuttalEffectiveness)
	}
	if len(report.ArgumentBreakdown) != 2 {
		t.Errorf("Expected 2 argument items, got %d", len(report.ArgumentBreakdown))
	}
	if len(report.FallacyFlags) != 1 {
		t.Errorf("Expected 1 fallacy flag, got %d", len(report.FallacyFlags))
	}
	if len(report.ImprovementTips) != 2 {
		t.Errorf("Expected 2 improvement tips, got %d", len(report.ImprovementTips))
	}
}

func TestGenerateOrGetPerformanceReport_MockAndCache(t *testing.T) {
	// Setup MongoDB connection if available
	_ = db.ConnectMongoDB("mongodb://localhost:27017/debateai")

	llmCallCount := 0
	mockLLM := func(ctx context.Context, prompt string) (string, error) {
		llmCallCount++
		return `{
			"overall_scores": {
				"persuasion": 80,
				"clarity": 85,
				"rebuttal_effectiveness": 75
			},
			"argument_breakdown": [
				{
					"statement": "AI increases productivity across sectors.",
					"tag": "Strong",
					"reason": "Well-supported premise."
				}
			],
			"fallacy_flags": [],
			"improvement_tips": [
				"Provide specific labor displacement mitigation strategies.",
				"Deepen ethical governance arguments."
			]
		}`, nil
	}

	SetLLMGenerator(mockLLM)
	defer ResetLLMGenerator()

	ctx := context.Background()
	debateID := "test-debate-" + primitive.NewObjectID().Hex()
	userID := primitive.NewObjectID()

	req := models.PerformanceReportRequest{
		DebateID: debateID,
		Topic:    "Should AI be regulated?",
		Stance:   "For",
		Messages: []models.Message{
			{Sender: "User", Text: "AI needs sensible regulatory frameworks.", Phase: "Opening"},
			{Sender: "Bot", Text: "Regulation stifles innovation.", Phase: "Rebuttal"},
		},
	}

	// First call should invoke LLM
	report1, err := GenerateOrGetPerformanceReport(ctx, req, userID, "test@example.com")
	if err != nil {
		t.Fatalf("GenerateOrGetPerformanceReport failed: %v", err)
	}
	if report1 == nil {
		t.Fatalf("Expected non-nil report")
	}
	if report1.OverallScores.Persuasion != 80 {
		t.Errorf("Expected persuasion 80, got %d", report1.OverallScores.Persuasion)
	}
	if llmCallCount != 1 {
		t.Errorf("Expected LLM call count 1 on first invocation, got %d", llmCallCount)
	}

	// Second call with same debateID should hit cache and NOT invoke LLM again
	report2, err := GenerateOrGetPerformanceReport(ctx, req, userID, "test@example.com")
	if err != nil {
		t.Fatalf("Second call failed: %v", err)
	}
	if report2 == nil {
		t.Fatalf("Expected non-nil cached report")
	}
	if report2.OverallScores.Persuasion != 80 {
		t.Errorf("Expected cached persuasion 80, got %d", report2.OverallScores.Persuasion)
	}
	if llmCallCount != 1 {
		t.Errorf("Expected LLM call count to remain 1 (cache hit), got %d", llmCallCount)
	}
}

func TestGenerateOrGetPerformanceReport_RetryAndFallback(t *testing.T) {
	// Test retry logic: first output bad JSON, retry outputs good JSON
	callCount := 0
	mockLLMWithRetry := func(ctx context.Context, prompt string) (string, error) {
		callCount++
		if callCount == 1 {
			return "I cannot generate valid json sorry", nil
		}
		return `{
			"overall_scores": {
				"persuasion": 78,
				"clarity": 82,
				"rebuttal_effectiveness": 74
			},
			"argument_breakdown": [],
			"fallacy_flags": [],
			"improvement_tips": ["Tip 1", "Tip 2"]
		}`, nil
	}

	SetLLMGenerator(mockLLMWithRetry)
	defer ResetLLMGenerator()

	ctx := context.Background()
	debateID := "test-retry-" + primitive.NewObjectID().Hex()

	req := models.PerformanceReportRequest{
		DebateID: debateID,
		Topic:    "Universal Basic Income",
		Stance:   "Against",
		Messages: []models.Message{
			{Sender: "User", Text: "UBI causes hyperinflation and labor disincentives.", Phase: "Opening"},
		},
	}

	report, err := GenerateOrGetPerformanceReport(ctx, req, primitive.NilObjectID, "user@test.com")
	if err != nil {
		t.Fatalf("Expected report generation with retry, got err: %v", err)
	}
	if report.OverallScores.Persuasion != 78 {
		t.Errorf("Expected 78 persuasion from retried response, got %d", report.OverallScores.Persuasion)
	}
	if callCount != 2 {
		t.Errorf("Expected exactly 2 LLM calls (1 initial + 1 retry), got %d", callCount)
	}
}

func TestBuildFallbackPerformanceReport(t *testing.T) {
	fallback := BuildFallbackPerformanceReport("Climate Action", "For", "We must reduce carbon emissions immediately through solar and wind.")
	if fallback == nil {
		t.Fatal("Expected non-nil fallback report")
	}
	if !fallback.IsFallback {
		t.Error("Expected IsFallback to be true")
	}
	if fallback.OverallScores.Persuasion <= 0 {
		t.Error("Expected non-zero persuasion score in fallback")
	}
	if len(fallback.ImprovementTips) == 0 {
		t.Error("Expected fallback improvement tips")
	}
}
