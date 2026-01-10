package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"arguehub/config"
	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var personalityGPT *ChatGPT

func InitPersonalityService(cfg *config.Config) {
	personalityGPT = NewChatGPT(cfg.Openai.GptApiKey)
}

func GeneratePersonalityProfiles(debateID string) ([]models.PersonalityProfile, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(debateID)
	if err != nil {
		return nil, fmt.Errorf("invalid debate ID: %v", err)
	}

	collection := db.MongoDatabase.Collection("saved_debate_transcripts")
	var debate models.SavedDebateTranscript
	err = collection.FindOne(ctx, bson.M{"_id": objID}).Decode(&debate)
	if err != nil {
		return nil, fmt.Errorf("debate not found: %v", err)
	}

	if debate.Result == "pending" {
		return nil, errors.New("debate is not yet completed")
	}

	// Group messages by participant
	participants := make(map[string]string)

	if debate.DebateType == "user_vs_bot" {
		for _, msg := range debate.Messages {
			sender := msg.Sender
			if sender == "" {
				continue
			}
			participants[sender] += msg.Text + "\n"
		}
	} else {
		// User vs User
		// Map phases to participants (For/Against)
		for phase, text := range debate.Transcripts {
			participant := "Opponent"
			if strings.Contains(strings.ToLower(phase), "for") {
				participant = "User"
			}
			// Note: This is an approximation since we don't know who is 'For' and who is 'Against'
			// without checking the UserID vs the transcript's email.
			// But for personality analysis, we just need to group the text.
			// However, Transcript model has Role if it was submitted individually...
			// In SavedDebateTranscript, it seems it's merged.
			participants[participant] += text + "\n"
		}
	}

	if len(participants) == 0 {
		return nil, errors.New("no transcript found for participants")
	}

	var profiles []models.PersonalityProfile
	profileCollection := db.MongoDatabase.Collection("personality_profiles")

	for name, transcript := range participants {
		if strings.TrimSpace(transcript) == "" {
			continue
		}

		profile, err := analyzeParticipantPersonality(name, transcript)
		if err != nil {
			continue // Skip failed analysis for one participant
		}

		profile.DebateID = objID
		profile.ParticipantID = name
		if name == "User" {
			profile.ParticipantID = debate.Email
		} else if name == "Bot" || name == "Opponent" {
			profile.ParticipantID = debate.Opponent
		}
		profile.CreatedAt = time.Now()

		_, err = profileCollection.InsertOne(ctx, profile)
		if err != nil {
			return nil, fmt.Errorf("failed to save profile: %v", err)
		}
		profiles = append(profiles, *profile)
	}

	return profiles, nil
}

func analyzeParticipantPersonality(name, transcript string) (*models.PersonalityProfile, error) {
	developerPrompt := `You are an expert debate coach and communication analyst.

Analyze the following debate transcript written by ONE participant.

Evaluate the participant on:
- Argument style (analytical / emotional / mixed)
- Tone (calm / assertive / aggressive)
- Evidence usage (0-10)
- Clarity (0-10)
- Responsiveness to opponent (0-10)

Return ONLY valid JSON in the following format:

{
  "argument_style": "",
  "tone": "",
  "evidence_usage": 0,
  "clarity": 0,
  "responsiveness": 0,
  "summary": ""
}

⚠️ No markdown
⚠️ No explanations
⚠️ No extra fields`

	userMessage := fmt.Sprintf("Transcript:\n%s", transcript)

	response, err := personalityGPT.Chat("gpt-4o-mini-2024-07-18", developerPrompt, userMessage)
	if err != nil {
		return nil, err
	}

	// Clean JSON response (strip markdown fences if any)
	cleanResponse := strings.TrimSpace(response)
	cleanResponse = strings.TrimPrefix(cleanResponse, "```json")
	cleanResponse = strings.TrimPrefix(cleanResponse, "```")
	cleanResponse = strings.TrimSuffix(cleanResponse, "```")
	cleanResponse = strings.TrimSpace(cleanResponse)

	var profile models.PersonalityProfile
	err = json.Unmarshal([]byte(cleanResponse), &profile)
	if err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %v", err)
	}

	return &profile, nil
}

func GetPersonalityProfiles(debateID string) ([]models.PersonalityProfile, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(debateID)
	if err != nil {
		return nil, err
	}

	collection := db.MongoDatabase.Collection("personality_profiles")
	cursor, err := collection.Find(ctx, bson.M{"debateId": objID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var profiles []models.PersonalityProfile
	if err = cursor.All(ctx, &profiles); err != nil {
		return nil, err
	}

	return profiles, nil
}
