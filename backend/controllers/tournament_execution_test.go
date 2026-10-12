package controllers

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"arguehub/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestTournamentExecutionResponseRedactsOtherTranscripts(t *testing.T) {
	host, member := primitive.NewObjectID(), primitive.NewObjectID()
	tournament := models.Tournament{ID: primitive.NewObjectID(), HostID: host, InviteCode: "123456", Execution: &models.TournamentExecution{RunID: primitive.NewObjectID(), State: models.ExecutionRunning, Phases: []models.TournamentPhase{{Round: "opening_statement_for", Slots: []models.TournamentSubmissionSlot{{UserID: host, Status: models.SlotSubmitted, Content: "host-secret-text", ContentHash: "host-secret-hash"}, {UserID: member, Status: models.SlotSubmitted, Content: "own-text", ContentHash: "own-hash"}}}}}}
	encoded, err := json.Marshal(toTournamentExecutionResponse(tournament, member, time.Now()))
	if err != nil {
		t.Fatal(err)
	}
	text := string(encoded)
	if strings.Contains(text, "host-secret") || strings.Contains(text, "inviteCode") || strings.Contains(text, "joinRequests") {
		t.Fatal("other-user transcript/management data leaked")
	}
	if !strings.Contains(text, "own-text") || !strings.Contains(text, "own-hash") {
		t.Fatal("own receipt/text missing")
	}
}
