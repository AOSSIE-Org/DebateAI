package routes

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type routeFixtureJudge struct{}

func (routeFixtureJudge) Metadata() (string, string) { return "fixture", "route-fixture-v1" }
func (routeFixtureJudge) Judge(_ context.Context, r services.TournamentJudgeRequest) ([]byte, error) {
	scores := []map[string]any{}
	for _, submission := range r.Submissions {
		scores = append(scores, map[string]any{"speaker": submission.Speaker, "criteria": map[string]int{"reasoning": 30, "relevance": 20, "phaseSkill": 20, "clarity": 10}, "explanation": "Mock response for route testing."})
	}
	return json.Marshal(map[string]any{"round": r.Round, "scores": scores})
}

func TestTournamentEvaluationContractMongo(t *testing.T) {
	uri := os.Getenv("TOURNAMENT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("set TOURNAMENT_TEST_MONGO_URI for isolated local evaluation route tests")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	database := client.Database("debateai_evaluation_route_test_" + primitive.NewObjectID().Hex())
	previous := db.MongoDatabase
	db.MongoDatabase = database
	t.Cleanup(func() {
		db.MongoDatabase = previous
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		_ = database.Drop(cleanup)
		_ = client.Disconnect(cleanup)
	})
	collection := database.Collection("tournaments")
	if err := db.EnsureTournamentIndexes(ctx, collection); err != nil {
		t.Fatal(err)
	}
	host, member, other := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	router := gin.New()
	router.Use(func(c *gin.Context) {
		id, err := primitive.ObjectIDFromHex(c.GetHeader("X-Test-Actor"))
		if err == nil {
			c.Set("userID", id)
		}
	})
	SetupTournamentRoutes(router.Group("/"))
	record := models.Tournament{ID: primitive.NewObjectID(), HostID: host, Topic: "Evaluation contract", Description: "Test", ModeratorName: "Host", Visibility: models.VisibilityPublic, Status: models.StatusLive, MinParticipants: 3, MaxParticipants: 3, Participants: []models.TournamentParticipant{{UserID: host, Name: "Host", Stance: models.StanceFor}, {UserID: member, Name: "Member", Stance: models.StanceAgainst}, {UserID: primitive.NewObjectID(), Name: "Third", Stance: models.StanceFor}}, CreatedAt: time.Now().UTC()}
	admission := services.TournamentService{Collection: collection}
	if err := admission.Create(ctx, &record); err != nil {
		t.Fatal(err)
	}
	request := func(actor primitive.ObjectID, path string, status int) map[string]json.RawMessage {
		t.Helper()
		response := httptest.NewRecorder()
		r := httptest.NewRequest("GET", path, nil)
		if !actor.IsZero() {
			r.Header.Set("X-Test-Actor", actor.Hex())
		}
		router.ServeHTTP(response, r)
		if response.Code != status {
			t.Fatalf("%s: got %d want %d: %s", path, response.Code, status, response.Body.String())
		}
		var result map[string]json.RawMessage
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if status == 200 || status == 202 {
			if response.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("evaluation response cacheable")
			}
			for _, key := range []string{"leaseToken", "leaseUntil", "inputHash", "lastErrorCode", "execution", "inviteCode", "joinRequests", "attempts", "content", "contentHash"} {
				if strings.Contains(response.Body.String(), `"`+key+`"`) {
					t.Fatalf("evaluation leaks %s", key)
				}
			}
		}
		return result
	}
	path := "/tournaments/" + record.ID.Hex() + "/evaluation"
	request(primitive.NilObjectID, path, 401)
	request(host, "/tournaments/not-an-id/evaluation", 400)
	request(host, "/tournaments/"+primitive.NewObjectID().Hex()+"/evaluation", 404)
	request(other, path, 403)
	if result := request(host, path, 200); string(result["state"]) != `"not_ready"` {
		t.Fatal("lobby fabricated evaluation")
	}
	now := time.Now().UTC().Truncate(time.Millisecond)
	execution := services.TournamentExecutionService{Collection: collection, Now: func() time.Time { return now }}
	started, _, err := execution.Start(ctx, record.ID, host)
	if err != nil {
		t.Fatal(err)
	}
	for phaseIndex, phase := range started.Execution.Phases {
		for slotIndex, slot := range phase.Slots {
			if phaseIndex == 7 && slotIndex == 0 {
				continue
			} // Explicitly exercise missing work through P2.
			if _, _, err := execution.Submit(ctx, record.ID, slot.UserID, started.Execution.RunID, phase.Round, "Immutable route-test argument.", ""); err != nil {
				t.Fatal(err)
			}
		}
	}
	now = now.Add(181 * time.Second)
	finished, err := execution.Advance(ctx, record.ID)
	if err != nil || finished.Execution.State != models.ExecutionFinished {
		t.Fatal("execution failed to finish")
	}
	pending := request(member, path, 202)
	var roster []models.TournamentParticipant
	var revision int64
	if json.Unmarshal(pending["roster"], &roster) != nil || json.Unmarshal(pending["revision"], &revision) != nil || len(roster) != 3 || roster[0].Name != "Host" || roster[0].Stance != models.StanceFor || revision != finished.Revision || string(pending["topic"]) != `"Evaluation contract"` {
		t.Fatal("P4 results metadata does not match frozen execution")
	}
	if string(pending["state"]) != `"pending"` || pending["winner"] != nil || string(pending["retrying"]) != "false" {
		t.Fatal("pending contract wrong")
	}
	var unchanged models.Tournament
	if err := collection.FindOne(ctx, bson.M{"_id": record.ID}).Decode(&unchanged); err != nil {
		t.Fatal(err)
	}
	if unchanged.Revision != finished.Revision || unchanged.Evaluation.Attempts != 0 {
		t.Fatal("GET started worker")
	}
	evaluator := services.TournamentEvaluationService{Collection: collection, Provider: routeFixtureJudge{}}
	claim, err := evaluator.Claim(ctx)
	if err != nil {
		t.Fatal(err)
	}
	running := request(host, path, 202)
	if string(running["state"]) != `"running"` || string(running["viewerId"]) != `"`+host.Hex()+`"` {
		t.Fatal("running identity contract wrong")
	}
	if changed, err := evaluator.ProcessClaim(ctx, claim); err != nil || !changed {
		t.Fatal(err)
	}
	completed := request(member, path, 200)
	if string(completed["state"]) != `"completed"` || completed["result"] == nil || completed["winner"] == nil || string(completed["provider"]) != `"fixture"` {
		t.Fatal("validated result missing")
	}
	var result models.EvaluationResult
	if err := json.Unmarshal(completed["result"], &result); err != nil {
		t.Fatal(err)
	}
	if len(result.ClosingStatementAgainst.Scores) != 1 || result.ClosingStatementAgainst.Scores[0].SubmissionStatus != models.SlotMissing || result.ClosingStatementAgainst.Scores[0].Score != 0 {
		t.Fatal("missing not serialized")
	}
	if _, err := collection.UpdateOne(ctx, bson.M{"_id": record.ID}, bson.M{"$set": bson.M{"visibility": models.VisibilityPrivate}}); err != nil {
		t.Fatal(err)
	}
	request(other, path, 404)
	request(member, path, 200)
	// Failed rows must redact any stale result and arbitrary raw diagnostics.
	if _, err := collection.UpdateOne(ctx, bson.M{"_id": record.ID}, bson.M{"$set": bson.M{"evaluation.state": models.EvaluationFailed, "evaluation.lastErrorCode": "SECRET diagnostic"}}); err != nil {
		t.Fatal(err)
	}
	failed := request(host, path, 200)
	if string(failed["errorCode"]) != `"evaluation_failed"` || failed["winner"] != nil || failed["result"] != nil || string(failed["retryable"]) != "false" {
		t.Fatal("unsafe failure result")
	}
	legacy := record
	legacy.ID = primitive.NewObjectID()
	legacy.Execution = nil
	legacy.Evaluation = nil
	legacy.Status = models.StatusCompleted
	legacy.Visibility = models.VisibilityPublic
	if _, err := collection.InsertOne(ctx, legacy); err != nil {
		t.Fatal(err)
	}
	legacyResult := request(host, "/tournaments/"+legacy.ID.Hex()+"/evaluation", 200)
	if string(legacyResult["state"]) != `"legacy_no_evaluation"` || legacyResult["winner"] != nil {
		t.Fatal("legacy result invented")
	}
}
