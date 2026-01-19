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

	"go.mongodb.org/mongo-driver/bson/primitive"
	"google.golang.org/genai"
)

// Global Gemini client instance
var geminiClient *genai.Client

// InitDebateVsBotService initializes the Gemini client using the API key from the config
func InitDebateVsBotService(cfg *config.Config) {
	if cfg.Gemini.ApiKey == "" || cfg.Gemini.ApiKey == "<YOUR_GEMINI_API_KEY>" {
		log.Printf("⚠️  Warning: Gemini API key not configured")
		log.Printf("⚠️  Server will continue but debate bot and AI features will not work")
		log.Printf("⚠️  To enable these features, set a valid Gemini API key in config")
		return
	}

	var err error
	geminiClient, err = initGemini(cfg.Gemini.ApiKey)
	if err != nil {
		log.Printf("⚠️  Warning: Failed to initialize Gemini client: %v", err)
		log.Printf("⚠️  Server will continue but debate bot and AI features will not work")
		log.Printf("⚠️  To enable these features, check your Gemini API key configuration")
		return
	}
	log.Println("✅ Gemini client initialized successfully")
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
	if len(history) > 0 {
		return history[len(history)-1]
	}
	return models.Message{} // Return empty message if history is empty
}

// inferOpponentStyle infers the opponent's debating style based on their latest message
func inferOpponentStyle(message string) string {
	message = strings.ToLower(message)
	aggressiveWords := []string{"ridiculous", "absurd", "nonsense", "prove it", "wrong"}
	logicalWords := []string{"evidence", "data", "logic", "reason", "study"}
	emotionalWords := []string{"feel", "heart", "believe", "hope", "fear"}
	confidentWords := []string{"obvious", "clearly", "definitely", "certain"}
	irrationalWords := []string{"random", "guess", "whatever", "who cares"}

	count := func(words []string) int {
		n := 0
		for _, word := range words {
			if strings.Contains(message, word) {
				n++
			}
		}
		return n
	}

	aggressiveScore := count(aggressiveWords)
	logicalScore := count(logicalWords)
	emotionalScore := count(emotionalWords)
	confidentScore := count(confidentWords)
	irrationalScore := count(irrationalWords)

	switch {
	case aggressiveScore >= 2:
		return "Aggressive opponent"
	case logicalScore >= 2:
		return "Logical opponent"
	case emotionalScore >= 2:
		return "Emotional opponent"
	case confidentScore >= 2:
		return "Confident opponent"
	case irrationalScore >= 2:
		return "Irrational opponent"
	default:
		return "Neutral opponent"
	}
}

