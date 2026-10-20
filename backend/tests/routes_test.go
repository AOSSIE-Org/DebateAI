package tests

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"arguehub/db"
	"arguehub/routes"
	"arguehub/structs"

	"github.com/gin-gonic/gin"
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
