package tests

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"arguehub/controllers"
	"arguehub/db"
	"arguehub/internal/testkit"
	"arguehub/models"
	"arguehub/routes"
	"arguehub/structs"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestAuthRouteValidation(t *testing.T) {
	router := newPublicRouter()

	cases := []struct {
		name       string
		method     string
		path       string
		body       any
		headers    map[string]string
		wantStatus int
		wantError  string
	}{
		{name: "signup empty", method: http.MethodPost, path: "/signup", body: "{}", wantStatus: http.StatusBadRequest, wantError: "Invalid input"},
		{name: "signup bad email", method: http.MethodPost, path: "/signup", body: structs.SignUpRequest{Email: "not-an-email", Password: "Password123!"}, wantStatus: http.StatusBadRequest, wantError: "Invalid input"},
		{name: "signup short password", method: http.MethodPost, path: "/signup", body: structs.SignUpRequest{Email: "test@example.com", Password: "short"}, wantStatus: http.StatusBadRequest, wantError: "Invalid input"},
		{name: "signup malformed", method: http.MethodPost, path: "/signup", body: "{malformed-json: true", wantStatus: http.StatusBadRequest, wantError: "Invalid input"},
		{name: "login empty", method: http.MethodPost, path: "/login", body: "{}", wantStatus: http.StatusBadRequest, wantError: "Invalid input"},
		{name: "login missing password", method: http.MethodPost, path: "/login", body: map[string]string{"email": "valid@email.com"}, wantStatus: http.StatusBadRequest, wantError: "Invalid input"},
		{name: "login short password", method: http.MethodPost, path: "/login", body: structs.LoginRequest{Email: "valid@email.com", Password: "short"}, wantStatus: http.StatusBadRequest, wantError: "Invalid input"},
		{name: "verify email missing code", method: http.MethodPost, path: "/verifyEmail", body: structs.VerifyEmailRequest{Email: "test@example.com", ConfirmationCode: ""}, wantStatus: http.StatusBadRequest, wantError: "Invalid input"},
		{name: "google login missing token", method: http.MethodPost, path: "/googleLogin", body: map[string]string{}, wantStatus: http.StatusBadRequest, wantError: "Invalid input"},
		{name: "forgot password bad email", method: http.MethodPost, path: "/forgotPassword", body: map[string]string{"email": "nope"}, wantStatus: http.StatusBadRequest, wantError: "Invalid input"},
		{name: "resend verification empty", method: http.MethodPost, path: "/resendVerification", body: "{}", wantStatus: http.StatusBadRequest, wantError: "Invalid input"},
		{name: "verify token missing header", method: http.MethodPost, path: "/verifyToken", wantStatus: http.StatusUnauthorized, wantError: "Missing token"},
		{name: "verify token wrong scheme", method: http.MethodPost, path: "/verifyToken", headers: map[string]string{"Authorization": "Basic 12345"}, wantStatus: http.StatusBadRequest, wantError: "Invalid token format"},
		{name: "verify token garbage", method: http.MethodPost, path: "/verifyToken", headers: map[string]string{"Authorization": "Bearer invalid.jwt.token"}, wantStatus: http.StatusUnauthorized, wantError: "Invalid or expired token"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := perform(router, tc.method, tc.path, tc.body, tc.headers)
			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d, body %s", rec.Code, tc.wantStatus, rec.Body.String())
			}
			if got := errorText(t, rec); got != tc.wantError {
				t.Fatalf("error = %q, want %q", got, tc.wantError)
			}
		})
	}
}

