package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	appConfig "arguehub/config"
)

type AIRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type LLM struct {
	APIKey   string
	URL      string
	Provider string
}

func NewLLM(apiKey string) *LLM {
	provider := detectProvider(apiKey)
	baseURL := getProviderURL(provider)

	return &LLM{
		APIKey:   apiKey,
		URL:      baseURL,
		Provider: provider,
	}
}

func detectProvider(apiKey string) string {
	if strings.HasPrefix(apiKey, "gsk_") {
		return "groq"
	} else if strings.HasPrefix(apiKey, "sk-") || strings.HasPrefix(apiKey, "sk-proj-") {
		return "openai"
	}
	return "openai"
}

func getProviderURL(provider string) string {
	switch provider {
	case "groq":
		return "https://api.groq.com/openai/v1/chat/completions"
	case "openai":
		return "https://api.openai.com/v1/chat/completions"
	default:
		return "https://api.openai.com/v1/chat/completions"
	}
}

func getProviderModel(provider string, requestedModel string) string {

	if provider == "groq" {
		if strings.Contains(requestedModel, "llama") ||
			strings.Contains(requestedModel, "mixtral") ||
			strings.Contains(requestedModel, "gemma") {
			return requestedModel
		}
		return "llama3-8b-8192"
	}

	return requestedModel
}

func (l *LLM) Chat(model, developerPrompt, userMessage string) (string, error) {
	modelToUse := getProviderModel(l.Provider, model)

	messages := []Message{
		{Role: "system", Content: developerPrompt},
		{Role: "user", Content: userMessage},
	}

	requestData := AIRequest{
		Model:    modelToUse,
		Messages: messages,
	}

	payload, err := json.Marshal(requestData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request data: %w", err)
	}

	req, err := http.NewRequest("POST", l.URL, bytes.NewBuffer(payload))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", l.APIKey))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error (%s): %s", l.Provider, string(body))
	}

	var responseData struct {
		Choices []struct {
			Message struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(body, &responseData); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if len(responseData.Choices) > 0 {
		return responseData.Choices[0].Message.Content, nil
	}

	return "", fmt.Errorf("unexpected response format from %s", l.Provider)
}

type DebateFormat struct {
	Sections    []string `json:"sections"`
	CurrentTurn string   `json:"currentTurn"` // User ID of the current user's turn.
}

type DebateContent map[string]map[string]string

func evaluate(llm *LLM, format DebateFormat, content DebateContent) (string, error) {
	var debateTranscript strings.Builder
	for _, section := range format.Sections {
		debateTranscript.WriteString(fmt.Sprintf("Section: %s\n", section))
		for participantName, participantContent := range content {
			if text, exists := participantContent[section]; exists {
				debateTranscript.WriteString(fmt.Sprintf("%s: %s\n", participantName, text))
			} else {
				debateTranscript.WriteString(fmt.Sprintf("%s: No content provided for this section.\n", participantName))
			}
		}
		debateTranscript.WriteString("\n")
	}

	developerInstructions := "You are an expert debate evaluator. Below is a transcript of a debate between two participants. Please compare their arguments, determine who won the debate, and explain your reasoning.\n\nthe last line should be the final answer, the name of the participant"
	prompt := debateTranscript.String()

	defaultModel := "gpt-4o"
	if llm.Provider == "groq" {
		defaultModel = "llama3-8b-8192"
	}

	response, err := llm.Chat(defaultModel, developerInstructions, prompt)
	if err != nil {
		return "", err
	}

	return response, nil
}

func main() {
	rootPath, err := os.Getwd()
	if err != nil {
		log.Printf("Error getting the current working directory: %v\n", err)
		return
	}

	configPath := filepath.Join(rootPath, "config", "config.prod.yml")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		fmt.Printf("Config file not found: %s\n", configPath)
		return
	}

	// Load your configuration
	cfg, err := appConfig.LoadConfig(configPath)
	if err != nil {
		fmt.Printf("Error loading config: %v\n", err)
		return
	}

	if cfg.LLM.APIKey == "" {
		fmt.Println("LLM API key is not set in configuration")
		return
	}

	llmClient := NewLLM(cfg.LLM.APIKey)
	fmt.Printf("Using LLM provider: %s\n", llmClient.Provider)

	debateSections := []string{"opening", "constructive argument", "rebuttal", "closing"}
	debateContent := DebateContent{
		"Participant1": {
			"opening":               "Participant 1: Good evening, everyone. Today, I stand firmly on the side of nature in the nature vs. nurture debate. Our genetic makeup profoundly influences who we are, from our physical characteristics to innate talents and predispositions. Scientific studies, such as those involving identical twins raised apart, show remarkable similarities in traits like intelligence, temperament, and even preferences. This demonstrates that nature plays a crucial role in shaping our identity.",
			"constructive argument": "Participant 1: Consider the field of behavioral genetics, which has consistently found strong correlations between genetics and traits like personality, intelligence, and even susceptibility to certain mental health conditions. Furthermore, evolutionary psychology highlights how traits passed down through generations influence our behavior. For example, fight-or-flight responses are innate survival mechanisms, hardwired into our DNA. The evidence clearly indicates that nature is the dominant factor in determining who we are.",
			"rebuttal":              "Participant 1: My opponent argues that environment and upbringing shape individuals significantly. While I agree that nurture has an influence, it often acts as a moderator rather than a creator of traits. For example, a child with a natural aptitude for music will excel when given the right environment, but that aptitude originates from their genetic predisposition. Without nature providing the foundation, nurture alone would not yield such results.",
			"closing":               "Participant 1: In conclusion, the evidence overwhelmingly supports the idea that nature is the primary determinant of who we are. While nurture can shape and refine, it is our genetic blueprint that sets the stage for our potential. Thank you.",
		},
		"Participant2": {
			"opening":               "Participant 2: Good evening, everyone. I firmly believe that nurture plays a more significant role in shaping who we are. Our experiences, education, and environment define our abilities, beliefs, and personalities. Studies have shown that children raised in enriched environments tend to perform better academically and socially, regardless of their genetic background. This clearly demonstrates the power of nurture.",
			"constructive argument": "Participant 2: Consider how culture and upbringing influence language, behavior, and values. A child born with a genetic predisposition for intelligence will not reach their full potential without proper education and support. Moreover, cases of children overcoming genetic disadvantages through determination and favorable environments underscore the importance of nurture. The famous case of Albert Einstein, who was considered a slow learner as a child but thrived due to a nurturing environment, is a testament to this.",
			"rebuttal":              "Participant 2: My opponent emphasizes genetic influence but overlooks the dynamic role of environment. For instance, identical twins raised apart often show differences in attitudes, hobbies, and career choices due to their distinct environments. Genes provide a starting point, but it is nurture that refines and ultimately shapes those traits into tangible outcomes. Without proper nurturing, even the most promising genetic traits can remain dormant.",
			"closing":               "Participant 2: In conclusion, while nature provides the raw material, it is nurture that sculpts it into something meaningful. The environment, experiences, and opportunities we encounter ultimately determine who we become. Thank you.",
		},
	}

	debateFormat := DebateFormat{Sections: debateSections}

	result, err := evaluate(llmClient, debateFormat, debateContent)
	if err != nil {
		fmt.Printf("Error during evaluation: %v\n", err)
		return
	}

	fmt.Println("Evaluation Result:")
	fmt.Println(result)
}
