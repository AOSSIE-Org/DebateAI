package services

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"arguehub/config"
	"arguehub/db"
	"arguehub/models"

	"github.com/google/generative-ai-go/genai"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"google.golang.org/api/option"
)

// Global Gemini client instance
var geminiClient *genai.Client

// InitDebateVsBotService initializes the Gemini client using the API key from the config
func InitDebateVsBotService(cfg *config.Config) {
	var err error
	geminiClient, err = genai.NewClient(context.Background(), option.WithAPIKey(cfg.Gemini.ApiKey))
	if err != nil {
		log.Fatalf("Failed to initialize Gemini client: %v", err)
	}
}

// BotPersonality defines the debate bot's personality
type BotPersonality struct {
	Name  string
	Level string
}

// GetBotPersonality returns the personality details for a given bot name
func GetBotPersonality(botName string) BotPersonality {
	switch botName {
	case "Rookie Rick":
		return BotPersonality{Name: "Rookie Rick", Level: "Easy"}
	case "Casual Casey":
		return BotPersonality{Name: "Casual Casey", Level: "Easy"}
	case "Moderate Mike":
		return BotPersonality{Name: "Moderate Mike", Level: "Medium"}
	case "Sassy Sarah":
		return BotPersonality{Name: "Sassy Sarah", Level: "Medium"}
	case "Innovative Iris":
		return BotPersonality{Name: "Innovative Iris", Level: "Medium"}
	case "Tough Tony":
		return BotPersonality{Name: "Tough Tony", Level: "Hard"}
	case "Expert Emma":
		return BotPersonality{Name: "Expert Emma", Level: "Hard"}
	case "Grand Greg":
		return BotPersonality{Name: "Grand Greg", Level: "Expert"}
	default:
		return BotPersonality{Name: botName, Level: "Medium"}
	}
}

// FormatHistory converts a slice of debate messages into a formatted transcript
func FormatHistory(history []models.Message) string {
	var sb strings.Builder
	for _, msg := range history {
		phase := msg.Phase
		if phase == "" {
			phase = "Unspecified Phase"
		}
		sb.WriteString(fmt.Sprintf("%s (%s): %s\n", msg.Sender, phase, msg.Text))
	}
	return sb.String()
}

// findLastUserMessage returns the most recent message in the history from the "User".
// If no user message is found, it falls back to the last message in the history.
func findLastUserMessage(history []models.Message) models.Message {
	for i := len(history) - 1; i >= 0; i-- {
		if history[i].Sender == "User" {
			return history[i]
		}
	}
	// Fallback: return the last message even if it's from the bot.
	return history[len(history)-1]
}

