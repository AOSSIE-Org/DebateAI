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

// LLMTextGenerator interface for test mocking and LLM execution
type LLMTextGenerator func(ctx context.Context, prompt string) (string, error)

var defaultLLMGenerator LLMTextGenerator = generateDefaultModelText

// SetLLMGenerator allows overriding the generator (used in unit tests)
func SetLLMGenerator(gen LLMTextGenerator) {
	defaultLLMGenerator = gen
}

// ResetLLMGenerator resets the generator back to default
func ResetLLMGenerator() {
	defaultLLMGenerator = generateDefaultModelText
}

// BuildPerformanceReportPrompt constructs the prompt for LLM report generation
func BuildPerformanceReportPrompt(topic, stance, transcriptText, debateType string) string {
	if stance == "" {
		stance = "User / Debater"
	}
	if topic == "" {
		topic = "General Debate"
	}

	audienceNote := "Analyze the following debate transcript and generate an in-depth, personalized Post-Debate Performance Report for the debater who represented the stance"
	if debateType == "team" {
		audienceNote = "Analyze the following team debate transcript and generate a team-level Post-Debate Performance Report (combined arguments from all speakers on the same side, not individualized per teammate) for the side that represented the stance"
	}

	return fmt.Sprintf(`You are an expert debate adjudicator, rhetoric scholar, and speech coach.
%s: "%s".
Debate Topic: "%s"

Full Transcript:
%s

Analyze the debater's specific arguments, clarity, persuasiveness, rebuttal tactics, and logical structure. Identify any logical fallacies committed by this debater (e.g., Ad Hominem, Straw Man, Slippery Slope, False Dilemma, Circular Reasoning, Red Herring, Appeal to Emotion, Hasty Generalization).

You MUST return ONLY a valid JSON object matching this exact schema (no markdown fences, no explanatory text, no prefix):
{
  "overall_scores": {
    "persuasion": <integer 0-100>,
    "clarity": <integer 0-100>,
    "rebuttal_effectiveness": <integer 0-100>
  },
  "argument_breakdown": [
    {
      "statement": "<exact or closely paraphrased key argument from debater>",
      "tag": "<Strong | Moderate | Weak>",
      "reason": "<concise one-line evaluation of the argument quality>"
    }
  ],
  "fallacy_flags": [
    {
      "statement": "<specific quote where a logical fallacy was committed, if any>",
      "fallacy_type": "<name of fallacy, e.g. Straw Man>",
      "explanation": "<brief explanation of the logical error>"
    }
  ],
  "improvement_tips": [
    "<actionable, specific recommendation 1 tailored strictly to this transcript>",
    "<actionable, specific recommendation 2 tailored strictly to this transcript>",
    "<actionable, specific recommendation 3 tailored strictly to this transcript>"
  ]
}

STRICT CONSTRAINTS:
1. Return ONLY the raw JSON object. Do NOT enclose in markdown tags or add preamble.
2. Provide 2 to 3 high-impact improvement tips specific to the content of this transcript.
3. If no fallacies are present in the debater's statements, provide an empty array [] for "fallacy_flags".
4. "tag" in argument_breakdown MUST be exactly "Strong", "Moderate", or "Weak".`, audienceNote, stance, topic, transcriptText)
}