func TestAuthMiddlewareGuards(t *testing.T) {
	router := newAppRouter()

	t.Run("missing header", func(t *testing.T) {
		rec := perform(router, http.MethodPut, "/user/updateprofile", map[string]string{"bio": "hello"}, nil)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
		}
		if got := errorText(t, rec); got != "Authorization header is required" {
			t.Fatalf("error = %q", got)
		}
	})

	t.Run("malformed scheme", func(t *testing.T) {
		rec := perform(router, http.MethodPut, "/user/updateprofile", map[string]string{"bio": "hello"}, map[string]string{
			"Authorization": "Basic abc",
		})
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
		}
		if got := errorText(t, rec); got != "Invalid token format" {
			t.Fatalf("error = %q", got)
		}
	})

	t.Run("garbage token", func(t *testing.T) {
		rec := perform(router, http.MethodPut, "/user/updateprofile", map[string]string{"bio": "hello"}, map[string]string{
			"Authorization": "Bearer not-a-token",
		})
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("wrong secret", func(t *testing.T) {
		token := signSubjectToken(t, "user@debateai.test", time.Now().Add(time.Hour))
		token = token[:len(token)-4] + "xxxx"
		rec := perform(router, http.MethodPut, "/user/updateprofile", map[string]string{"bio": "hello"}, map[string]string{
			"Authorization": "Bearer " + token,
		})
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("expired token", func(t *testing.T) {
		token := signSubjectToken(t, "user@debateai.test", time.Now().Add(-time.Minute))
		rec := perform(router, http.MethodPut, "/user/updateprofile", map[string]string{"bio": "hello"}, map[string]string{
			"Authorization": "Bearer " + token,
		})
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
		}
		body := decodeBody(t, rec)
		message, _ := body["message"].(string)
		if !strings.Contains(message, "expired") {
			t.Fatalf("message = %q, want it to mention expired", message)
		}
	})

	t.Run("valid token without database", func(t *testing.T) {
		prevDB := db.MongoDatabase
		prevClient := db.MongoClient
		db.MongoDatabase = nil
		db.MongoClient = nil
		t.Cleanup(func() {
			db.MongoDatabase = prevDB
			db.MongoClient = prevClient
		})

		token := signSubjectToken(t, "user@debateai.test", time.Now().Add(time.Hour))
		rec := perform(router, http.MethodPut, "/user/updateprofile", map[string]string{"bio": "hello"}, map[string]string{
			"Authorization": "Bearer " + token,
		})
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
		}
		if got := errorText(t, rec); got != "Database not initialized" {
			t.Fatalf("error = %q", got)
		}
	})
}

func TestProfileValidationDoesNotRequireDatabase(t *testing.T) {
	router := gin.New()
	router.PUT("/user/updateprofile", func(c *gin.Context) {
		c.Set("email", "person@debateai.test")
		routes.UpdateProfileRouteHandler(c)
	})

	longBio := strings.Repeat("a", 301)
	rec := perform(router, http.MethodPut, "/user/updateprofile", map[string]string{"bio": longBio}, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
	}
	if got := errorText(t, rec); got != "Bio cannot exceed 300 characters" {
		t.Fatalf("error = %q", got)
	}

	rec = perform(router, http.MethodPut, "/user/updateprofile", map[string]string{"twitter": "bad name"}, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
	}
	if got := errorText(t, rec); got != "Invalid Twitter username" {
		t.Fatalf("error = %q", got)
	}
}

func TestRoomTypeValidation(t *testing.T) {
	router := gin.New()
	router.POST("/rooms", routes.CreateRoomHandler)

	rec := perform(router, http.MethodPost, "/rooms", map[string]string{"type": "ranked"}, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
	}
	if got := errorText(t, rec); got != "Invalid room type" {
		t.Fatalf("error = %q", got)
	}

	rec = perform(router, http.MethodPost, "/rooms", map[string]string{}, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
	}
}

func TestDebugMatchmakingPoolRoute(t *testing.T) {
	router := newPublicRouter()
	rec := perform(router, http.MethodGet, "/debug/matchmaking-pool", nil, nil)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
	}

	admin := gin.New()
	admin.Use(func(c *gin.Context) {
		c.Set("isAdmin", true)
		c.Next()
	})
	admin.GET("/debug/matchmaking-pool", routes.GetMatchmakingPoolStatusHandler)
	rec = perform(admin, http.MethodGet, "/debug/matchmaking-pool", nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body.String())
	}
	body := decodeBody(t, rec)
	if _, ok := body["pool"]; !ok {
		t.Fatalf("response missing pool: %s", rec.Body.String())
	}
	if _, ok := body["poolSize"]; !ok {
		t.Fatalf("response missing poolSize: %s", rec.Body.String())
	}
}