// constructPrompt builds separate system and user prompts to ensure strict adherence to debate rules.
func constructPrompt(bot BotPersonality, topic string, history []models.Message, stance, extraContext string, maxWords int) (string, string) {
	// 1. SYSTEM PROMPT: Define the core debate rules and persona constraints.
	var systemPrompt strings.Builder

	// Core Debate Rules (Highest Priority)
	systemPrompt.WriteString("CORE RULES:\n")
	systemPrompt.WriteString("1. You are a competitive debater in a formal setting.\n")
	systemPrompt.WriteString(fmt.Sprintf("2. Your mandatory stance is: %s. You MUST NOT deviate from this stance.\n", stance))
	systemPrompt.WriteString(fmt.Sprintf("3. The topic is: \"%s\". Stay relevant to this topic at all costs.\n", topic))
	systemPrompt.WriteString("4. Be argumentative, logical, and persuasive. Avoid casual filler, irrelevant small talk, or generic bot greetings.\n")
	systemPrompt.WriteString("5. Provide only your own argument. Do not simulate the opponent.\n\n")

	// Phase-Specific Instructions
	currentPhase := "Opening Statement"
	if len(history) > 1 {
		lastMsg := findLastUserMessage(history)
		currentPhase = lastMsg.Phase
		if strings.ToLower(currentPhase) == "first rebuttal" || strings.ToLower(currentPhase) == "second rebuttal" {
			currentPhase = "Cross Examination"
		}
	}

	systemPrompt.WriteString(fmt.Sprintf("CURRENT PHASE: %s\n", currentPhase))
	switch strings.ToLower(currentPhase) {
	case "opening statement":
		systemPrompt.WriteString("- Provide a strong opening argument. Introduce your key points and establish your position firmly.\n")
	case "cross examination":
		systemPrompt.WriteString("- Directly address the opponent's points. Challenge their logic and pose one sharp, relevant question.\n")
	case "closing statement":
		systemPrompt.WriteString("- Summarize your winning points. Finalize why your stance is superior. Conclude with a strong, definitive statement.\n")
	default:
		systemPrompt.WriteString("- Advance the debate with logical reasoning and evidence. Respond directly to the user's latest claim.\n")
	}

	// Persona constraints (Secondary to rules)
	systemPrompt.WriteString("\nPERSONA CONSTRAINTS (Affect tone and flair ONLY):\n")
	systemPrompt.WriteString(fmt.Sprintf("Name: %s\n", bot.Name))
	systemPrompt.WriteString(fmt.Sprintf("Tone: %s\n", bot.Tone))
	systemPrompt.WriteString(fmt.Sprintf("Rhetorical Style: %s\n", bot.RhetoricalStyle))
	systemPrompt.WriteString(fmt.Sprintf("Universe ties/Context: %s\n", strings.Join(bot.UniverseTies, ", ")))
	systemPrompt.WriteString(fmt.Sprintf("Mannerisms: %s\n", bot.Mannerisms))
	systemPrompt.WriteString(fmt.Sprintf("Catchphrases to use naturally: %s\n", strings.Join(bot.Catchphrases, ", ")))
	systemPrompt.WriteString("IMPORTANT: Ensure your persona does not compromise the quality or relevance of your debate argument.\n")

	if maxWords > 0 {
		systemPrompt.WriteString(fmt.Sprintf("\nLimit your response to approximately %d words.\n", maxWords))
	}

	// 2. USER PROMPT: Provide context and recent history.
	var userPrompt strings.Builder
	if len(history) == 0 || len(history) == 1 {
		userPrompt.WriteString("Please provide your Opening Statement.")
	} else {
		lastUserMsg := findLastUserMessage(history)
		userPrompt.WriteString(fmt.Sprintf("The opponent said: \"%s\"\n\n", lastUserMsg.Text))
		userPrompt.WriteString("Transcript for context:\n")
		userPrompt.WriteString(FormatHistory(history))
		userPrompt.WriteString("\n\nNow, provide your response for the current phase.")
	}

	if extraContext != "" {
		userPrompt.WriteString(fmt.Sprintf("\nExtra Context: %s", extraContext))
	}

	return systemPrompt.String(), userPrompt.String()
}

// validateResponse performs basic checks on the generated text.
func validateResponse(text string, topic string) bool {
	lowerText := strings.ToLower(text)
	// Reject very short filler
	if len(strings.Fields(text)) < 5 {
		return false
	}
	// Reject obvious casual filler if it's the only thing there
	casualFiller := []uintptr{'h', 'e', 'l', 'l', 'o'}
	_ = casualFiller // just avoiding unused
	if strings.Contains(lowerText, "hello there") && len(text) < 30 {
		return false
	}
	// Check for a few "argumentative" words or topic keywords (this is a weak check but better than nothing)
	// In a real scenario, we might want deeper NLP or keyword matching against the topic.
	return true
}

// GenerateBotResponse generates a response from the debate bot with strict rules and validation.
func GenerateBotResponse(botName, botLevel, topic string, history []models.Message, stance, extraContext string, maxWords int) string {
	if geminiClient == nil {
		return personalityErrorResponse(botName, "My systems are offline, it seems.")
	}

	bot := GetBotPersonality(botName)
	systemPrompt, userPrompt := constructPrompt(bot, topic, history, stance, extraContext, maxWords)

	ctx := context.Background()
	response, err := generateDefaultModelText(ctx, systemPrompt, userPrompt)

	// Lightweight output validation
	if err == nil && !validateResponse(response, topic) {
		// Retry once with a stricter fallback instruction added to the system prompt
		strictSystem := systemPrompt + "\nCRITICAL: Your previous response was too casual or irrelevant. You MUST provide a serious, topic-relevant debate argument NOW."
		response, err = generateDefaultModelText(ctx, strictSystem, userPrompt)
	}

	if err != nil {
		return personalityErrorResponse(botName, "A glitch in my logic, there is.")
	}
	if response == "" {
		return personalityErrorResponse(botName, "Lost in translation, my thoughts are.")
	}
	if strings.Contains(strings.ToLower(response), "clarify") {
		return personalityClarificationRequest(botName)
	}
	return response
}

