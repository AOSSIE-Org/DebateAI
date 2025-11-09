package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func SubmitTranscripts(
	roomID string,
	role string,
	email string,
	transcripts map[string]string,
	opponentRole string,
	opponentID string,
	opponentEmail string,
	opponentTranscripts map[string]string,
) (map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
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
	if len(transcripts) > 0 {
		if err := upsertTranscript(ctx, transcriptCollection, roomID, role, email, transcripts); err != nil {
			return nil, err
		}
	}

	if opponentRole != "" && len(opponentTranscripts) > 0 {
		resolvedEmail := opponentEmail
		if resolvedEmail == "" && opponentID != "" {
			if lookup, lookupErr := getUserEmailByID(ctx, opponentID); lookupErr == nil {
				resolvedEmail = lookup
			} else {
			}
		}
		if resolvedEmail == "" && opponentID != "" {
			resolvedEmail = opponentID
		}
		if resolvedEmail != "" {
			if err := upsertTranscript(ctx, transcriptCollection, roomID, opponentRole, resolvedEmail, opponentTranscripts); err != nil {
				return nil, err
			}
		}
	}

	// Check if both sides have submitted
	var forSubmission, againstSubmission models.DebateTranscript
	errFor := transcriptCollection.FindOne(ctx, bson.M{"roomId": roomID, "role": "for"}).Decode(&forSubmission)
	errAgainst := transcriptCollection.FindOne(ctx, bson.M{"roomId": roomID, "role": "against"}).Decode(&againstSubmission)

	var ratingSummary map[string]interface{}

	if errFor == nil && errAgainst == nil {
		// Both submissions exist, compute judgment once
		merged := mergeTranscripts(forSubmission.Transcripts, againstSubmission.Transcripts)
		result := JudgeDebateHumanVsHuman(merged)
		if !isLikelyJSONResult(result) {
			result = buildFallbackJudgeResult(merged)
		}

		// Store the result
		resultDoc := models.DebateResult{
			RoomID:    roomID,
			Result:    result,
			CreatedAt: time.Now(),
		}
		_, err = resultCollection.InsertOne(ctx, resultDoc)
		if err != nil {
			return nil, errors.New("failed to store debate result: " + err.Error())
		}

		// Save the debate transcript for both users
		// First, get user IDs for both participants
		userCollection := db.MongoDatabase.Collection("users")
		savedTranscriptsCollection := db.MongoDatabase.Collection("saved_debate_transcripts")

		var forUser, againstUser models.User
		errFor := findUserByIdentifier(ctx, userCollection, forSubmission.Email, &forUser)
		errAgainst := findUserByIdentifier(ctx, userCollection, againstSubmission.Email, &againstUser)

		if errFor == nil && errAgainst == nil {
			// Check if transcripts have already been saved for this room to prevent duplicates
			var existingTranscript models.SavedDebateTranscript
			judgeResponse := make(map[string]interface{})
			topic := ""
			if err := json.Unmarshal([]byte(result), &judgeResponse); err == nil {
				if value, ok := judgeResponse["topic"].(string); ok {
					topic = strings.TrimSpace(value)
				}
			}
			if topic == "" {
				topic = resolveDebateTopic(ctx, roomID, forSubmission, againstSubmission)
			}
			err = savedTranscriptsCollection.FindOne(ctx, bson.M{
				"topic": topic,
				"$or": []bson.M{
					{"userId": forUser.ID, "opponent": againstUser.Email},
					{"userId": againstUser.ID, "opponent": forUser.Email},
				},
				"createdAt": bson.M{"$gte": time.Now().Add(-5 * time.Minute)}, // Check for recent transcripts (within 5 minutes)
			}).Decode(&existingTranscript)

			if err == nil {
				// Transcript already exists, skip saving to prevent duplicates
			} else if err == mongo.ErrNoDocuments {
				// No existing transcript found, proceed with saving
				// Determine result for each user
				resultFor := "pending"
				resultAgainst := "pending"

				// Try to parse the JSON response to extract the winner
				var judgeResponse map[string]interface{}
				if err := json.Unmarshal([]byte(result), &judgeResponse); err == nil {
					// If JSON parsing succeeds, extract winner from verdict
					if verdict, ok := judgeResponse["verdict"].(map[string]interface{}); ok {
						if winner, ok := verdict["winner"].(string); ok {
							if strings.EqualFold(winner, "For") {
								resultFor = "win"
								resultAgainst = "loss"
							} else if strings.EqualFold(winner, "Against") {
								resultFor = "loss"
								resultAgainst = "win"
							} else {
								// If winner is not clearly "For" or "Against", treat as draw
								resultFor = "draw"
								resultAgainst = "draw"
							}
						} else {
						}
					} else {
					}
				} else {
					// Fallback to string matching if JSON parsing fails
					resultLower := strings.ToLower(result)
					if strings.Contains(resultLower, "for") {
						resultFor = "win"
						resultAgainst = "loss"
					} else if strings.Contains(resultLower, "against") {
						resultFor = "loss"
						resultAgainst = "win"
					} else {
						resultFor = "draw"
						resultAgainst = "draw"
					}
				}

				// Determine the actual debate topic
				topic := resolveDebateTopic(ctx, roomID, forSubmission, againstSubmission)

				// Save transcript for "for" user
				err = SaveDebateTranscript(
					forUser.ID,
					forUser.Email,
					"user_vs_user",
					topic,
					againstUser.Email,
					resultFor,
					[]models.Message{}, // You might want to reconstruct messages from transcripts
					forSubmission.Transcripts,
				)
				if err != nil {
				}

				// Save transcript for "against" user
				err = SaveDebateTranscript(
					againstUser.ID,
					againstUser.Email,
					"user_vs_user",
					topic,
					forUser.Email,
					resultAgainst,
					[]models.Message{}, // You might want to reconstruct messages from transcripts
					againstSubmission.Transcripts,
				)
				if err != nil {
				}

				// Update ratings based on the result
				outcomeFor := 0.5
				switch strings.ToLower(resultFor) {
				case "win":
					outcomeFor = 1.0
				case "loss":
					outcomeFor = 0.0
				}

				debateRecord, opponentRecord, ratingErr := UpdateRatings(forUser.ID, againstUser.ID, outcomeFor, time.Now())
				if ratingErr != nil {
				} else {
					debateRecord.Topic = topic
					debateRecord.Result = resultFor
					opponentRecord.Topic = topic
					opponentRecord.Result = resultAgainst

					records := []interface{}{debateRecord, opponentRecord}
					if _, insertErr := db.MongoDatabase.Collection("debates").InsertMany(ctx, records); insertErr != nil {
					}

					ratingSummary = map[string]interface{}{
						"for": map[string]float64{
							"rating": debateRecord.PostRating,
							"change": debateRecord.RatingChange,
						},
						"against": map[string]float64{
							"rating": opponentRecord.PostRating,
							"change": opponentRecord.RatingChange,
						},
					}
				}
			} else {
			}
		}

		// Clean up transcripts (optional)
		_, err = transcriptCollection.DeleteMany(ctx, bson.M{"roomId": roomID})
		if err != nil {
		}

		response := map[string]interface{}{
			"message": "Debate judged",
			"result":  result,
		}
		if ratingSummary != nil {
			response["ratingSummary"] = ratingSummary
		}
		return response, nil
	}

	// If only one side has submitted, return a waiting message
	return map[string]interface{}{
		"message": "Waiting for opponent submission",
	}, nil
}

