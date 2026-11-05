package controllers

import (
	"encoding/json"
	"testing"
	"time"

	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestIsTournamentCompleted(t *testing.T) {
	tests := []struct {
		name     string
		status   string
		expected bool
	}{
		{name: "completed", status: models.StatusCompleted, expected: true},
		{name: "live", status: models.StatusLive, expected: false},
		{name: "upcoming", status: models.StatusUpcoming, expected: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := isTournamentCompleted(models.Tournament{Status: test.status}); got != test.expected {
				t.Errorf("isTournamentCompleted() = %t, want %t", got, test.expected)
			}
		})
	}
}

func TestToTournamentResponse_HostCanSeeManagementFields(t *testing.T) {
	hostID := primitive.NewObjectID()

	tournament := models.Tournament{
		ID:         primitive.NewObjectID(),
		HostID:     hostID,
		Topic:      "AI in Education",
		Visibility: models.VisibilityPrivate,
		InviteCode: "SECRET123",
		JoinRequests: []models.JoinRequest{
			{
				UserID: primitive.NewObjectID(),
				Name:   "Test User",
				Status: models.JoinRequestPending,
			},
		},
		CreatedAt: time.Now(),
	}

	response := toTournamentResponse(tournament, true)

	if response.InviteCode != tournament.InviteCode {
		t.Errorf("host should receive invite code")
	}

	if len(response.JoinRequests) != 1 {
		t.Errorf("host should receive join requests; got %d", len(response.JoinRequests))
	}

	data, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("failed to marshal response: %v", err)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if _, exists := payload["inviteCode"]; !exists {
		t.Error("host response should contain inviteCode")
	}

	if _, exists := payload["joinRequests"]; !exists {
		t.Error("host response should contain joinRequests")
	}
}

func TestToTournamentResponse_NonHostCannotSeeManagementFields(t *testing.T) {
	tournament := models.Tournament{
		ID:         primitive.NewObjectID(),
		HostID:     primitive.NewObjectID(),
		Topic:      "AI in Education",
		Visibility: models.VisibilityPublic,
		InviteCode: "SECRET123",
		JoinRequests: []models.JoinRequest{
			{
				UserID: primitive.NewObjectID(),
				Name:   "Test User",
				Status: models.JoinRequestPending,
			},
		},
		CreatedAt: time.Now(),
	}

	response := toTournamentResponse(tournament, false)

	if response.InviteCode != "" {
		t.Error("non-host response must not contain an invite code")
	}

	if len(response.JoinRequests) != 0 {
		t.Error("non-host response must not contain join requests")
	}

	data, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("failed to marshal response: %v", err)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if _, exists := payload["inviteCode"]; exists {
		t.Error("non-host JSON must omit inviteCode")
	}

	if _, exists := payload["joinRequests"]; exists {
		t.Error("non-host JSON must omit joinRequests")
	}

	if payload["topic"] != tournament.Topic {
		t.Error("non-host response should preserve public tournament fields")
	}
}