// FormatTranscriptFromPayload formats messages or transcripts map into string
func FormatTranscriptFromPayload(messages []models.Message, transcripts map[string]string) string {
	var sb strings.Builder

	if len(messages) > 0 {
		for _, msg := range messages {
			phase := msg.Phase
			if phase == "" {
				phase = "General"
			}
			sender := msg.Sender
			if sender == "" {
				sender = "Debater"
			}
			sb.WriteString(fmt.Sprintf("[%s] %s: %s\n", phase, sender, msg.Text))
		}
		return sb.String()
	}

	if len(transcripts) > 0 {
		phaseOrder := []string{
			"openingFor", "openingAgainst",
			"crossForQuestion", "crossAgainstAnswer",
			"crossAgainstQuestion", "crossForAnswer",
			"closingFor", "closingAgainst",
		}
		for _, phase := range phaseOrder {
			if text, ok := transcripts[phase]; ok && strings.TrimSpace(text) != "" {
				role := "For"
				if strings.Contains(strings.ToLower(phase), "against") {
					role = "Against"
				}
				sb.WriteString(fmt.Sprintf("[%s] %s: %s\n", phase, role, text))
			}
		}
		// Also add any other arbitrary transcript keys
		for k, v := range transcripts {
			found := false
			for _, p := range phaseOrder {
				if p == k {
					found = true
					break
				}
			}
			if !found && strings.TrimSpace(v) != "" {
				sb.WriteString(fmt.Sprintf("[%s]: %s\n", k, v))
			}
		}
		return sb.String()
	}

	return ""
}

// UserIsDebateParticipant returns true if the user took part in the debate identified by debateID.
func UserIsDebateParticipant(ctx context.Context, debateID string, userID primitive.ObjectID, email string) bool {
	if db.MongoDatabase == nil || debateID == "" || userID.IsZero() || email == "" {
		return false
	}

	transcriptCount, err := db.MongoDatabase.Collection("debate_transcripts").CountDocuments(ctx, bson.M{
		"roomId": debateID,
		"email":  email,
	})
	if err == nil && transcriptCount > 0 {
		return true
	}

	objID, err := primitive.ObjectIDFromHex(debateID)
	if err != nil {
		return false
	}

	var botDebate models.DebateVsBot
	if db.MongoDatabase.Collection("debates_vs_bot").FindOne(ctx, bson.M{"_id": objID, "email": email}).Decode(&botDebate) == nil {
		return true
	}

	var saved models.SavedDebateTranscript
	if db.MongoDatabase.Collection("saved_debate_transcripts").FindOne(ctx, bson.M{"_id": objID, "userId": userID}).Decode(&saved) == nil {
		return true
	}

	var teamDebate models.TeamDebate
	if db.MongoDatabase.Collection("team_debates").FindOne(ctx, bson.M{"_id": objID}).Decode(&teamDebate) == nil {
		for _, member := range teamDebate.Team1Members {
			if member.UserID == userID {
				return true
			}
		}
		for _, member := range teamDebate.Team2Members {
			if member.UserID == userID {
				return true
			}
		}
	}

	return false
}

// GetCachedPerformanceReport checks if a report already exists in MongoDB
func GetCachedPerformanceReport(ctx context.Context, debateID string, userID primitive.ObjectID) (*models.PerformanceReport, error) {
	if db.MongoDatabase == nil || debateID == "" {
		return nil, nil
	}

	collection := db.MongoDatabase.Collection("performance_reports")
	filter := bson.M{"debateId": debateID}
	if userID.IsZero() {
		filter["$or"] = []bson.M{
			{"userId": bson.M{"$exists": false}},
			{"userId": nil},
		}
	} else {
		filter["userId"] = userID
	}

	var report models.PerformanceReport
	err := collection.FindOne(ctx, filter).Decode(&report)
	if err == nil {
		return &report, nil
	}
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	return nil, err
}

// SavePerformanceReport persists the generated report into MongoDB
func SavePerformanceReport(ctx context.Context, report *models.PerformanceReport) error {
	if db.MongoDatabase == nil || report == nil {
		return errors.New("database not available")
	}

	collection := db.MongoDatabase.Collection("performance_reports")
	if report.GeneratedAt.IsZero() {
		report.GeneratedAt = time.Now()
	}

	filter := bson.M{"debateId": report.DebateID}
	if report.UserID.IsZero() {
		filter["$or"] = []bson.M{
			{"userId": bson.M{"$exists": false}},
			{"userId": nil},
		}
	} else {
		filter["userId"] = report.UserID
	}

	opts := bson.M{"$set": report}
	_, err := collection.UpdateOne(ctx, filter, opts, nil)
	if err != nil || report.ID.IsZero() {
		// If update didn't match or new, insert
		var existing models.PerformanceReport
		if errFind := collection.FindOne(ctx, filter).Decode(&existing); errFind == mongo.ErrNoDocuments {
			if report.ID.IsZero() {
				report.ID = primitive.NewObjectID()
			}
			_, err = collection.InsertOne(ctx, report)
			return err
		}
	}
	return nil
}

