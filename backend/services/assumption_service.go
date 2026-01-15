package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// AssumptionResponse represents the AI's response structure for assumptions
type AssumptionResponse struct {
	Side             string   `json:"side"`
	ParticipantEmail string   `json:"participantEmail"`
	ParticipantID    string   `json:"participantId,omitempty"`
	Assumptions      []string `json:"assumptions"`
}

// ExtractAssumptions extracts implicit assumptions from a debate transcript using AI
func ExtractAssumptions(roomID string) ([]models.DebateAssumption, error) {
	ctx := context.Background()

	// Check if Gemini client is available
	if geminiClient == nil {
		return nil, errors.New("AI service not available - Gemini client not initialized")
	}

	// Check if assumptions already exist for this debate
	collection := db.GetCollection("debateAssumptions")
	var existingAssumptions []models.DebateAssumption
	cursor, err := collection.Find(ctx, bson.M{"debateId": roomID})
	if err == nil {
		defer cursor.Close(ctx)
		if err := cursor.All(ctx, &existingAssumptions); err == nil && len(existingAssumptions) > 0 {
			log.Printf("✅ Returning cached assumptions for debate %s", roomID)
			return existingAssumptions, nil
		}
	}

	// Aggregate debate transcript
	transcript, err := aggregateDebateTranscript(ctx, roomID)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate transcript: %w", err)
	}

	if transcript == "" {
		return nil, errors.New("no transcript found for this debate")
	}

	// Construct AI prompt for assumption extraction
	prompt := buildAssumptionPrompt(transcript)

	// Call Gemini API
	log.Printf("🤖 Extracting assumptions for debate %s using Gemini AI", roomID)
	response, err := generateDefaultModelText(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("AI extraction failed: %w", err)
	}

	// Parse AI response
	assumptions, err := parseAssumptionResponse(response, roomID)
	if err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w", err)
	}

	// Save to database
	if len(assumptions) > 0 {
		err = saveAssumptions(ctx, collection, assumptions)
		if err != nil {
			log.Printf("⚠️  Warning: Failed to save assumptions to database: %v", err)
			// Don't fail the request, just log the warning
		}
	}

	log.Printf("✅ Successfully extracted %d assumption groups for debate %s", len(assumptions), roomID)
	return assumptions, nil
}

// aggregateDebateTranscript retrieves and combines all messages from a debate
func aggregateDebateTranscript(ctx context.Context, debateID string) (string, error) {
	log.Printf("📋 Attempting to aggregate transcript for ID: %s", debateID)

	// Try to convert debateID to ObjectID - it might be a SavedDebateTranscript ID
	savedCollection := db.GetCollection("savedDebateTranscripts")
	objID, err := primitive.ObjectIDFromHex(debateID)

	if err == nil {
		log.Printf("🔍 Valid ObjectID detected, searching SavedDebateTranscript by ID")
		// It's a valid ObjectID, try to find SavedDebateTranscript by ID
		var savedTranscript models.SavedDebateTranscript
		err := savedCollection.FindOne(ctx, bson.M{"_id": objID}).Decode(&savedTranscript)
		if err == nil {
			log.Printf("✅ Found SavedDebateTranscript - Messages: %d, Transcripts: %d",
				len(savedTranscript.Messages), len(savedTranscript.Transcripts))

			// Check if it has transcript sections (user vs user debates)
			if len(savedTranscript.Transcripts) > 0 {
				log.Printf("✅ Using Transcripts field (user vs user format)")
				return buildTranscriptFromTranscriptMap(savedTranscript.Transcripts), nil
			}

			// Check if it has messages (bot debates or other formats)
			if len(savedTranscript.Messages) > 0 {
				log.Printf("✅ Using Messages field")
				return buildTranscriptFromMessages(savedTranscript.Messages), nil
			}

			// If SavedDebateTranscript exists but has no content, create a fallback
			log.Printf("⚠️  SavedDebateTranscript found but has no content - using metadata as fallback")
			fallbackTranscript := fmt.Sprintf(`
=== DEBATE SUMMARY ===

Topic: %s
Debate Type: %s
Opponent: %s
Result: %s

[This debate record exists but detailed transcript content is not available.
The system will analyze based on the available metadata.]
`, savedTranscript.Topic, savedTranscript.DebateType, savedTranscript.Opponent, savedTranscript.Result)

			return fallbackTranscript, nil
		} else {
			log.Printf("⚠️  SavedDebateTranscript not found by ID: %v", err)
		}
	} else {
		log.Printf("🔍 Not a valid ObjectID, will try as roomID")
	}

	// Not an ObjectID or not found - try as roomID in DebateTranscript collection
	log.Printf("🔍 Searching DebateTranscript collection by roomId")
	transcriptCollection := db.GetCollection("debateTranscripts")
	cursor, err := transcriptCollection.Find(ctx, bson.M{"roomId": debateID})
	if err != nil && err != mongo.ErrNoDocuments {
		return "", err
	}

	var transcripts []models.DebateTranscript
	if cursor != nil {
		defer cursor.Close(ctx)
		if err := cursor.All(ctx, &transcripts); err == nil && len(transcripts) > 0 {
			log.Printf("✅ Found %d DebateTranscript records by roomId", len(transcripts))
			return buildTranscriptFromDebateTranscripts(transcripts), nil
		}
	}

	log.Printf("❌ No transcript found for ID: %s", debateID)
	return "", errors.New("no transcript found")
}

