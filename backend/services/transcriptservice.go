package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"

	"github.com/google/generative-ai-go/genai"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

func SubmitTranscripts(roomID, role string, transcripts map[string]string) (map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Collections
	transcriptCollection := db.MongoDatabase.Collection("debate_transcripts")
	resultCollection := db.MongoDatabase.Collection("debate_results")

	// Check if a judgment result already exists for this room
	var existingResult models.DebateResult
	err := resultCollection.FindOne(ctx, bson.M{"roomId": roomID}).Decode(&existingResult)
	if err == nil {
		// Judgment already exists, return it
		return map[string]interface{}{
			"message": "Debate already judged",
			"result":  existingResult.Result,
		}, nil
	}
	if err != mongo.ErrNoDocuments {
		return nil, errors.New("failed to check existing result: " + err.Error())
	}

	// No judgment exists yet, proceed with transcript submission
	filter := bson.M{"roomId": roomID, "role": role}
	var existingTranscript models.DebateTranscript
	err = transcriptCollection.FindOne(ctx, filter).Decode(&existingTranscript)
	if err != nil && err != mongo.ErrNoDocuments {
		return nil, errors.New("failed to check existing submission: " + err.Error())
	}

	if err == nil {
		// Update existing submission
		update := bson.M{
			"$set": bson.M{
				"transcripts": transcripts,
				"updatedAt":   time.Now(),
			},
		}
		_, err = transcriptCollection.UpdateOne(ctx, filter, update)
		if err != nil {
			return nil, errors.New("failed to update submission: " + err.Error())
		}
	} else {
		// Insert new submission
		doc := models.DebateTranscript{
			RoomID:      roomID,
			Role:        role,
			Transcripts: transcripts,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
		_, err = transcriptCollection.InsertOne(ctx, doc)
		if err != nil {
			return nil, errors.New("failed to insert submission: " + err.Error())
		}
	}

	// Check if both sides have submitted
	var forSubmission, againstSubmission models.DebateTranscript
	errFor := transcriptCollection.FindOne(ctx, bson.M{"roomId": roomID, "role": "for"}).Decode(&forSubmission)
	errAgainst := transcriptCollection.FindOne(ctx, bson.M{"roomId": roomID, "role": "against"}).Decode(&againstSubmission)

	if errFor == nil && errAgainst == nil {
		// Both submissions exist, compute judgment once
		merged := mergeTranscripts(forSubmission.Transcripts, againstSubmission.Transcripts)
		result := JudgeDebateHumanVsHuman(merged)

		// Store the result
		resultDoc := models.DebateResult{
			RoomID:    roomID,
			Result:    result,
			CreatedAt: time.Now(),
		}
		_, err = resultCollection.InsertOne(ctx, resultDoc)
		if err != nil {
			log.Printf("Failed to store debate result: %v", err)
			return nil, errors.New("failed to store debate result: " + err.Error())
		}

		// Clean up transcripts (optional)
		_, err = transcriptCollection.DeleteMany(ctx, bson.M{"roomId": roomID})
		if err != nil {
			log.Printf("Failed to clean up transcripts: %v", err)
		}

		return map[string]interface{}{
			"message": "Debate judged",
			"result":  result,
		}, nil
	}

	// If only one side has submitted, return a waiting message
	return map[string]interface{}{
		"message": "Waiting for opponent submission",
	}, nil
}

// mergeTranscripts and JudgeDebateHumanVsHuman remain unchanged
func mergeTranscripts(forTranscripts, againstTranscripts map[string]string) map[string]string {
	merged := make(map[string]string)
	for phase, transcript := range forTranscripts {
		merged[phase] = transcript
	}
	for phase, transcript := range againstTranscripts {
		merged[phase] = transcript
	}
	return merged
}

func JudgeDebateHumanVsHuman(merged map[string]string) string {
	if geminiClient == nil {
		log.Println("Gemini client not initialized")
		return "Unable to judge."
	}

	var transcript strings.Builder
	phaseOrder := []string{
		"openingFor", "openingAgainst",
		"crossForQuestion", "crossAgainstAnswer",
		"crossAgainstQuestion", "crossForAnswer",
		"closingFor", "closingAgainst",
	}
	for _, phase := range phaseOrder {
		if text, exists := merged[phase]; exists && text != "" {
			role := "For"
			if strings.Contains(phase, "Against") {
				role = "Against"
			}
			transcript.WriteString(fmt.Sprintf("%s (%s): %s\n", role, phase, text))
		}
	}

	prompt := fmt.Sprintf(
		`Act as a professional debate judge. Analyze the following human-vs-human debate transcript and provide scores in STRICT JSON format:

Judgment Criteria:
1. Opening Statement (10 points):
   - Strength of opening: Clarity of position, persuasiveness
   - Quality of reasoning: Validity, relevance, logical flow
   - Diction/Expression: Language proficiency, articulation

2. Cross Examination Questions (10 points):
   - Validity and relevance to core issues
   - Demonstration of high-order thinking
   - Creativity/Originality ("out-of-the-box" nature)

3. Answers to Cross Examination (10 points):
   - Precision and directness (avoids evasion)
   - Logical coherence
   - Effectiveness in addressing the question

4. Closing Statements (10 points):
   - Comprehensive summary of key points
   - Effective reiteration of stance
   - Persuasiveness of final argument

Required Output Format:
{
  "opening_statement": {
    "for": {"score": X, "reason": "text"},
    "against": {"score": Y, "reason": "text"}
  },
  "cross_examination_questions": {
    "for": {"score": X, "reason": "text"},
    "against": {"score": Y, "reason": "text"}
  },
  "cross_examination_answers": {
    "for": {"score": X, "reason": "text"},
    "against": {"score": Y, "reason": "text"}
  },
  "closing": {
    "for": {"score": X, "reason": "text"},
    "against": {"score": Y, "reason": "text"}
  },
  "total": {
    "for": X,
    "against": Y
  },
  "verdict": {
    "winner": "For/Against",
    "reason": "text",
    "congratulations": "text",
    "opponent_analysis": "text"
  }
}

Debate Transcript:
%s

Provide ONLY the JSON output without any additional text.`, transcript.String())

	ctx := context.Background()
	model := geminiClient.GenerativeModel("gemini-1.5-flash")

	model.SafetySettings = []*genai.SafetySetting{
		{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockNone},
		{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockNone},
		{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockNone},
		{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockNone},
	}

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		log.Printf("Gemini error: %v", err)
		return "Unable to judge."
	}

	if len(resp.Candidates) > 0 && len(resp.Candidates[0].Content.Parts) > 0 {
		if text, ok := resp.Candidates[0].Content.Parts[0].(genai.Text); ok {
			return string(text)
		}
	}
	return "Unable to judge."
}
