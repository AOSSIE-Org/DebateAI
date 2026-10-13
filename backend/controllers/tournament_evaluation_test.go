package controllers

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"arguehub/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestTournamentEvaluationDTOStates(t *testing.T) {
	actor := primitive.NewObjectID()
	now := time.Now().UTC()
	for _, state := range []string{models.EvaluationPending, models.EvaluationRunning, models.EvaluationFailed, models.EvaluationCompleted, "unknown"} {
		record := models.Tournament{ID: primitive.NewObjectID(), Evaluation: &models.TournamentEvaluation{State: state, RunID: primitive.NewObjectID(), Attempts: 2, NextAttemptAt: &now, LeaseToken: "secret", InputHash: "internal", LastErrorCode: "secret raw error", Result: &models.EvaluationResult{}, Winner: &models.Winner{Side: "for"}}}
		status, response := toTournamentEvaluationResponse(record, actor)
		raw, _ := json.Marshal(response)
		if strings.Contains(string(raw), "secret") || strings.Contains(string(raw), "internal") {
			t.Fatal("internal metadata leaked")
		}
		if state == models.EvaluationPending || state == models.EvaluationRunning {
			if status != 202 || !response.Retrying || response.Result != nil || response.Winner != nil {
				t.Fatal("pending exposes stale result")
			}
		} else if status != 200 || response.Result != nil || response.Winner != nil || response.Retryable {
			t.Fatal("invalid completed/failed result exposed")
		}
	}
}

func TestTournamentEvaluationDTOUsesFrozenRoster(t *testing.T) {
	actor := primitive.NewObjectID()
	record := models.Tournament{ID: primitive.NewObjectID(), Topic: "Frozen topic", Revision: 23,
		Participants: []models.TournamentParticipant{{UserID: actor, Name: "Changed name", Stance: "against"}},
		Execution:    &models.TournamentExecution{Roster: []models.TournamentParticipant{{UserID: actor, Name: "Frozen name", Stance: "for"}}},
	}
	_, response := toTournamentEvaluationResponse(record, actor)
	if response.Topic != record.Topic || response.Revision != 23 || len(response.Roster) != 1 || response.Roster[0].Name != "Frozen name" || response.Roster[0].Stance != "for" {
		t.Fatal("results identity or frozen roster is incorrect")
	}
	response.Roster[0].Name = "DTO mutation"
	if record.Execution.Roster[0].Name != "Frozen name" {
		t.Fatal("DTO aliases stored roster")
	}
	_, empty := toTournamentEvaluationResponse(models.Tournament{ID: primitive.NewObjectID()}, actor)
	raw, err := json.Marshal(empty)
	if err != nil || !strings.Contains(string(raw), `"roster":[]`) {
		t.Fatal("empty roster must be an array")
	}
}