func upsertTranscript(
	ctx context.Context,
	collection *mongo.Collection,
	roomID string,
	role string,
	email string,
	transcripts map[string]string,
) error {
	if role == "" || len(transcripts) == 0 {
		return nil
	}

	filter := bson.M{"roomId": roomID, "role": role}
	update := bson.M{
		"$set": bson.M{
			"transcripts": transcripts,
			"email":       email,
			"updatedAt":   time.Now(),
		},
		"$setOnInsert": bson.M{
			"roomId":    roomID,
			"role":      role,
			"createdAt": time.Now(),
		},
	}

	opts := options.Update().SetUpsert(true)
	_, err := collection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		return errors.New("failed to upsert submission: " + err.Error())
	}
	return nil
}

func getUserEmailByID(ctx context.Context, userID string) (string, error) {
	if userID == "" {
		return "", errors.New("empty user ID")
	}

	objectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return "", err
	}

	userCollection := db.MongoDatabase.Collection("users")
	var user models.User
	if err := userCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&user); err != nil {
		return "", err
	}
	return user.Email, nil
}

func findUserByIdentifier(ctx context.Context, collection *mongo.Collection, identifier string, user *models.User) error {
	if identifier == "" {
		return errors.New("empty identifier")
	}

	err := collection.FindOne(ctx, bson.M{"email": identifier}).Decode(user)
	if err == nil {
		return nil
	}

	objectID, objErr := primitive.ObjectIDFromHex(identifier)
	if objErr != nil {
		return err
	}

	return collection.FindOne(ctx, bson.M{"_id": objectID}).Decode(user)
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

func resolveDebateTopic(ctx context.Context, roomID string, forSubmission, againstSubmission models.DebateTranscript) string {
	if topic := extractTopicFromTranscripts(forSubmission.Transcripts); topic != "" {
		return topic
	}
	if topic := extractTopicFromTranscripts(againstSubmission.Transcripts); topic != "" {
		return topic
	}
	if topic := lookupRoomTopic(ctx, roomID); topic != "" {
		return topic
	}
	return "User vs User Debate"
}

func extractTopicFromTranscripts(transcripts map[string]string) string {
	for key, value := range transcripts {
		if strings.Contains(strings.ToLower(key), "topic") {
			trimmed := strings.TrimSpace(value)
			if trimmed != "" && !strings.EqualFold(trimmed, "no response") {
				return trimmed
			}
		}
	}
	return ""
}

func lookupRoomTopic(ctx context.Context, roomID string) string {
	if db.MongoClient == nil {
		return ""
	}

	var database = db.MongoDatabase
	if database == nil {
		database = db.MongoClient.Database("DebateAI")
	}

	var room struct {
		Topic        string `bson:"topic"`
		CurrentTopic string `bson:"currentTopic"`
	}
	if err := database.Collection("rooms").FindOne(ctx, bson.M{"_id": roomID}).Decode(&room); err == nil {
		if topic := strings.TrimSpace(room.Topic); topic != "" {
			return topic
		}
		if topic := strings.TrimSpace(room.CurrentTopic); topic != "" {
			return topic
		}
	}
	return ""
}

func JudgeDebateHumanVsHuman(merged map[string]string) string {
	if geminiClient == nil {
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
	text, err := generateDefaultModelText(ctx, prompt)
	if err != nil {
		return "Unable to judge."
	}
	if text == "" {
		return "Unable to judge."
	}
	return text
}

func isLikelyJSONResult(s string) bool {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" || !strings.HasPrefix(trimmed, "{") {
		return false
	}
	var js map[string]interface{}
	if err := json.Unmarshal([]byte(trimmed), &js); err != nil {
		return false
	}
	return true
}

func countWords(text string) int {
	if text == "" {
		return 0
	}
	return len(strings.Fields(text))
}

func fallbackScoreFromWords(count int) int {
	switch {
	case count <= 0:
		return 0
	case count < 30:
		return 3
	case count < 60:
		return 5
	case count < 90:
		return 7
	case count < 120:
		return 9
	default:
		return 10
	}
}

func buildFallbackJudgeResult(merged map[string]string) string {
	type scoreDetail struct {
		Score  int    `json:"score"`
		Reason string `json:"reason"`
	}

	type section struct {
		For     scoreDetail `json:"for"`
		Against scoreDetail `json:"against"`
	}

	type total struct {
		For     int `json:"for"`
		Against int `json:"against"`
	}

	type verdict struct {
		Winner           string `json:"winner"`
		Reason           string `json:"reason"`
		Congratulations  string `json:"congratulations"`
		OpponentAnalysis string `json:"opponent_analysis"`
	}

	get := func(key string) string {
		return strings.TrimSpace(merged[key])
	}

	buildSection := func(forText, againstText string, label string) (section, int, int) {
		forCount := countWords(forText)
		againstCount := countWords(againstText)
		forScore := fallbackScoreFromWords(forCount)
		againstScore := fallbackScoreFromWords(againstCount)

		return section{
				For: scoreDetail{
					Score:  forScore,
					Reason: fmt.Sprintf("Fallback scoring (%d words) for the %s section.", forCount, label),
				},
				Against: scoreDetail{
					Score:  againstScore,
					Reason: fmt.Sprintf("Fallback scoring (%d words) for the %s section.", againstCount, label),
				},
			},
			forCount,
			againstCount
	}

	opening, openingForWords, openingAgainstWords := buildSection(
		get("openingFor"),
		get("openingAgainst"),
		"opening statement",
	)

	crossQuestions, crossForQuestionWords, crossAgainstQuestionWords := buildSection(
		get("crossForQuestion"),
		get("crossAgainstQuestion"),
		"cross-examination questions",
	)

	crossAnswers, crossForAnswerWords, crossAgainstAnswerWords := buildSection(
		get("crossForAnswer"),
		get("crossAgainstAnswer"),
		"cross-examination answers",
	)

	closing, closingForWords, closingAgainstWords := buildSection(
		get("closingFor"),
		get("closingAgainst"),
		"closing statement",
	)

	totalForScore := opening.For.Score + crossQuestions.For.Score + crossAnswers.For.Score + closing.For.Score
	totalAgainstScore := opening.Against.Score + crossQuestions.Against.Score + crossAnswers.Against.Score + closing.Against.Score

	totalForWords := openingForWords + crossForQuestionWords + crossForAnswerWords + closingForWords
	totalAgainstWords := openingAgainstWords + crossAgainstQuestionWords + crossAgainstAnswerWords + closingAgainstWords

	winner := "Draw"
	reason := fmt.Sprintf(
		"Fallback scoring based on word volume: For=%d words, Against=%d words.",
		totalForWords,
		totalAgainstWords,
	)
	congratulations := "Both sides contributed similarly; the debate is considered a draw."
	opponentAnalysis := "Consider expanding each section with more detailed arguments to help the judge differentiate the positions."

	if totalForScore > totalAgainstScore {
		winner = "For"
		congratulations = "Fallback scoring favors the For side for providing more detailed content."
		opponentAnalysis = "The Against side can strengthen their arguments with additional depth and clarity."
		reason = fmt.Sprintf(
			"Fallback scoring: The For side provided more content (%d vs %d words).",
			totalForWords,
			totalAgainstWords,
		)
	} else if totalAgainstScore > totalForScore {
		winner = "Against"
		congratulations = "Fallback scoring favors the Against side for providing more detailed content."
		opponentAnalysis = "The For side can strengthen their arguments with additional depth and clarity."
		reason = fmt.Sprintf(
			"Fallback scoring: The Against side provided more content (%d vs %d words).",
			totalAgainstWords,
			totalForWords,
		)
	}

	fallback := struct {
		OpeningStatement          section `json:"opening_statement"`
		CrossExaminationQuestions section `json:"cross_examination_questions"`
		CrossExaminationAnswers   section `json:"cross_examination_answers"`
		Closing                   section `json:"closing"`
		Total                     total   `json:"total"`
		Verdict                   verdict `json:"verdict"`
	}{
		OpeningStatement:          opening,
		CrossExaminationQuestions: crossQuestions,
		CrossExaminationAnswers:   crossAnswers,
		Closing:                   closing,
		Total: total{
			For:     totalForScore,
			Against: totalAgainstScore,
		},
		Verdict: verdict{
			Winner:           winner,
			Reason:           reason,
			Congratulations:  congratulations,
			OpponentAnalysis: opponentAnalysis,
		},
	}

	bytes, err := json.Marshal(fallback)
	if err != nil {
		return `{"error":"Unable to judge","message":"Fallback scoring failed."}`
	}
	return string(bytes)
}

// SaveDebateTranscript saves a debate transcript for later viewing
func SaveDebateTranscript(userID primitive.ObjectID, email, debateType, topic, opponent, result string, messages []models.Message, transcripts map[string]string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.MongoDatabase.Collection("saved_debate_transcripts")

	// Check if a similar transcript already exists to prevent duplicates
	// Look for transcripts with the same user, topic, opponent, and debate type created within the last 5 minutes
	filter := bson.M{
		"userId":     userID,
		"topic":      topic,
		"opponent":   opponent,
		"debateType": debateType,
		"createdAt":  bson.M{"$gte": time.Now().Add(-5 * time.Minute)},
	}

	var existingTranscript models.SavedDebateTranscript
	err := collection.FindOne(ctx, filter).Decode(&existingTranscript)
	if err == nil {
		// Transcript already exists, check if we need to update it

		// If the result has changed or is "pending", update the transcript
		if existingTranscript.Result != result || existingTranscript.Result == "pending" {
			update := bson.M{
				"$set": bson.M{
					"result":      result,
					"messages":    messages,
					"transcripts": transcripts,
					"updatedAt":   time.Now(),
				},
			}

			_, err = collection.UpdateOne(ctx, bson.M{"_id": existingTranscript.ID}, update)
			if err != nil {
				return fmt.Errorf("failed to update transcript: %v", err)
			}
			return nil
		} else {
			// Result hasn't changed, skip saving to prevent duplicates
			return nil
		}
	} else if err != mongo.ErrNoDocuments {
		return fmt.Errorf("failed to check existing transcript: %v", err)
	}

	savedTranscript := models.SavedDebateTranscript{
		UserID:      userID,
		Email:       email,
		DebateType:  debateType,
		Topic:       topic,
		Opponent:    opponent,
		Result:      result,
		Messages:    messages,
		Transcripts: transcripts,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	_, err = collection.InsertOne(ctx, savedTranscript)
	if err != nil {
		return fmt.Errorf("failed to save transcript: %v", err)
	}

	return nil
}

// UpdatePendingTranscripts updates any existing transcripts with "pending" results
func UpdatePendingTranscripts() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	collection := db.MongoDatabase.Collection("saved_debate_transcripts")

	// Find all transcripts with "pending" results
	filter := bson.M{"result": "pending"}

	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		return fmt.Errorf("failed to find pending transcripts: %v", err)
	}
	defer cursor.Close(ctx)

	var pendingTranscripts []models.SavedDebateTranscript
	if err = cursor.All(ctx, &pendingTranscripts); err != nil {
		return fmt.Errorf("failed to decode pending transcripts: %v", err)
	}

	// Update each pending transcript to have a default result
	for _, transcript := range pendingTranscripts {
		var newResult string

		// Determine appropriate result based on debate type
		if transcript.DebateType == "user_vs_bot" {
			// For bot debates, default to loss (assuming bot won)
			newResult = "loss"
		} else {
			// For human debates, default to draw
			newResult = "draw"
		}

		update := bson.M{
			"$set": bson.M{
				"result":    newResult,
				"updatedAt": time.Now(),
			},
		}

		_, err = collection.UpdateOne(ctx, bson.M{"_id": transcript.ID}, update)
		if err != nil {
			continue
		}

	}

	return nil
}

// GetUserDebateTranscripts retrieves all saved debate transcripts for a user
func GetUserDebateTranscripts(userID primitive.ObjectID) ([]models.SavedDebateTranscript, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.MongoDatabase.Collection("saved_debate_transcripts")

	filter := bson.M{"userId": userID}
	opts := &options.FindOptions{
		Sort: bson.M{"createdAt": -1}, // Most recent first
	}

	cursor, err := collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find transcripts: %v", err)
	}
	defer cursor.Close(ctx)

	var transcripts []models.SavedDebateTranscript
	if err = cursor.All(ctx, &transcripts); err != nil {
		return nil, fmt.Errorf("failed to decode transcripts: %v", err)
	}

	return transcripts, nil
}