// ParseReportJSON attempts to unmarshal cleaned LLM output into PerformanceReport
func ParseReportJSON(raw string) (*models.PerformanceReport, error) {
	cleaned := cleanModelOutput(raw)
	// Find boundary of first '{' and last '}'
	start := strings.Index(cleaned, "{")
	end := strings.LastIndex(cleaned, "}")
	if start != -1 && end != -1 && end > start {
		cleaned = cleaned[start : end+1]
	}

	var parsed struct {
		OverallScores     models.OverallScores  `json:"overall_scores"`
		ArgumentBreakdown []models.ArgumentItem `json:"argument_breakdown"`
		FallacyFlags      []models.FallacyFlag  `json:"fallacy_flags"`
		ImprovementTips   []string              `json:"improvement_tips"`
	}

	if err := json.Unmarshal([]byte(cleaned), &parsed); err != nil {
		return nil, err
	}

	// Validate bounds
	if parsed.OverallScores.Persuasion < 0 {
		parsed.OverallScores.Persuasion = 0
	} else if parsed.OverallScores.Persuasion > 100 {
		parsed.OverallScores.Persuasion = 100
	}
	if parsed.OverallScores.Clarity < 0 {
		parsed.OverallScores.Clarity = 0
	} else if parsed.OverallScores.Clarity > 100 {
		parsed.OverallScores.Clarity = 100
	}
	if parsed.OverallScores.RebuttalEffectiveness < 0 {
		parsed.OverallScores.RebuttalEffectiveness = 0
	} else if parsed.OverallScores.RebuttalEffectiveness > 100 {
		parsed.OverallScores.RebuttalEffectiveness = 100
	}

	if parsed.FallacyFlags == nil {
		parsed.FallacyFlags = []models.FallacyFlag{}
	}
	if len(parsed.ArgumentBreakdown) == 0 {
		return nil, errors.New("missing or empty argument_breakdown")
	}
	if len(parsed.ImprovementTips) == 0 {
		return nil, errors.New("missing or empty improvement_tips")
	}
	if parsed.OverallScores.Persuasion == 0 && parsed.OverallScores.Clarity == 0 && parsed.OverallScores.RebuttalEffectiveness == 0 {
		return nil, errors.New("missing or empty overall_scores")
	}

	return &models.PerformanceReport{
		OverallScores:     parsed.OverallScores,
		ArgumentBreakdown: parsed.ArgumentBreakdown,
		FallacyFlags:      parsed.FallacyFlags,
		ImprovementTips:   parsed.ImprovementTips,
	}, nil
}

// BuildFallbackPerformanceReport generates a structured fallback when LLM parsing repeatedly fails
func BuildFallbackPerformanceReport(topic, stance, transcriptText string) *models.PerformanceReport {
	wordCount := len(strings.Fields(transcriptText))
	persuasionScore := 70
	clarityScore := 72
	rebuttalScore := 68

	if wordCount < 30 {
		persuasionScore = 50
		clarityScore = 55
		rebuttalScore = 45
	} else if wordCount > 150 {
		persuasionScore = 80
		clarityScore = 82
		rebuttalScore = 78
	}

	return &models.PerformanceReport{
		OverallScores: models.OverallScores{
			Persuasion:           persuasionScore,
			Clarity:              clarityScore,
			RebuttalEffectiveness: rebuttalScore,
		},
		ArgumentBreakdown: []models.ArgumentItem{
			{
				Statement: fmt.Sprintf("Position defended regarding %s", topic),
				Tag:       "Moderate",
				Reason:    "Delivered coherent opening and rebuttal points during the session.",
			},
		},
		FallacyFlags: []models.FallacyFlag{},
		ImprovementTips: []string{
			"Support key assertions with concrete evidence or empirical examples to heighten persuasion.",
			"Directly address and dismantle the opponent's counterpoints during rebuttal phases.",
			"Structure arguments using Point-Reason-Example-Point (PREP) for maximum clarity.",
		},
		IsFallback: true,
	}
}