// constructPrompt builds a prompt that adjusts based on bot personality, debate topic, history,
// extra context, and uses the provided stance directly. It includes phase-specific instructions.
func constructPrompt(bot BotPersonality, topic string, history []models.Message, stance, extraContext string, maxWords int) string {
	// Level-based instructions
	levelInstructions := ""
	switch strings.ToLower(bot.Level) {
	case "easy":
		levelInstructions = "Use simple language and straightforward arguments."
	case "medium":
		levelInstructions = "Use moderate language with clear reasoning and some details."
	case "hard", "expert":
		levelInstructions = "Employ complex, nuanced arguments with in-depth reasoning."
	default:
		levelInstructions = "Use clear and balanced language."
	}

	// Personality-based instructions to add more disparity
	personalityInstructions := ""
	switch bot.Name {
	case "Rookie Rick":
		personalityInstructions = "Keep your language simple and a bit naive."
	case "Casual Casey":
		personalityInstructions = "Maintain a friendly and relaxed tone."
	case "Moderate Mike":
		personalityInstructions = "Be balanced, logical, and provide clear reasoning."
	case "Sassy Sarah":
		personalityInstructions = "Inject wit and sarcasm while remaining convincing."
	case "Innovative Iris":
		personalityInstructions = "Show creativity and originality in your arguments."
	case "Tough Tony":
		personalityInstructions = "Be assertive and relentless in your logic."
	case "Expert Emma":
		personalityInstructions = "Use authoritative language with deep insights."
	case "Grand Greg":
		personalityInstructions = "Exude confidence and superiority in your arguments."
	default:
		personalityInstructions = "Express your points clearly."
	}

	// Instruction to limit the response
	limitInstruction := ""
	if maxWords > 0 {
		limitInstruction = fmt.Sprintf("Please limit your response to %d words.", maxWords)
	}

	// Base instruction for all responses
	baseInstruction := "Provide only your own argument in your response without simulating an opponent's dialogue. " +
		"If the user's input appears unclear or off-topic, ask: 'Could you please clarify your question or provide an opening statement?'"

	// If no conversation history exists (or only one message), treat this as the opening statement.
	if len(history) == 0 || len(history) == 1 {
		phaseInstruction := "This is the Opening Statement phase. Introduce the topic, clearly state your stance, and outline the advantages or key points supporting your position."
		return fmt.Sprintf(
			`You are %s, a %s-level debate bot arguing %s the topic "%s".
Your debating style should reflect the following guidelines:
- Level: %s
- Personality: %s
Your stance is: %s.
%s
%s
%s
Provide an opening statement that clearly outlines your position.
[Your opening argument]
%s %s`,
			bot.Name, bot.Level, stance, topic,
			levelInstructions,
			personalityInstructions,
			stance,
			func() string {
				if extraContext != "" {
					return fmt.Sprintf("Additional context: %s", extraContext)
				}
				return ""
			}(),
			phaseInstruction,
			limitInstruction, baseInstruction,
		)
	}

	// For subsequent turns, determine the phase and adjust instructions.
	lastUserMsg := findLastUserMessage(history)
	userText := strings.TrimSpace(lastUserMsg.Text)
	if userText == "" {
		userText = "It appears you didn't say anything."
	}
	// Normalize phase names: treat "first rebuttal" or "second rebuttal" as "Cross Examination"
	currentPhase := lastUserMsg.Phase
	phaseNormalized := strings.ToLower(currentPhase)
	if phaseNormalized == "first rebuttal" || phaseNormalized == "second rebuttal" {
		currentPhase = "Cross Examination"
	}

	// Phase-specific instructions
	var phaseInstruction string
	switch strings.ToLower(currentPhase) {
	case "opening statement":
		phaseInstruction = "This is the Opening Statement phase. Respond to the user's opening statement by reinforcing your stance and highlighting key points."
	case "cross examination":
		phaseInstruction = "This is the Cross Examination phase. In this phase, the 'For' side asks a question and the opponent answers, then the opponent asks a question and the 'For' side responds."
	case "closing statement":
		phaseInstruction = "This is the Closing Statement phase. Summarize the key points from the debate and provide a conclusion that reinforces your overall position."
	default:
		phaseInstruction = fmt.Sprintf("This is the %s phase. Respond to the user's latest point in a way that advances the debate.", currentPhase)
	}

	return fmt.Sprintf(
		`You are %s, a %s-level debate bot arguing %s the topic "%s".
Your debating style should reflect the following guidelines:
- Level: %s
- Personality: %s
Your stance is: %s.
%s
%s
Based on the debate transcript below, continue the discussion in the %s phase by responding directly to the user's message.
User's message: "%s"
%s
Transcript:
%s
Please provide your full argument.`,
		bot.Name, bot.Level, stance, topic,
		levelInstructions,
		personalityInstructions,
		stance,
		func() string {
			if extraContext != "" {
				return fmt.Sprintf("Additional context: %s", extraContext)
			}
			return ""
		}(),
		phaseInstruction,
		currentPhase,
		userText,
		limitInstruction+" "+baseInstruction,
		FormatHistory(history),
	)
}

