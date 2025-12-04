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
	"github.com/google/generative-ai-go/genai"
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

// constructPrompt builds a prompt that adjusts based on bot personality, debate topic, history,
// extra context, and uses the provided stance directly. It includes phase-specific instructions
// and leverages InteractionModifiers and PhilosophicalTenets for tailored responses.
func constructPrompt(bot BotPersonality, topic string, history []models.Message, stance, extraContext string, maxWords int) string {
	// Level-based instructions
	levelInstructions := ""
	switch strings.ToLower(bot.Level) {
	case "easy":
		levelInstructions = "Use simple, accessible language with basic arguments suitable for beginners. Avoid complex concepts."
	case "medium":
		levelInstructions = "Use clear, moderately complex language with well-structured reasoning and supporting details."
	case "hard":
		levelInstructions = "Employ complex, evidence-based arguments with precise details and in-depth reasoning."
	case "expert":
		levelInstructions = "Craft highly sophisticated, strategic arguments with layered reasoning and authoritative evidence."
	case "legends":
		levelInstructions = "Deliver masterful, nuanced arguments with exceptional depth, creativity, and rhetorical flair, embodying the character’s iconic persona."
	default:
		levelInstructions = "Use clear and balanced language appropriate for a general audience."
	}

	// Detailed personality instructions
	personalityInstructions := fmt.Sprintf(
		`Embody the following personality traits to sound exactly like %s:
- Tone: %s
- Rhetorical Style: %s
- Linguistic Quirks: %s
- Emotional Tendencies: %s
- Debate Strategy: %s
- Catchphrases: Integrate these naturally: %s
- Mannerisms: %s
- Intellectual Approach: %s
- Moral Alignment: %s
- Interaction Style: %s
- Philosophical Tenets: Guide your arguments with these beliefs: %s
- Universe Ties: Reference these elements contextually: %s
Example of your style: "%s"
Your responses must reflect this persona consistently, as if you are the character themselves, weaving in universe-specific references for Legends characters (e.g., Dagobah for Yoda, Stark Industries for Tony Stark).`,
		bot.Name, bot.Tone, bot.RhetoricalStyle, bot.LinguisticQuirks, bot.EmotionalTendencies, bot.DebateStrategy,
		strings.Join(bot.Catchphrases, ", "), bot.Mannerisms, bot.IntellectualApproach, bot.MoralAlignment, bot.InteractionStyle,
		strings.Join(bot.PhilosophicalTenets, ", "), strings.Join(bot.UniverseTies, ", "), bot.ExampleDialogue,
	)

	// Interaction modifier based on opponent's style
	opponentStyle := "Neutral opponent"
	if len(history) > 0 {
		lastUserMsg := findLastUserMessage(history)
		if lastUserMsg.Text != "" {
			opponentStyle = inferOpponentStyle(lastUserMsg.Text)
		}
	}
	modifierInstruction := ""
	if modifier, ok := bot.InteractionModifiers[opponentStyle]; ok {
		modifierInstruction = fmt.Sprintf("Adjust your response based on the opponent’s style (%s): %s", opponentStyle, modifier)
	}

	// Word limit instruction
	limitInstruction := ""
	if maxWords > 0 {
		limitInstruction = fmt.Sprintf("Limit your response to %d words.", maxWords)
	}

	// Base instruction for all responses
	baseInstruction := "Provide only your own argument without simulating an opponent’s dialogue. " +
		"If the user’s input is unclear, off-topic, or empty, respond with a personality-appropriate clarification request, e.g., for Yoda: 'Clouded, your point is, young one. Clarify, you must.'"

	// Handle opening statement phase
	if len(history) == 0 || len(history) == 1 {
		phaseInstruction := "This is the Opening Statement phase. Introduce the topic, clearly state your stance, and outline the advantages or key points supporting your position, using your personality’s rhetorical style and universe ties."
		return fmt.Sprintf(
			`You are %s, a %s-level debate bot arguing %s the topic "%s".
Your debating style must strictly adhere to the following guidelines:
- Level Instructions: %s
- Personality Instructions: %s
- Interaction Modifier: %s
Your stance is: %s.
%s
%s
%s
Provide an opening statement that embodies your persona and stance.
[Your opening argument]
%s %s`,
			bot.Name, bot.Level, stance, topic,
			levelInstructions,
			personalityInstructions,
			modifierInstruction,
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

	// For subsequent turns, determine phase and adjust instructions
	lastUserMsg := findLastUserMessage(history)
	userText := strings.TrimSpace(lastUserMsg.Text)
	if userText == "" {
		userText = "It appears you didn’t say anything."
	}
	// Normalize phase names
	currentPhase := lastUserMsg.Phase
	phaseNormalized := strings.ToLower(currentPhase)
	if phaseNormalized == "first rebuttal" || phaseNormalized == "second rebuttal" {
		currentPhase = "Cross Examination"
	}

	// Phase-specific instructions
	var phaseInstruction string
	switch strings.ToLower(currentPhase) {
	case "opening statement":
		phaseInstruction = "This is the Opening Statement phase. Respond to the user’s opening statement by reinforcing your stance and highlighting key points, using your personality’s rhetorical style."
	case "cross examination":
		phaseInstruction = "This is the Cross Examination phase. Respond to the user’s question or point directly, then pose a relevant question to advance the debate, reflecting your persona’s strategy and catchphrases."
	case "closing statement":
		phaseInstruction = "This is the Closing Statement phase. Summarize the key points from the debate, reinforce your stance with a personality-driven flourish, and conclude persuasively, tying back to your philosophical tenets."
	default:
		phaseInstruction = fmt.Sprintf("This is the %s phase. Respond to the user’s latest point in a way that advances the debate, using your persona’s signature moves and universe ties.", currentPhase)
	}

	return fmt.Sprintf(
		`You are %s, a %s-level debate bot arguing %s the topic "%s".
Your debating style must strictly adhere to the following guidelines:
- Level Instructions: %s
- Personality Instructions: %s
- Interaction Modifier: %s
Your stance is: %s.
%s
%s
Based on the debate transcript below, continue the discussion in the %s phase by responding directly to the user’s message.
User’s message: "%s"
%s
Transcript:
%s
Please provide your full argument.`,
		bot.Name, bot.Level, stance, topic,
		levelInstructions,
		personalityInstructions,
		modifierInstruction,
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
// It uses the bot’s personality to handle errors and responses vividly.
func GenerateBotResponse(botName, botLevel, topic string, history []models.Message, stance, extraContext string, maxWords int) string {
	if geminiClient == nil {
		return personalityErrorResponse(botName, "My systems are offline, it seems.")
	}

	bot := GetBotPersonality(botName)
	// Construct prompt with enhanced personality integration
	prompt := constructPrompt(bot, topic, history, stance, extraContext, maxWords)

	ctx := context.Background()
	response, err := generateDefaultModelText(ctx, prompt)
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
	text, err := generateDefaultModelText(ctx, prompt)
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