func TestNotFoundRoute(t *testing.T) {
	router := newPublicRouter()
	rec := perform(router, http.MethodGet, "/non-existent-endpoint", nil, nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestJoinPublicTournamentLifecycleValidation(t *testing.T) {
	database := testkit.ConnectMongo(t)

	prevCollection := db.TournamentCollection
	db.TournamentCollection = database.Collection("tournaments")
	t.Cleanup(func() {
		db.TournamentCollection = prevCollection
	})

	userID := primitive.NewObjectID()
	router := gin.New()
	router.POST("/tournaments/public/:id/join", func(c *gin.Context) {
		c.Set("userID", userID)
		c.Set("displayName", "Test User")
		controllers.JoinPublicTournament(c)
	})

	cases := []struct {
		name             string
		status           string
		wantStatus       int
		wantParticipants int
	}{
		{name: "upcoming tournament accepts join", status: models.StatusUpcoming, wantStatus: http.StatusOK, wantParticipants: 1},
		{name: "live tournament rejects join", status: models.StatusLive, wantStatus: http.StatusBadRequest, wantParticipants: 0},
		{name: "completed tournament rejects join", status: models.StatusCompleted, wantStatus: http.StatusBadRequest, wantParticipants: 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tournamentID := primitive.NewObjectID()
			_, err := db.TournamentCollection.InsertOne(context.Background(), bson.M{
				"_id":             tournamentID,
				"visibility":      models.VisibilityPublic,
				"status":          tc.status,
				"maxParticipants": 8,
				"participants":    bson.A{},
			})
			if err != nil {
				t.Fatalf("insert tournament: %v", err)
			}

			rec := perform(router, http.MethodPost, "/tournaments/public/"+tournamentID.Hex()+"/join", nil, nil)
			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d, body %s", rec.Code, tc.wantStatus, rec.Body.String())
			}

			var stored struct {
				Participants []bson.M `bson:"participants"`
			}
			err = db.TournamentCollection.FindOne(context.Background(), bson.M{"_id": tournamentID}).Decode(&stored)
			if err != nil {
				t.Fatalf("reload tournament: %v", err)
			}
			if len(stored.Participants) != tc.wantParticipants {
				t.Fatalf("participants = %d, want %d", len(stored.Participants), tc.wantParticipants)
			}
		})
	}
}

func TestJoinPrivateTournamentLifecycleValidation(t *testing.T) {
	database := testkit.ConnectMongo(t)

	prevCollection := db.TournamentCollection
	db.TournamentCollection = database.Collection("tournaments")
	t.Cleanup(func() {
		db.TournamentCollection = prevCollection
	})

	userID := primitive.NewObjectID()
	router := gin.New()
	router.POST("/tournaments/private/join", func(c *gin.Context) {
		c.Set("userID", userID)
		c.Set("displayName", "Test User")
		controllers.JoinPrivateTournament(c)
	})

	cases := []struct {
		name         string
		status       string
		wantStatus   int
		wantRequests int
	}{
		{name: "upcoming tournament accepts join request", status: models.StatusUpcoming, wantStatus: http.StatusOK, wantRequests: 1},
		{name: "live tournament rejects join request", status: models.StatusLive, wantStatus: http.StatusBadRequest, wantRequests: 0},
		{name: "completed tournament rejects join request", status: models.StatusCompleted, wantStatus: http.StatusBadRequest, wantRequests: 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tournamentID := primitive.NewObjectID()
			inviteCode := "invite-" + tournamentID.Hex()
			_, err := db.TournamentCollection.InsertOne(context.Background(), bson.M{
				"_id":             tournamentID,
				"visibility":      models.VisibilityPrivate,
				"status":          tc.status,
				"inviteCode":      inviteCode,
				"maxParticipants": 8,
				"participants":    bson.A{},
				"joinRequests":    bson.A{},
			})
			if err != nil {
				t.Fatalf("insert tournament: %v", err)
			}

			rec := perform(router, http.MethodPost, "/tournaments/private/join", map[string]string{"inviteCode": inviteCode}, nil)
			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d, body %s", rec.Code, tc.wantStatus, rec.Body.String())
			}

			var stored struct {
				JoinRequests []bson.M `bson:"joinRequests"`
			}
			err = db.TournamentCollection.FindOne(context.Background(), bson.M{"_id": tournamentID}).Decode(&stored)
			if err != nil {
				t.Fatalf("reload tournament: %v", err)
			}
			if len(stored.JoinRequests) != tc.wantRequests {
				t.Fatalf("joinRequests = %d, want %d", len(stored.JoinRequests), tc.wantRequests)
			}
		})
	}
}