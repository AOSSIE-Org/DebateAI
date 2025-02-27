package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// TranscriptionResult represents the JSON response from the Python script
type TranscriptionResult struct {
	Transcription string `json:"transcription"`
}

const (
	ReadBufferSize  = 1024
	WriteBufferSize = 1024
)

type AIDebateRequest struct {
	Argument string `json:"argument"`
	Topic    string `json:"topic"`
}

type AIDebateResponse struct {
	CounterArgument string `json:"counter_argument"`
}

type AIAnalysisResponse struct {
	UserAnalysisPoints  string `json:"user_analysis_points"`
	UserAnalysisContent string `json:"user_analysis_content"`
}
type Section struct {
	Name     string
	Duration time.Duration
}

type DebateFormat struct {
	Sections []Section `json:"sections"`
}

func ChatWithOpenRouter(apiKey, model, systemPrompt, userInput string) (string, error) {
	type Message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}

	type OpenAIRequest struct {
		Model    string    `json:"model"`
		Messages []Message `json:"messages"`
	}

	type OpenAIResponse struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	messages := []Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userInput},
	}

	requestData := OpenAIRequest{
		Model:    model,
		Messages: messages,
	}
	payload, err := json.Marshal(requestData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request data: %w", err)
	}

	req, err := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewBuffer(payload))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

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
	fmt.Println("Raw response", string(body))

	var responseData OpenAIResponse
	if err := json.Unmarshal(body, &responseData); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if len(responseData.Choices) > 0 {
		return responseData.Choices[0].Message.Content, nil
	}

	return "", fmt.Errorf("unexpected response format")
}

func DebateHandler(ctx *gin.Context) {
	upgrader := websocket.Upgrader{
		CheckOrigin:       func(r *http.Request) bool { return true },
		ReadBufferSize:    ReadBufferSize,
		WriteBufferSize:   WriteBufferSize,
		EnableCompression: false,
	}
	conn, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		fmt.Println("Failed to upgrade WebSocket:", err)
		return
	}
	defer conn.Close()
	debateFormat := DebateFormat{
		Sections: []Section{
			{Name: "Opening", Duration: 60 * time.Second},
			{Name: "Rebuttal", Duration: 60 * time.Second},
			{Name: "Closing", Duration: 60 * time.Second},
		},
	}
	apiKey := "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"
	apiKey1 := "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"
	var userArguments string
	var topic string

	for _, section := range debateFormat.Sections {
		state := map[string]interface{}{
			"type":            "state_update",
			"current_section": section.Name,
			"time_remaining":  int(section.Duration.Seconds()),
		}
		if err := conn.WriteJSON(state); err != nil {
			fmt.Println("Error sending state:", err)
			return
		}
		messageChan := make(chan string, 1)
		errorChan := make(chan error, 1)
		go func() {
			_, message, err := conn.ReadMessage()
			if err != nil {
				errorChan <- err
				return
			}
			messageChan <- string(message)
		}()
		select {
		case userArgument := <-messageChan:
			userArguments += "\n" + section.Name + ": " + userArgument + "\n"
			// Get AI response for the argument
			response, err := ChatWithOpenRouter(apiKey, "meta-llama/llama-3.1-405b-instruct:free",
				"You are a professional debater.The debate is on the topic of "+topic+". Respond concisely to the user's argument with strong counterpoints.",
				userArgument)
			if err != nil {
				fmt.Println("AI debate error:", err)
				return
			}
			// Send AI response
			debateResponse := map[string]interface{}{
				"type":     "debate_response",
				"response": response,
			}
			if err := conn.WriteJSON(debateResponse); err != nil {
				fmt.Println("Error sending AI response:", err)
				return
			}
		case err := <-errorChan:
			fmt.Println("Error reading user input:", err)
			return
		case <-time.After(section.Duration):
			// If user doesn't respond in time, move to next section
			fmt.Println("User did not respond in time, moving to next section")
		}
	}
	// Final analysis
	if userArguments != " " {
		analysisResponse, _ := ChatWithOpenRouter(apiKey1, "sophosympatheia/rogue-rose-103b-v0.2:free",
			"You are a debate judge. Analyze the user's argument for structure, grammar, and improvements.",
			userArguments)
		analysisScore, _ := ChatWithOpenRouter(apiKey1, "sophosympatheia/rogue-rose-103b-v0.2:free",
			"You are a debate score judge. Provide a score out of 10 for the user's argument, output only the number.",
			userArguments)
		if err == nil {
			analysisData := map[string]interface{}{
				"type":                  "analysis_response",
				"user_analysis_points":  analysisScore,
				"user_analysis_content": analysisResponse,
			}
			if err := conn.WriteJSON(analysisData); err != nil {
				fmt.Println("Error sending analysis:", err)
			}
		}
	}
}