// GetDebateTranscriptByID retrieves a specific debate transcript by ID
func GetDebateTranscriptByID(transcriptID primitive.ObjectID, userID primitive.ObjectID) (*models.SavedDebateTranscript, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.MongoDatabase.Collection("saved_debate_transcripts")

	filter := bson.M{"_id": transcriptID, "userId": userID}

	var transcript models.SavedDebateTranscript
	err := collection.FindOne(ctx, filter).Decode(&transcript)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, errors.New("transcript not found")
		}
		return nil, fmt.Errorf("failed to find transcript: %v", err)
	}

	// If the transcript has a pending result, try to determine the actual result
	if transcript.Result == "pending" {

		var newResult string

		// Determine appropriate result based on debate type
		if transcript.DebateType == "user_vs_bot" {
			// For bot debates, analyze the messages to determine winner
			newResult = determineBotDebateResult(transcript.Messages)
		} else {
			// For human debates, default to draw
			newResult = "draw"
		}

		// Update the transcript with the determined result
		update := bson.M{
			"$set": bson.M{
				"result":    newResult,
				"updatedAt": time.Now(),
			},
		}

		_, err = collection.UpdateOne(ctx, bson.M{"_id": transcriptID}, update)
		if err != nil {
		} else {
			transcript.Result = newResult
			transcript.UpdatedAt = time.Now()
		}
	}

	return &transcript, nil
}