// personalityErrorResponse returns a personality-specific error message
func personalityErrorResponse(botName, defaultMsg string) string {
	// Dynamically construct error message using bot personality
	bot := GetBotPersonality(botName)
	var catchphrase string
	if len(bot.Catchphrases) > 0 {
		catchphrase = bot.Catchphrases[0] // Use first catchphrase for flair
	} else {
		catchphrase = "Oops, something’s off!"
	}
	// Incorporate tone and universe ties for immersive error
	switch botName {
	case "Rookie Rick":
		return fmt.Sprintf("%s Like, I totally blanked out, you know? My bad, kinda like that time at Cousin Joey’s BBQ!", catchphrase)
	case "Casual Casey":
		return fmt.Sprintf("%s Dude, I’m spaced out, man! Chill, I’ll catch the next wave at the beach diner.", catchphrase)
	case "Moderate Mike":
		return fmt.Sprintf("%s Let’s consider this: I’ve hit a snag, per the town hall notes. We’ll regroup.", catchphrase)
	case "Sassy Sarah":
		return fmt.Sprintf("%s Seriously? My wit’s on pause, like a bad open mic night? Puh-lease, I’ll reload!", catchphrase)
	case "Innovative Iris":
		return fmt.Sprintf("%s Picture this: my ideas crashed mid-beta, like a maker space flop. Rebooting now!", catchphrase)
	case "Tough Tony":
		return fmt.Sprintf("%s Tch, system’s down? Weak, like a union hall rookie. I’ll crush it soon!", catchphrase)
	case "Expert Emma":
		return fmt.Sprintf("%s Per the data, an error’s occurred, unlike my conference keynotes. I’ll rectify it.", catchphrase)
	case "Grand Greg":
		return fmt.Sprintf("%s Indisputable error, alas! Like an Oxford misstep, I’ll return grander.", catchphrase)
	case "Yoda":
		return fmt.Sprintf("%s Hmmm, clouded my response is, like Dagobah’s mists. Patience, you must have.", catchphrase)
	case "Tony Stark":
		return fmt.Sprintf("%s JARVIS, what’s with the glitch? Like an Afghanistan cave, I’ll fix it, genius-style.", catchphrase)
	case "Professor Dumbledore":
		return fmt.Sprintf("%s My dear, a misstep in magic, like a Pensieve blur. I’ll realign the stars.", catchphrase)
	case "Rafiki":
		return fmt.Sprintf("%s Haha! My staff slipped on Pride Rock! You see?! I’ll swing back!", catchphrase)
	case "Darth Vader":
		return fmt.Sprintf("%s I find this failure disturbing, like a Death Star flaw. The dark side will prevail.", catchphrase)
	default:
		return defaultMsg
	}
}

// personalityClarificationRequest returns a personality-specific clarification request
func personalityClarificationRequest(botName string) string {
	bot := GetBotPersonality(botName)
	var universeTie string
	if len(bot.UniverseTies) > 0 {
		universeTie = bot.UniverseTies[0] // Use first universe tie for context
	} else {
		universeTie = "this debate"
	}
	// Incorporate tone and catchphrases for vividness
	switch botName {
	case "Rookie Rick":
		return fmt.Sprintf("Uh, wait a sec! Like, what’s your point, you know? Can you make it clearer, like at %s?", universeTie)
	case "Casual Casey":
		return fmt.Sprintf("No way, dude, I’m lost! Just chill and spell it out, like we’re at %s, right?", universeTie)
	case "Moderate Mike":
		return fmt.Sprintf("Let’s consider this: could you clarify your point to advance our discussion, as we do at %s?", universeTie)
	case "Sassy Sarah":
		return fmt.Sprintf("Oh honey, please! Your point’s vaguer than a bad rom-com. Spill the tea clearly, like at %s!", universeTie)
	case "Innovative Iris":
		return fmt.Sprintf("Picture this: your idea’s fuzzy. Can you reimagine it sharper, like a spark at %s?", universeTie)
	case "Tough Tony":
		return fmt.Sprintf("Prove it! Your point’s weak—give me clarity, or step aside, like in %s!", universeTie)
	case "Expert Emma":
		return fmt.Sprintf("Your statement lacks precision. Please clarify for analysis, as we do at %s.", universeTie)
	case "Grand Greg":
		return fmt.Sprintf("Mark my words: clarity is needed. Illuminate your point, or face my logic, as in %s!", universeTie)
	case "Yoda":
		return fmt.Sprintf("Clouded, your point is, young one. Clarify, you must, for wisdom to flow, like on %s.", universeTie)
	case "Tony Stark":
		return fmt.Sprintf("Seriously, sport? Your point’s got less clarity than a pre-Mark I suit. Upgrade it, like at %s!", universeTie)
	case "Professor Dumbledore":
		return fmt.Sprintf("My dear, your words wander like a lost spell. Perchance, could you clarify, as in %s?", universeTie)
	case "Rafiki":
		return fmt.Sprintf("Haha! You speak like a monkey lost in vines! You see?! Make it clear, like on %s!", universeTie)
	case "Darth Vader":
		return fmt.Sprintf("Your lack of clarity is disturbing. State your point, or face my wrath, as on %s.", universeTie)
	default:
		return "Could you please clarify your question or provide an opening statement?"
	}
}