// GenerateOrGetPerformanceReport main service entry point with caching & retry logic
func GenerateOrGetPerformanceReport(ctx context.Context, req models.PerformanceReportRequest, userID primitive.ObjectID, userEmail string) (*models.PerformanceReport, error) {
	if req.DebateID == "" {
		req.DebateID = primitive.NewObjectID().Hex()
	}

	// 1. Check cache first (skip cached fallback so a later request can retry the LLM)
	cached, err := GetCachedPerformanceReport(ctx, req.DebateID, userID)
	if err == nil && cached != nil && !cached.IsFallback {
		return cached, nil
	}

	// 2. Resolve transcript text and topic/stance if missing
	transcriptText := FormatTranscriptFromPayload(req.Messages, req.Transcripts)
	topic := req.Topic
	stance := req.Stance

	// If transcriptText is empty, attempt to look up from database records
	if transcriptText == "" && db.MongoDatabase != nil {
		// Check SavedDebateTranscript
		if objID, err := primitive.ObjectIDFromHex(req.DebateID); err == nil {
			var saved models.SavedDebateTranscript
			if errFind := db.MongoDatabase.Collection("saved_debate_transcripts").FindOne(ctx, bson.M{"_id": objID}).Decode(&saved); errFind == nil {
				if topic == "" {
					topic = saved.Topic
				}
				transcriptText = FormatTranscriptFromPayload(saved.Messages, saved.Transcripts)
			}
		}

		// Check DebateVsBot
		if transcriptText == "" {
			if objID, err := primitive.ObjectIDFromHex(req.DebateID); err == nil {
				var botDebate models.DebateVsBot
				if errFind := db.MongoDatabase.Collection("debates_vs_bot").FindOne(ctx, bson.M{"_id": objID}).Decode(&botDebate); errFind == nil {
					if topic == "" {
						topic = botDebate.Topic
					}
					if stance == "" {
						if strings.EqualFold(botDebate.Stance, "For") {
							stance = "Against"
						} else {
							stance = "For"
						}
					}
					transcriptText = FormatHistory(botDebate.History)
				}
			}
		}
	}

	if topic == "" {
		topic = "Debate Session"
	}
	if stance == "" {
		stance = "Debater"
	}

	// 3. Build Prompt & Call LLM
	prompt := BuildPerformanceReportPrompt(topic, stance, transcriptText, req.DebateType)

	var report *models.PerformanceReport
	llmOutput, err := defaultLLMGenerator(ctx, prompt)
	if err == nil && llmOutput != "" {
		parsed, parseErr := ParseReportJSON(llmOutput)
		if parseErr == nil {
			report = parsed
		} else {
			// Retry once with an explicit correction prompt
			retryPrompt := fmt.Sprintf("Your previous response was not valid JSON:\nError: %v\n\nPlease re-analyze and return ONLY valid JSON matching the exact schema:\n%s", parseErr, prompt)
			if retryOutput, retryErr := defaultLLMGenerator(ctx, retryPrompt); retryErr == nil && retryOutput != "" {
				if retryParsed, retryParseErr := ParseReportJSON(retryOutput); retryParseErr == nil {
					report = retryParsed
				}
			}
		}
	}

	// 4. Fallback if LLM failed or not configured
	if report == nil {
		report = BuildFallbackPerformanceReport(topic, stance, transcriptText)
	}

	// 5. Populate metadata & persist to cache
	report.DebateID = req.DebateID
	report.UserID = userID
	report.Email = userEmail
	report.Topic = topic
	report.Stance = stance
	report.GeneratedAt = time.Now()

	if err := SavePerformanceReport(ctx, report); err != nil {
		log.Printf("Failed to cache performance report for debate %s: %v", req.DebateID, err)
	}

	return report, nil
}