// DeleteDebateTranscript deletes a saved debate transcript
func DeleteDebateTranscript(transcriptID primitive.ObjectID, userID primitive.ObjectID) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.MongoDatabase.Collection("saved_debate_transcripts")

	filter := bson.M{"_id": transcriptID, "userId": userID}

	result, err := collection.DeleteOne(ctx, filter)
	if err != nil {
		return fmt.Errorf("failed to delete transcript: %v", err)
	}

	if result.DeletedCount == 0 {
		return errors.New("transcript not found or not authorized to delete")
	}

	return nil
}

// determineBotDebateResult analyzes the messages from a bot debate to determine the winner
func determineBotDebateResult(messages []models.Message) string {
	// Look for judge messages or final evaluation messages
	for i := len(messages) - 1; i >= 0; i-- {
		message := messages[i]
		text := strings.ToLower(message.Text)

		// Check for judge messages
		if message.Sender == "Judge" {
			if strings.Contains(text, "user win") || strings.Contains(text, "user wins") ||
				(strings.Contains(text, "user") && strings.Contains(text, "win")) {
				return "win"
			} else if strings.Contains(text, "bot win") || strings.Contains(text, "bot wins") ||
				strings.Contains(text, "lose") || strings.Contains(text, "loss") ||
				(strings.Contains(text, "bot") && strings.Contains(text, "win")) {
				return "loss"
			} else if strings.Contains(text, "draw") {
				return "draw"
			}
		}

		// Check for evaluation messages in the last few messages
		if i >= len(messages)-3 {
			if strings.Contains(text, "user win") || strings.Contains(text, "user wins") ||
				(strings.Contains(text, "user") && strings.Contains(text, "win")) {
				return "win"
			} else if strings.Contains(text, "bot win") || strings.Contains(text, "bot wins") ||
				strings.Contains(text, "lose") || strings.Contains(text, "loss") ||
				(strings.Contains(text, "bot") && strings.Contains(text, "win")) {
				return "loss"
			} else if strings.Contains(text, "draw") {
				return "draw"
			}
		}
	}

	// If no clear winner is found, default to loss (assuming bot won)
	return "loss"
}

