package controllers

import (
	"arguehub/models"
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func validJudgmentJSON() string {
	opening := `{"user":{"score":8,"reason":"Clear opening"},"bot":{"score":7,"reason":"Relevant opening"}}`
	cross := `{"user":{"score":7,"reason":"Strong response"},"bot":{"score":8,"reason":"Relevant rebuttal"}}`
	answers := `{"user":{"score":9,"reason":"Detailed answer"},"bot":{"score":6,"reason":"Limited detail"}}`
	closing := `{"user":{"score":6,"reason":"Effective summary"},"bot":{"score":7,"reason":"Clear conclusion"}}`

	return fmt.Sprintf(
		`{"opening_statement":%s,"cross_examination":%s,"answers":%s,"closing":%s,"total":{"user":30,"bot":28},"verdict":{"winner":"User"}}`,
		opening,
		cross,
		answers,
		closing,
	)
}

func TestIsValidJudgmentResult(t *testing.T) {
	valid := validJudgmentJSON()

	tests := []struct {
		name   string
		result string
		want   bool
	}{
		{
			name:   "valid judgment",
			result: valid,
			want:   true,
		},
		{
			name:   "empty response",
			result: "",
			want:   false,
		},
		{
			name:   "AI failure message",
			result: "Unable to judge.",
			want:   false,
		},
		{
			name:   "malformed JSON",
			result: `{"opening_statement":`,
			want:   false,
		},
		{
			name:   "missing opening statement",
			result: `{"cross_examination":{},"answers":{},"closing":{},"total":{"user":1,"bot":1},"verdict":{"winner":"User"}}`,
			want:   false,
		},
		{
			name: "missing cross examination",
			result: strings.Replace(
				valid,
				`"cross_examination":{"user":{"score":7,"reason":"Strong response"},"bot":{"score":8,"reason":"Relevant rebuttal"}},`,
				"",
				1,
			),
			want: false,
		},
		{
			name:   "missing winner",
			result: strings.Replace(valid, `"winner":"User"`, `"reason":"No winner"`, 1),
			want:   false,
		},
		{
			name:   "invalid winner",
			result: strings.Replace(valid, `"winner":"User"`, `"winner":"Unknown"`, 1),
			want:   false,
		},
		{
			name:   "missing user score",
			result: strings.Replace(valid, `"score":8,`, "", 1),
			want:   false,
		},
		{
			name:   "missing score reason",
			result: strings.Replace(valid, `"reason":"Clear opening"`, `"reason":""`, 1),
			want:   false,
		},
		{
			name:   "missing total",
			result: strings.Replace(valid, `"total":{"user":30,"bot":28},`, "", 1),
			want:   false,
		},
		{
			name: "score exceeds maximum",
			result: strings.Replace(
				valid,
				`"score":8`,
				`"score":11`,
				1,
			),
			want: false,
		},
		{
			name: "fractional score is valid",
			result: strings.Replace(
				strings.Replace(
					valid,
					`"score":8`,
					`"score":7.5`,
					1,
				),
				`"user":30`,
				`"user":29.5`,
				1,
			),
			want: true,
		},
		{
			name: "inconsistent total",
			result: strings.Replace(
				valid,
				`"user":30`,
				`"user":29`,
				1,
			),
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isValidJudgmentResult(tt.result)
			if got != tt.want {
				t.Errorf(
					"isValidJudgmentResult() = %v, want %v",
					got,
					tt.want,
				)
			}
		})
	}
}

