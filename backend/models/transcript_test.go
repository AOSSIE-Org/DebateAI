package models

import (
	"encoding/json"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestSavedDebateTranscript_EloChangeSerialization(t *testing.T) {
	id := primitive.NewObjectID()
	userID := primitive.NewObjectID()
	now := time.Now().Truncate(time.Millisecond)

	transcript := SavedDebateTranscript{
		ID:         id,
		UserID:     userID,
		Email:      "test@example.com",
		DebateType: "user_vs_user",
		Topic:      "AI Alignment",
		Opponent:   "opponent@example.com",
		Result:     "win",
		EloChange:  15.4,
		Messages: []Message{
			{Sender: "User", Text: "Hello", Phase: "Opening"},
		},
		Transcripts: map[string]string{
			"for": "User transcript",
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Test JSON serialization & deserialization
	data, err := json.Marshal(transcript)
	if err != nil {
		t.Fatalf("Failed to marshal SavedDebateTranscript to JSON: %v", err)
	}

	var jsonResult map[string]interface{}
	if err := json.Unmarshal(data, &jsonResult); err != nil {
		t.Fatalf("Failed to unmarshal SavedDebateTranscript from JSON: %v", err)
	}

	eloVal, ok := jsonResult["eloChange"]
	if !ok {
		t.Fatalf("Expected eloChange key in JSON output, got: %s", string(data))
	}
	if eloVal.(float64) != 15.4 {
		t.Errorf("Expected eloChange to be 15.4 in JSON, got %v", eloVal)
	}

	// Test BSON serialization & deserialization
	bsonData, err := bson.Marshal(transcript)
	if err != nil {
		t.Fatalf("Failed to marshal SavedDebateTranscript to BSON: %v", err)
	}

	var bsonResult SavedDebateTranscript
	if err := bson.Unmarshal(bsonData, &bsonResult); err != nil {
		t.Fatalf("Failed to unmarshal SavedDebateTranscript from BSON: %v", err)
	}

	if bsonResult.EloChange != 15.4 {
		t.Errorf("Expected EloChange to be 15.4 in BSON, got %v", bsonResult.EloChange)
	}
}

func TestSavedDebateTranscript_NegativeEloChange(t *testing.T) {
	transcript := SavedDebateTranscript{
		Topic:     "Topic B",
		Result:    "loss",
		EloChange: -18.7,
	}

	data, err := json.Marshal(transcript)
	if err != nil {
		t.Fatalf("Failed to marshal SavedDebateTranscript to JSON: %v", err)
	}

	var jsonResult map[string]interface{}
	if err := json.Unmarshal(data, &jsonResult); err != nil {
		t.Fatalf("Failed to unmarshal SavedDebateTranscript from JSON: %v", err)
	}

	eloVal, ok := jsonResult["eloChange"]
	if !ok {
		t.Fatalf("Expected eloChange key in JSON output, got: %s", string(data))
	}
	if eloVal.(float64) != -18.7 {
		t.Errorf("Expected eloChange to be -18.7 in JSON, got %v", eloVal)
	}
}
