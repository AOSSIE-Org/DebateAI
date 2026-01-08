package structs

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
)


type Message struct {
	Type           string `json:"type"`
	Room           string `json:"room,omitempty"`
	Username       string `json:"username,omitempty"`
	UserID         string `json:"userId,omitempty"`
	Content        string `json:"content,omitempty"`
	OriginalText   string `json:"originalText,omitempty"`   
	SenderLanguage string `json:"senderLanguage,omitempty"` 
	TargetLanguage string `json:"targetLanguage,omitempty"` 
	IsTranslated   bool   `json:"isTranslated,omitempty"`   
	Timestamp      int64  `json:"timestamp,omitempty"`
}

type CurrentStatus struct {
	CurrentTurn string `json:"currentTurn,omitempty"`
	Section     string `json:"section"`
	Duration    int    `json:"duration,omitempty"`
}

type Section struct {
	Name     string
	Duration time.Duration
}

type DebateFormat struct {
	Sections []Section `json:"sections"`
}

type Room struct {
	Users         map[string]*websocket.Conn
	Mutex         sync.Mutex
	DebateFmt     DebateFormat
	DebateStarted bool
	CurrentTurn   string
	TurnActive    map[string]bool
}

type ChatMessage struct {
	Sender  string `json:"sender"`
	Message string `json:"message"`
}

type GameResult struct {
	WinnerUserId      string `json:"winnerUserId"`
	Points            int    `json:"points"`
	TotalPoints       int    `json:"totalPoints"`
	EvaluationMessage string `json:"evaluationMessage"`
}

type TranscriptionResponse struct {
	Transcription string `json:"transcription"`
	Error         string `json:"error"`
}