// GetDebateStats retrieves debate statistics for a user
func GetDebateStats(userID primitive.ObjectID) (map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.MongoDatabase.Collection("saved_debate_transcripts")

	filter := bson.M{"userId": userID}
	opts := &options.FindOptions{
		Sort: bson.M{"createdAt": -1}, // Most recent first
	}

	cursor, err := collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find transcripts: %v", err)
	}
	defer cursor.Close(ctx)

	var transcripts []models.SavedDebateTranscript
	if err = cursor.All(ctx, &transcripts); err != nil {
		return nil, fmt.Errorf("failed to decode transcripts: %v", err)
	}

	// Calculate statistics
	totalDebates := len(transcripts)
	wins := 0
	losses := 0
	draws := 0

	// Get recent debates (last 10)
	recentDebates := make([]map[string]interface{}, 0)
	for i, transcript := range transcripts {
		if i >= 10 { // Only get last 10 debates
			break
		}

		// Count results
		switch transcript.Result {
		case "win":
			wins++
		case "loss":
			losses++
		case "draw":
			draws++
		}

		// Add to recent debates
		recentDebates = append(recentDebates, map[string]interface{}{
			"id":         transcript.ID.Hex(),
			"topic":      transcript.Topic,
			"result":     transcript.Result,
			"opponent":   transcript.Opponent,
			"debateType": transcript.DebateType,
			"date":       transcript.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			"eloChange":  0, // TODO: Add actual Elo change tracking
		})
	}

	winRate := 0.0
	if totalDebates > 0 {
		winRate = float64(wins) / float64(totalDebates) * 100
	}

	return map[string]interface{}{
		"totalDebates":  totalDebates,
		"wins":          wins,
		"losses":        losses,
		"draws":         draws,
		"winRate":       winRate,
		"recentDebates": recentDebates,
	}, nil
}
