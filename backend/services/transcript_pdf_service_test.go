package services

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"arguehub/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestGenerateTranscriptPDF_ValidTranscript(t *testing.T) {
	transcript := &models.SavedDebateTranscript{
		ID:         primitive.NewObjectID(),
		UserID:     primitive.NewObjectID(),
		Email:      "user@example.com",
		DebateType: "user_vs_bot",
		Topic:      "Should AI Be Regulated Globally?",
		Opponent:   "Expert Emma",
		Result:     "win",
		Messages: []models.Message{
			{Sender: "User", Text: "AI regulation is essential for safe deployment.", Phase: "Opening"},
			{Sender: "Bot", Text: "Strict regulations might impede innovation.", Phase: "Opening"},
			{Sender: "User", Text: "Safety outweighs minor delays in innovation.", Phase: "Closing"},
			{Sender: "Judge", Text: "User presented stronger evidence. User wins.", Phase: "Verdict"},
		},
		Transcripts: map[string]string{
			"openingFor":     "AI regulation is essential for safe deployment.",
			"openingAgainst": "Strict regulations might impede innovation.",
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	pdfBytes, err := GenerateTranscriptPDF(transcript)
	if err != nil {
		t.Fatalf("GenerateTranscriptPDF returned unexpected error: %v", err)
	}

	if len(pdfBytes) == 0 {
		t.Fatal("GenerateTranscriptPDF returned empty byte slice")
	}

	// Verify PDF magic header bytes "%PDF-"
	if !bytes.HasPrefix(pdfBytes, []byte("%PDF-")) {
		t.Errorf("Generated data does not have valid PDF header prefix: %s", string(pdfBytes[:10]))
	}
}

func TestGenerateTranscriptPDF_MinimalTranscript(t *testing.T) {
	transcript := &models.SavedDebateTranscript{
		ID:         primitive.NewObjectID(),
		UserID:     primitive.NewObjectID(),
		Email:      "test@example.com",
		DebateType: "user_vs_user",
		Topic:      "Universal Basic Income",
		Opponent:   "opponent@example.com",
		Result:     "draw",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	pdfBytes, err := GenerateTranscriptPDF(transcript)
	if err != nil {
		t.Fatalf("GenerateTranscriptPDF returned error for minimal transcript: %v", err)
	}

	if len(pdfBytes) == 0 {
		t.Fatal("GenerateTranscriptPDF returned empty byte slice for minimal transcript")
	}

	if !bytes.HasPrefix(pdfBytes, []byte("%PDF-")) {
		t.Errorf("Generated data does not have valid PDF header prefix")
	}
}

func TestFormatDebateType(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"user_vs_bot", "User vs Bot"},
		{"user_vs_user", "User vs User"},
		{"custom_type", "custom_type"},
	}

	for _, tt := range tests {
		got := formatDebateType(tt.input)
		if got != tt.expected {
			t.Errorf("formatDebateType(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}

func TestFormatPhaseName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"openingFor", "Opening For"},
		{"crossAgainstAnswer", "Cross Against Answer"},
		{"closing", "Closing"},
	}

	for _, tt := range tests {
		got := formatPhaseName(tt.input)
		if got != tt.expected {
			t.Errorf("formatPhaseName(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}

func TestSanitizeText(t *testing.T) {
	input := "Hello\r\nWorld! Smart quotes: \u201cquotes\u201d & accents."
	sanitized := sanitizeText(input)

	if bytes.Contains([]byte(sanitized), []byte("\r")) {
		t.Errorf("sanitizeText did not remove carriage returns: %q", sanitized)
	}

	// Smart quotes (\u201c, \u201d) should be mapped to ASCII double quotes
	if !strings.Contains(sanitized, "\"quotes\"") {
		t.Errorf("sanitizeText did not map smart quotes to ASCII: %q", sanitized)
	}
}

func TestSortPhases(t *testing.T) {
	transcripts := map[string]string{
		"closingAgainst": "Text 1",
		"openingFor":     "Text 2",
		"customPhase":    "Text 3",
		"openingAgainst": "Text 4",
	}

	sorted := sortPhases(transcripts)

	if len(sorted) != 4 {
		t.Fatalf("sortPhases returned slice of length %d; want 4", len(sorted))
	}

	// openingFor and openingAgainst should come before closingAgainst and customPhase
	if sorted[0] != "openingFor" || sorted[1] != "openingAgainst" {
		t.Errorf("sortPhases order incorrect: %v", sorted)
	}
}