func TestJudgeDebate_InvalidJudgmentReturns502(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalValidate := validateDebateTokenFunc
	originalGetUserID := getDebateUserIDFunc
	originalJudge := judgeDebateFunc
	originalGamification := updateBotDebateGamificationFunc
	originalOutcome := updateBotDebateOutcomeFunc
	originalLatestDebate := getLatestBotDebateFunc
	originalTranscript := saveBotDebateTranscriptFunc

	defer func() {
		validateDebateTokenFunc = originalValidate
		getDebateUserIDFunc = originalGetUserID
		judgeDebateFunc = originalJudge
		updateBotDebateGamificationFunc = originalGamification
		updateBotDebateOutcomeFunc = originalOutcome
		getLatestBotDebateFunc = originalLatestDebate
		saveBotDebateTranscriptFunc = originalTranscript
	}()

	validateDebateTokenFunc = func(
		_, _ string,
		_ *gin.Context,
	) (bool, string, error) {
		return true, "test@example.com", nil
	}

	testUserID := primitive.NewObjectID()
	getDebateUserIDFunc = func(string) (primitive.ObjectID, error) {
		return testUserID, nil
	}

	judgeDebateFunc = func(_ []models.Message) (string, error) {
		return `{"opening_statement":`, nil
	}

	outcomeCalled := false
	updateBotDebateOutcomeFunc = func(_, _ string) error {
		outcomeCalled = true
		return nil
	}

	latestDebateCalled := false
	getLatestBotDebateFunc = func(
		string,
	) (*models.DebateVsBot, error) {
		latestDebateCalled = true
		return &models.DebateVsBot{
			Topic:   "Test topic",
			BotName: "Test bot",
		}, nil
	}

	transcriptCalled := false
	saveBotDebateTranscriptFunc = func(
		_ primitive.ObjectID,
		_, _, _, _, _ string,
		_ []models.Message,
		_ map[string]string,
	) error {
		transcriptCalled = true
		return nil
	}

	gamificationCalled := false
	updateBotDebateGamificationFunc = func(
		_ primitive.ObjectID,
		_, _ string,
	) {
		gamificationCalled = true
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/vsbot/judge",
		bytes.NewBufferString(`{"history":[]}`),
	)
	req.Header.Set("Authorization", "Bearer test-token")
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = req

	JudgeDebate(ctx)

	if recorder.Code != http.StatusBadGateway {
		t.Fatalf(
			"expected HTTP %d, got %d; body: %s",
			http.StatusBadGateway,
			recorder.Code,
			recorder.Body.String(),
		)
	}

	if !strings.Contains(
		recorder.Body.String(),
		"Unable to generate a valid debate judgment",
	) {
		t.Errorf("unexpected response body: %s", recorder.Body.String())
	}

	if outcomeCalled {
		t.Error("outcome must not be persisted when the judgment is invalid")
	}
	if latestDebateCalled {
		t.Error("latest debate must not be fetched when the judgment is invalid")
	}
	if transcriptCalled {
		t.Error("transcript must not be saved when the judgment is invalid")
	}
	if gamificationCalled {
		t.Error("gamification must not run when the judgment is invalid")
	}
}

func TestJudgeDebate_ValidJudgmentReturns200(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalValidate := validateDebateTokenFunc
	originalGetUserID := getDebateUserIDFunc
	originalJudge := judgeDebateFunc
	originalOutcome := updateBotDebateOutcomeFunc
	originalLatestDebate := getLatestBotDebateFunc
	originalTranscript := saveBotDebateTranscriptFunc
	originalGamification := updateBotDebateGamificationFunc

	defer func() {
		validateDebateTokenFunc = originalValidate
		getDebateUserIDFunc = originalGetUserID
		judgeDebateFunc = originalJudge
		updateBotDebateOutcomeFunc = originalOutcome
		getLatestBotDebateFunc = originalLatestDebate
		saveBotDebateTranscriptFunc = originalTranscript
		updateBotDebateGamificationFunc = originalGamification
	}()

	testUserID := primitive.NewObjectID()

	validateDebateTokenFunc = func(
		_, _ string,
		_ *gin.Context,
	) (bool, string, error) {
		return true, "test@example.com", nil
	}

	getDebateUserIDFunc = func(string) (primitive.ObjectID, error) {
		return testUserID, nil
	}

	judgeDebateFunc = func(_ []models.Message) (string, error) {
		return validJudgmentJSON(), nil
	}
	outcomeCalled := false
	updateBotDebateOutcomeFunc = func(_, _ string) error {
		outcomeCalled = true
		return nil
	}

	getLatestBotDebateFunc = func(string) (*models.DebateVsBot, error) {
		return &models.DebateVsBot{
			Topic:   "Test topic",
			BotName: "Test bot",
		}, nil
	}

	transcriptCalled := false
	saveBotDebateTranscriptFunc = func(
		_ primitive.ObjectID,
		_, _, _, _, _ string,
		_ []models.Message,
		_ map[string]string,
	) error {
		transcriptCalled = true
		return nil
	}

	gamificationCalled := false
	updateBotDebateGamificationFunc = func(
		_ primitive.ObjectID,
		_, _ string,
	) {
		gamificationCalled = true
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/vsbot/judge",
		bytes.NewBufferString(`{"history":[]}`),
	)
	req.Header.Set("Authorization", "Bearer test-token")
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = req

	JudgeDebate(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf(
			"expected HTTP %d, got %d; body: %s",
			http.StatusOK,
			recorder.Code,
			recorder.Body.String(),
		)
	}

	if !outcomeCalled {
		t.Error("expected judgment outcome to be persisted")
	}
	if !transcriptCalled {
		t.Error("expected transcript to be saved")
	}
	if !gamificationCalled {
		t.Error("expected gamification to run after a valid judgment")
	}
}

