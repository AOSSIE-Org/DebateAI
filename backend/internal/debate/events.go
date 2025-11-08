package debate

import (
	"encoding/json"
	"time"
)

// Event represents a debate event published to Redis Stream
type Event struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp int64           `json:"timestamp"`
}

// VotePayload represents a vote event payload
type VotePayload struct {
	PollID        string `json:"pollId"`
	Option        string `json:"option"`
	SpectatorHash string `json:"spectatorHash"`
	ClientEventID string `json:"clientEventId"`
	Timestamp     int64  `json:"timestamp"`
}

// QuestionPayload represents a question event payload
type QuestionPayload struct {
	QID           string `json:"qId"`
	Text          string `json:"text"`
	SpectatorHash string `json:"spectatorHash"`
	Timestamp     int64  `json:"timestamp"`
}

// ReactionPayload represents a reaction event payload
type ReactionPayload struct {
	Reaction      string `json:"reaction"`
	SpectatorHash string `json:"spectatorHash"`
	Timestamp     int64  `json:"timestamp"`
}

// PollSnapshotPayload represents a poll snapshot event payload
type PollSnapshotPayload struct {
	PollState   map[string]map[string]int64 `json:"pollState"`   // pollId -> option -> count
	VotersCount map[string]int64            `json:"votersCount"` // pollId -> count
	LastEventID string                      `json:"lastEventId,omitempty"`
}

// PresencePayload represents presence event payload
type PresencePayload struct {
	Connected int64 `json:"connected"`
}

// JoinPayload represents a join event from client
type JoinPayload struct {
	SpectatorID   string `json:"spectatorId,omitempty"`
	SpectatorHash string `json:"spectatorHash,omitempty"`
}

// ClientMessage represents a message from client
type ClientMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// NewEvent creates a new event with timestamp
func NewEvent(eventType string, payload interface{}) (*Event, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	return &Event{
		Type:      eventType,
		Payload:   payloadBytes,
		Timestamp: time.Now().Unix(),
	}, nil
}

// MarshalEvent marshals an event to JSON string for Redis Stream
func MarshalEvent(event *Event) (string, error) {
	b, err := json.Marshal(event)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// UnmarshalEvent unmarshals a JSON string to an Event
func UnmarshalEvent(data string) (*Event, error) {
	var event Event
	if err := json.Unmarshal([]byte(data), &event); err != nil {
		return nil, err
	}
	return &event, nil
}