// buildTranscriptFromDebateTranscripts builds a formatted transcript from DebateTranscript records
func buildTranscriptFromDebateTranscripts(transcripts []models.DebateTranscript) string {
	var builder strings.Builder

	sections := []string{"opening", "constructive argument", "rebuttal", "closing"}

	for _, section := range sections {
		builder.WriteString(fmt.Sprintf("\n=== %s ===\n", strings.ToUpper(section)))

		for _, t := range transcripts {
			if content, ok := t.Transcripts[section]; ok && content != "" {
				builder.WriteString(fmt.Sprintf("\n[%s - %s]:\n%s\n", t.Role, t.Email, content))
			}
		}
	}

	return builder.String()
}

// buildTranscriptFromTranscriptMap builds a formatted transcript from a transcript map (SavedDebateTranscript.Transcripts)
func buildTranscriptFromTranscriptMap(transcripts map[string]string) string {
	var builder strings.Builder

	sections := []string{"opening", "constructive argument", "rebuttal", "closing"}

	for _, section := range sections {
		if content, ok := transcripts[section]; ok && content != "" {
			builder.WriteString(fmt.Sprintf("\n=== %s ===\n", strings.ToUpper(section)))
			builder.WriteString(fmt.Sprintf("%s\n", content))
		}
	}

	return builder.String()
}

// buildTranscriptFromMessages builds a formatted transcript from Message records
func buildTranscriptFromMessages(messages []models.Message) string {
	var builder strings.Builder

	builder.WriteString("\n=== DEBATE TRANSCRIPT ===\n")

	for _, msg := range messages {
		// Skip system messages or judge messages
		if msg.Sender == "system" || msg.Sender == "judge" || msg.Sender == "Judge" {
			continue
		}

		builder.WriteString(fmt.Sprintf("\n[%s]:\n%s\n", msg.Sender, msg.Text))
	}

	return builder.String()
}

// buildAssumptionPrompt creates the AI prompt for extracting assumptions
func buildAssumptionPrompt(transcript string) string {
	return fmt.Sprintf(`You are an expert debate analyst. Analyze the following debate transcript and identify implicit assumptions made by each participant.

Implicit assumptions are unstated premises such as:
- Value judgments (e.g., "freedom is more important than security")
- Causal beliefs (e.g., "this policy will lead to that outcome")
- Generalizations (e.g., "people always behave this way")
- Underlying worldviews or ideological positions

For each participant, list their assumptions clearly and neutrally without evaluating their truth or validity.

IMPORTANT: Return your response as a valid JSON array with this exact structure:
[
  {
    "side": "for",
    "participantEmail": "user@example.com",
    "assumptions": ["assumption 1", "assumption 2", "assumption 3"]
  },
  {
    "side": "against",
    "participantEmail": "opponent@example.com",
    "assumptions": ["assumption 1", "assumption 2"]
  }
]

Use "for" and "against" as the side values. List 3-5 key assumptions per participant if possible.

Debate Transcript:
%s`, transcript)
}

// parseAssumptionResponse parses the AI response into structured data
func parseAssumptionResponse(response string, roomID string) ([]models.DebateAssumption, error) {
	// Clean the response
	response = cleanModelOutput(response)

	// Parse JSON
	var aiResponses []AssumptionResponse
	err := json.Unmarshal([]byte(response), &aiResponses)
	if err != nil {
		log.Printf("⚠️  Failed to parse AI response as JSON: %v", err)
		log.Printf("Raw response: %s", response)
		return nil, fmt.Errorf("invalid AI response format: %w", err)
	}

	// Convert to DebateAssumption models
	var assumptions []models.DebateAssumption
	now := time.Now()

	for _, aiResp := range aiResponses {
		if len(aiResp.Assumptions) == 0 {
			continue // Skip empty assumption lists
		}

		assumption := models.DebateAssumption{
			ID:               primitive.NewObjectID(),
			DebateID:         roomID,
			ParticipantID:    aiResp.ParticipantID,
			ParticipantEmail: aiResp.ParticipantEmail,
			Side:             aiResp.Side,
			Assumptions:      aiResp.Assumptions,
			CreatedAt:        now,
		}
		assumptions = append(assumptions, assumption)
	}

	return assumptions, nil
}

// saveAssumptions saves extracted assumptions to the database
func saveAssumptions(ctx context.Context, collection *mongo.Collection, assumptions []models.DebateAssumption) error {
	if len(assumptions) == 0 {
		return nil
	}

	// Convert to interface slice for bulk insert
	docs := make([]interface{}, len(assumptions))
	for i, a := range assumptions {
		docs[i] = a
	}

	_, err := collection.InsertMany(ctx, docs)
	if err != nil {
		return fmt.Errorf("failed to insert assumptions: %w", err)
	}

	log.Printf("💾 Saved %d assumption groups to database", len(assumptions))
	return nil
}
