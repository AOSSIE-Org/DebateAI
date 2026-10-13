package routes

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestTournamentRoutesRejectInvalidRequests(t *testing.T) {
	router := gin.New()
	SetupTournamentRoutes(router.Group("/"))

	// These failures occur before database access and verify reachable API handlers.
	tests := []struct {
		method string
		path   string
		body   string
		status int
	}{
		{http.MethodPost, "/tournaments", `{}`, http.StatusBadRequest},
		{http.MethodDelete, "/tournaments/not-an-id", "", http.StatusBadRequest},
		{http.MethodGet, "/tournaments", "", http.StatusUnauthorized},
		{http.MethodGet, "/tournaments/not-an-id", "", http.StatusUnauthorized},
		{http.MethodPatch, "/tournaments/not-an-id", `{}`, http.StatusBadRequest},
		{http.MethodPost, "/tournaments/join", `{}`, http.StatusUnauthorized},
		{http.MethodPost, "/tournaments/not-an-id/join", `{}`, http.StatusUnauthorized},
		{http.MethodPatch, "/tournaments/not-an-id/stance", `{}`, http.StatusUnauthorized},
		{http.MethodPatch, "/tournaments/not-an-id/request/not-an-id", `{}`, http.StatusUnauthorized},
		{http.MethodGet, "/tournaments/not-an-id/request", "", http.StatusUnauthorized},
		{http.MethodGet, "/tournaments/not-an-id/requests", "", http.StatusUnauthorized},
		{http.MethodPost, "/tournaments/not-an-id/start", `{}`, http.StatusUnauthorized},
		{http.MethodGet, "/tournaments/not-an-id/execution", "", http.StatusUnauthorized},
		{http.MethodGet, "/tournaments/not-an-id/evaluation", "", http.StatusUnauthorized},
		{http.MethodPost, "/tournaments/not-an-id/transcript", `{}`, http.StatusUnauthorized},
	}
	for _, test := range tests {
		t.Run(test.method+" "+test.path, func(t *testing.T) {
			request := httptest.NewRequest(test.method, test.path, strings.NewReader(test.body))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != test.status {
				t.Fatalf("got HTTP %d, want %d: %s", response.Code, test.status, response.Body.String())
			}
		})
	}
}

func TestTournamentAdmissionRejectsInvalidPayloads(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("userID", primitive.NewObjectID()); c.Set("displayName", "Member") })
	SetupTournamentRoutes(router.Group("/"))
	id := primitive.NewObjectID().Hex()
	tests := []struct {
		path   string
		method string
		body   string
	}{
		{"/tournaments/" + id + "/join", "POST", `null`},
		{"/tournaments/" + id + "/join", "POST", ` `},
		{"/tournaments/" + id + "/join", "POST", `{} {}`},
		{"/tournaments/" + id + "/join", "POST", strings.Repeat(" ", 4097)},
		{"/tournaments/" + id + "/join", "POST", `{"userId":"forged"}`},
		{"/tournaments/join", "POST", `{"inviteCode":"123"}`},
		{"/tournaments/join", "POST", `{"inviteCode":"123456","name":"forged"}`},
		{"/tournaments/" + id + "/stance", "PATCH", `{"stance":"neutral"}`},
		{"/tournaments/" + id + "/stance", "PATCH", `{"stance":"for"} {}`},
		{"/tournaments/" + id + "/stance", "PATCH", `{"stance":"against","stance":"for"}`},
		{"/tournaments/" + id + "/stance", "PATCH", `{"stance":"against","STANCE":"for"}`},
		{"/tournaments/" + id + "/stance", "PATCH", `{"stance":"against","\u017ftance":"for"}`},
		{"/tournaments/join", "POST", `{"inviteCode":"123456","inviteCode":"654321"}`},
		{"/tournaments/" + id + "/request/" + id, "PATCH", `{"status":"pending"}`},
		{"/tournaments/" + id + "/request/" + id, "PATCH", `{"action":"approved"}`},
		{"/tournaments/" + id + "/request/" + id, "PATCH", `{"action":"approve","status":"rejected"}`},
		{"/tournaments/" + id + "/request/" + id, "PATCH", `{"action":"approve","status":"approved"}`},
		{"/tournaments/" + id + "/request/" + id, "PATCH", `{"action":"reject","action":"approve"}`},
		{"/tournaments/" + id + "/request/" + id, "PATCH", `{"action":"approve","userId":"forged"}`},
		{"/tournaments/" + id + "/request/" + id, "PATCH", `{"action":"approve","requestCreatedAt":"invalid"}`},
		{"/tournaments/" + id + "/request/" + id, "PATCH", `{}`},
		{"/tournaments/" + id + "/stance", "PATCH", strings.Repeat("x", 4097)},
		{"/tournaments/" + id + "/start", "POST", `{"hostId":"forged"}`},
		{"/tournaments/" + id + "/start", "POST", `null`},
		{"/tournaments/" + id + "/transcript", "POST", `{}`},
		{"/tournaments/" + id + "/transcript", "POST", `{"runId":"` + id + `","round":"opening_statement_for","content":"first","content":"second"}`},
		{"/tournaments/" + id + "/transcript", "POST", `{"runId":"` + id + `","round":"unknown","content":"text"}`},
		{"/tournaments/" + id + "/transcript", "POST", `{"runId":"` + id + `","round":"opening_statement_for","content":"text","userId":"forged"}`},
		{"/tournaments/" + id + "/transcript", "POST", `{"runId":"` + id + `","round":"opening_statement_for","content":" "}`},
		{"/tournaments/" + id + "/transcript", "POST", `{"runId":"` + id + `","round":"opening_statement_for","content":"` + strings.Repeat("x", 8193) + `"}`},
		{"/tournaments/" + id + "/transcript", "POST", strings.Repeat("x", 16385)},
		{"/tournaments/" + id + "/transcript", "POST", `{"runId":"` + id + `","round":"opening_statement_for","content":"` + string([]byte{0xff}) + `"}`},
	}
	for _, test := range tests {
		t.Run(test.path+test.body[:min(len(test.body), 20)], func(t *testing.T) {
			response := httptest.NewRecorder()
			request := httptest.NewRequest(test.method, test.path, strings.NewReader(test.body))
			request.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(response, request)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("got %d: %s", response.Code, response.Body.String())
			}
		})
	}
}

func TestTournamentPublicJoinAcceptsLegacyEmptyBody(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", primitive.NewObjectID())
		c.Set("displayName", "Member")
	})
	SetupTournamentRoutes(router.Group("/"))
	path := "/tournaments/" + primitive.NewObjectID().Hex() + "/join"
	for _, body := range []string{"", `{}`} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, path, strings.NewReader(body)))
		// Valid admission reaches storage; this test intentionally has no database.
		if response.Code != http.StatusServiceUnavailable {
			t.Fatalf("body %q: got %d, want storage access: %s", body, response.Code, response.Body.String())
		}
	}
}

func TestTournamentExecutionResponsesAreNotCacheable(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("userID", primitive.NewObjectID()) })
	SetupTournamentRoutes(router.Group("/"))
	for _, endpoint := range []struct{ method, path string }{
		{"GET", "/tournaments/not-an-id/execution"},
		{"POST", "/tournaments/not-an-id/start"},
		{"POST", "/tournaments/not-an-id/transcript"},
	} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(endpoint.method, endpoint.path, strings.NewReader(`{}`)))
		if response.Code != http.StatusBadRequest || response.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("%s: status %d, cache policy %q", endpoint.path, response.Code, response.Header().Get("Cache-Control"))
		}
	}
}