func TestJudgeDebate_OutcomePersistenceFailure(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalValidate := validateDebateTokenFunc
	originalGetUserID := getDebateUserIDFunc
	originalJudge := judgeDebateFunc
	originalOutcome := updateBotDebateOutcomeFunc
	originalLatestDebate := getLatestBotDebateFunc
	originalTranscript := saveBotDebateTranscriptFunc
	originalGamification := updateBotDebateGamificationFunc

	defer func() {
		validateDebateTokenFunc = originalValidate
		getDebateUserIDFunc = originalGetUserID
		judgeDebateFunc = originalJudge
		updateBotDebateOutcomeFunc = originalOutcome
		getLatestBotDebateFunc = originalLatestDebate
		saveBotDebateTranscriptFunc = originalTranscript
		updateBotDebateGamificationFunc = originalGamification
	}()

	testUserID := primitive.NewObjectID()

	validateDebateTokenFunc = func(
		_, _ string,
		_ *gin.Context,
	) (bool, string, error) {
		return true, "test@example.com", nil
	}

	getDebateUserIDFunc = func(string) (primitive.ObjectID, error) {
		return testUserID, nil
	}

	judgeDebateFunc = func(_ []models.Message) (string, error) {
		return validJudgmentJSON(), nil
	}

	outcomeCalled := false
	updateBotDebateOutcomeFunc = func(_, _ string) error {
		outcomeCalled = true
		return fmt.Errorf("simulated database failure")
	}

	latestDebateCalled := false
	getLatestBotDebateFunc = func(
		string,
	) (*models.DebateVsBot, error) {
		latestDebateCalled = true
		return &models.DebateVsBot{
			Topic:   "Test topic",
			BotName: "Test bot",
		}, nil
	}

	transcriptCalled := false
	saveBotDebateTranscriptFunc = func(
		_ primitive.ObjectID,
		_, _, _, _, _ string,
		_ []models.Message,
		_ map[string]string,
	) error {
		transcriptCalled = true
		return nil
	}

	gamificationCalled := false
	updateBotDebateGamificationFunc = func(
		_ primitive.ObjectID,
		_, _ string,
	) {
		gamificationCalled = true
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/vsbot/judge",
		bytes.NewBufferString(`{"history":[]}`),
	)
	req.Header.Set("Authorization", "Bearer test-token")
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = req

	JudgeDebate(ctx)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf(
			"expected HTTP %d, got %d; body: %s",
			http.StatusInternalServerError,
			recorder.Code,
			recorder.Body.String(),
		)
	}

	if !outcomeCalled {
		t.Error("expected outcome persistence to be attempted")
	}
	if latestDebateCalled {
		t.Error("latest debate should not be fetched after outcome persistence fails")
	}
	if transcriptCalled {
		t.Error("transcript must not be saved after outcome persistence fails")
	}
	if gamificationCalled {
		t.Error("gamification must not run after outcome persistence fails")
	}
}