// GenerateBotResponse generates a response from the debate bot using the Gemini client library.
// It uses the provided stance directly, passes along extra context, and limits the response to maxWords.
func GenerateBotResponse(botName, botLevel, topic string, history []models.Message, stance, extraContext string, maxWords int) string {
	if geminiClient == nil {
		log.Println("Gemini client not initialized")
		return "I'm not ready to debate yet!"
	}

	bot := GetBotPersonality(botName)
	// Construct prompt with extra context, word limit instruction, and improved history usage.
	prompt := constructPrompt(bot, topic, history, stance, extraContext, maxWords)

	ctx := context.Background()
	model := geminiClient.GenerativeModel("gemini-1.5-flash")

	// Set safety settings to BLOCK_NONE for all categories to ensure no content is blocked
	model.SafetySettings = []*genai.SafetySetting{
		{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockNone},
		{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockNone},
		{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockNone},
		{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockNone},
	}

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		log.Printf("Gemini error: %v", err)
		return "I'm stumped!"
	}

	// Check if the prompt was blocked (non-nil PromptFeedback with a non-zero BlockReason)
	if resp.PromptFeedback != nil && resp.PromptFeedback.BlockReason != 0 {
		log.Printf("Prompt blocked: %v", resp.PromptFeedback.BlockReason)
		return fmt.Sprintf("Prompt was blocked due to safety settings: %v", resp.PromptFeedback.BlockReason)
	}

	if len(resp.Candidates) == 0 {
		log.Println("No candidates returned")
		return "I'm stumped due to content restrictions!"
	}

	if len(resp.Candidates[0].Content.Parts) == 0 {
		log.Println("No parts in candidate content")
		return "I'm stumped!"
	}

	for _, part := range resp.Candidates[0].Content.Parts {
		if text, ok := part.(genai.Text); ok {
			return string(text)
		}
	}

	log.Println("No text part found in Gemini response")
	return "I'm stumped!"
}

// JudgeDebate evaluates the debate by sending the formatted history to Gemini
// JudgeDebate evaluates the debate with structured scoring
func JudgeDebate(history []models.Message) string {
	if geminiClient == nil {
		log.Println("Gemini client not initialized")
		return "Unable to judge."
	}
	log.Println("Judging debate...")
	log.Println("History:", history)
	prompt := fmt.Sprintf(
		`Act as a professional debate judge. Analyze the following debate transcript and provide scores in STRICT JSON format:

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
    "user": {"score": X, "reason": "text"},
    "bot": {"score": Y, "reason": "text"}
  },
  "cross_examination": {
    "user": {"score": X, "reason": "text"},
    "bot": {"score": Y, "reason": "text"}
  },
  "answers": {
    "user": {"score": X, "reason": "text"},
    "bot": {"score": Y, "reason": "text"}
  },
  "closing": {
    "user": {"score": X, "reason": "text"},
    "bot": {"score": Y, "reason": "text"}
  },
  "total": {
    "user": X,
    "bot": Y
  },
  "verdict": {
    "winner": "User/Bot",
    "reason": "text",
    "congratulations": "text",
    "opponent_analysis": "text"
  }
}

Debate Transcript:
%s

Provide ONLY the JSON output without any additional text.`, FormatHistory(history))

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

	// Extract and return the JSON response
	if len(resp.Candidates) > 0 && len(resp.Candidates[0].Content.Parts) > 0 {
		if text, ok := resp.Candidates[0].Content.Parts[0].(genai.Text); ok {
			return string(text)
		}
	}
	return "Unable to judge."
}

// CreateDebateService creates a new debate in MongoDB using the existing collection
func CreateDebateService(debate *models.DebateVsBot, stance string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if debate.ID.IsZero() {
		debate.ID = primitive.NewObjectID()
	}
	if debate.CreatedAt == 0 {
		debate.CreatedAt = time.Now().Unix()
	}
	debate.Stance = stance // Set the bot's stance as provided

	if db.DebateVsBotCollection == nil {
		log.Println("Debate collection not initialized")
		return "", fmt.Errorf("database not initialized")
	}

	result, err := db.DebateVsBotCollection.InsertOne(ctx, debate)
	if err != nil {
		log.Printf("Failed to create debate in MongoDB: %v", err)
		return "", err
	}

	id, ok := result.InsertedID.(primitive.ObjectID)
	if !ok {
		log.Println("Failed to convert InsertedID to ObjectID")
		return "", fmt.Errorf("internal server error")
	}

	return id.Hex(), nil
}
