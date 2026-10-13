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
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func TestTournamentAdmissionContractMongo(t *testing.T) {
	uri := os.Getenv("TOURNAMENT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("set TOURNAMENT_TEST_MONGO_URI to an isolated local MongoDB")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	database := client.Database("debateai_tournament_route_test_" + primitive.NewObjectID().Hex())
	previous := db.MongoDatabase
	db.MongoDatabase = database
	t.Cleanup(func() {
		db.MongoDatabase = previous
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		_ = database.Drop(cleanup)
		_ = client.Disconnect(cleanup)
	})
	if err := db.EnsureTournamentIndexes(ctx, database.Collection("tournaments")); err != nil {
		t.Fatal(err)
	}
	host, member, outsider := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	router := gin.New()
	router.Use(func(c *gin.Context) {
		id, err := primitive.ObjectIDFromHex(c.GetHeader("X-Test-Actor"))
		if err == nil {
			c.Set("userID", id)
			c.Set("displayName", "Member name")
		}
	})
	SetupTournamentRoutes(router.Group("/"))
	s := services.TournamentService{Collection: database.Collection("tournaments")}
	original := models.Tournament{ID: primitive.NewObjectID(), HostID: host, Topic: "Contract", Description: "Test", ModeratorName: "Host", Visibility: models.VisibilityPrivate, Status: models.StatusLive, MinParticipants: 3, MaxParticipants: 3, Participants: []models.TournamentParticipant{{UserID: host, Name: "Host", Stance: models.StanceFor}}, CreatedAt: time.Now().UTC()}
	if err := s.Create(ctx, &original); err != nil {
		t.Fatal(err)
	}
	request := func(actor primitive.ObjectID, method, path, body string, expected int) map[string]json.RawMessage {
		t.Helper()
		response := httptest.NewRecorder()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("X-Test-Actor", actor.Hex())
		r.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(response, r)
		if response.Code != expected {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, response.Code, expected, response.Body.String())
		}
		var result map[string]json.RawMessage
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	root := "/tournaments/" + original.ID.Hex()
	decisionPath := root + "/request/" + member.Hex()
	request(outsider, "GET", root+"/requests", "", 404)
	first := request(member, "POST", "/tournaments/join", `{"inviteCode":"`+original.InviteCode+`"}`, 202)
	oldTime := string(first["requestCreatedAt"])
	list := request(host, "GET", root+"/requests", "", 200)
	if string(list["count"]) != "1" || list["inviteCode"] != nil || list["execution"] != nil {
		t.Fatal("pending list leaks management/run fields or wrong count")
	}
	rejected := request(host, "PATCH", decisionPath, `{"action":"reject","requestCreatedAt":`+oldTime+`}`, 200)
	if string(rejected["action"]) != `"reject"` || string(rejected["userId"]) != `"`+member.Hex()+`"` || rejected["id"] == nil {
		t.Fatal("compatibility decision response missing fields")
	}
	second := request(member, "POST", "/tournaments/join", `{"inviteCode":"`+original.InviteCode+`"}`, 202)
	if string(second["status"]) != `"pending"` || string(second["requestCreatedAt"]) == oldTime {
		t.Fatal("re-request did not open a fresh attempt")
	}
	request(host, "PATCH", decisionPath, `{"action":"approve","requestCreatedAt":`+oldTime+`}`, 409)
	request(host, "PATCH", decisionPath, `{"status":"approved","requestCreatedAt":`+string(second["requestCreatedAt"])+`}`, 200)
	request(host, "PATCH", decisionPath, `{"action":"approve"}`, 200)
	stance := request(member, "PATCH", root+"/stance", `{"stance":"against"}`, 200)
	if string(stance["stance"]) != `"against"` || stance["inviteCode"] != nil || stance["joinRequests"] != nil {
		t.Fatal("stance response compatibility/redaction failed")
	}
	request(member, "GET", root+"/requests", "", 403)
	empty := request(host, "GET", root+"/requests", "", 200)
	if string(empty["pendingRequests"]) != "[]" || string(empty["count"]) != "0" {
		t.Fatal("empty list must be an array")
	}
	if _, _, err := s.RequestPrivate(ctx, original.InviteCode, models.TournamentParticipant{UserID: outsider, Name: "Third"}); err != nil {
		t.Fatal(err)
	}
	request(host, "PATCH", root+"/request/"+outsider.Hex(), `{"action":"approve"}`, 200)
	request(outsider, "PATCH", root+"/stance", `{"stance":"for"}`, 200)
	request(host, "POST", root+"/start", `{}`, 201)
	request(member, "PATCH", root+"/stance", `{"stance":"for"}`, 409)
	request(host, "GET", root+"/requests", "", 200)
	request(primitive.NewObjectID(), "POST", "/tournaments/join", `{"inviteCode":"`+original.InviteCode+`"}`, 409)

	// Legacy requests lack createdAt; their DTO's zero timestamp is still a valid precondition.
	legacy := original
	legacy.ID = primitive.NewObjectID()
	legacy.Participants = []models.TournamentParticipant{{UserID: host, Name: "Host", Stance: models.StanceFor}}
	legacy.JoinRequests = []models.JoinRequest{{UserID: member, Name: "Legacy name", Status: models.JoinRequestPending}}
	if err := s.Create(ctx, &legacy); err != nil {
		t.Fatal(err)
	}
	request(host, "PATCH", "/tournaments/"+legacy.ID.Hex()+"/request/"+member.Hex(), `{"action":"approve","requestCreatedAt":"0001-01-01T00:00:00Z"}`, 200)

	public := models.Tournament{ID: primitive.NewObjectID(), HostID: host, Topic: "Legacy public join", Description: "Test", ModeratorName: "Host", Visibility: models.VisibilityPublic, Status: models.StatusLive, MinParticipants: 3, MaxParticipants: 3, Participants: []models.TournamentParticipant{{UserID: host, Name: "Host", Stance: models.StanceFor}}, CreatedAt: time.Now().UTC()}
	if err := s.Create(ctx, &public); err != nil {
		t.Fatal(err)
	}
	publicRoot := "/tournaments/" + public.ID.Hex()
	joined := request(member, "POST", publicRoot+"/join", "", 201)
	if string(joined["tournamentId"]) != `"`+public.ID.Hex()+`"` || string(joined["userId"]) != `"`+member.Hex()+`"` || joined["message"] == nil {
		t.Fatal("legacy public join receipt missing #671 fields")
	}
	request(member, "POST", publicRoot+"/join", `{}`, 200)
	request(member, "PATCH", publicRoot+"/stance", `{"stance":"against"}`, 200)
	request(outsider, "POST", publicRoot+"/join", "", 201)
	request(outsider, "PATCH", publicRoot+"/stance", `{"stance":"for"}`, 200)
	request(host, "POST", publicRoot+"/start", `{}`, 201)
	request(primitive.NewObjectID(), "POST", publicRoot+"/join", "", 409)
	request(member, "PATCH", publicRoot+"/stance", `{"stance":"for"}`, 409)
}