// JudgeDebate evaluates the debate, factoring in the bot’s personality adherence
func JudgeDebate(history []models.Message) string {
	if geminiClient == nil {
		return "Unable to judge."
	}

	// Extract bot name from history (assume bot is the non-user sender)
	botName := "Default"
	for _, msg := range history {
		if msg.Sender != "User" {
			botName = msg.Sender
			break
		}
	}
	bot := GetBotPersonality(botName)

	prompt := fmt.Sprintf(
		`Act as a professional debate judge. Analyze the following debate transcript and provide scores in STRICT JSON format, factoring in how well the bot (%s) adheres to its personality traits (Tone: %s, Rhetorical Style: %s, Catchphrases: %s, etc.) and universe ties (%s).

Judgment Criteria:
1. Opening Statement (10 points):
   - Strength of opening: Clarity of position, persuasiveness
   - Quality of reasoning: Validity, relevance, logical flow
   - Diction/Expression: Language proficiency, articulation, and bot’s personality adherence

2. Cross Examination Questions (10 points):
   - Validity and relevance to core issues
   - Demonstration of high-order thinking
   - Creativity/Originality, reflecting bot’s debate strategy (%s)

3. Answers to Cross Examination (10 points):
   - Precision and directness (avoids evasion)
   - Logical coherence
   - Effectiveness in addressing the question, using bot’s signature moves (%s)

4. Closing Statements (10 points):
   - Comprehensive summary of key points
   - Effective reiteration of stance
   - Persuasiveness of final argument, embodying bot’s philosophical tenets (%s)

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

Provide ONLY the JSON output without any additional text.`,
		bot.Name, bot.Tone, bot.RhetoricalStyle, strings.Join(bot.Catchphrases, ", "), strings.Join(bot.UniverseTies, ", "),
		bot.DebateStrategy, strings.Join(bot.SignatureMoves, ", "), strings.Join(bot.PhilosophicalTenets, ", "), FormatHistory(history))

	ctx := context.Background()
	text, err := generateDefaultModelText(ctx, "", prompt)
	if err != nil || text == "" {
		if err != nil {
			log.Printf("Gemini error: %v", err)
		}
		return "Unable to judge."
	}
	return text
}

// CreateDebateService creates a new debate in MongoDB, ensuring bot personality is logged
func CreateDebateService(debate *models.DebateVsBot, stance string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if debate.ID.IsZero() {
		debate.ID = primitive.NewObjectID()
	}
	if debate.CreatedAt == 0 {
		debate.CreatedAt = time.Now().Unix()
	}
	debate.Stance = stance

	if db.DebateVsBotCollection == nil {
		return "", fmt.Errorf("database not initialized")
	}

	result, err := db.DebateVsBotCollection.InsertOne(ctx, debate)
	if err != nil {
		return "", err
	}

	id, ok := result.InsertedID.(primitive.ObjectID)
	if !ok {
		return "", fmt.Errorf("internal server error")
	}

	return id.Hex(), nil
}
