package tests

import (
	"encoding/json"
	"net/http"
	"testing"

	"arguehub/routes"
	"arguehub/structs"
	"arguehub/tests/testutils"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestAuthRouteIntegration(t *testing.T) {
	router := testutils.SetupTestRouter()

	t.Run("SignUp_ValidationFailures", func(t *testing.T) {
		tests := []struct {
			name           string
			body           interface{}
			expectedStatus int
		}{
			{
				name:           "Empty JSON Body",
				body:           "{}",
				expectedStatus: http.StatusBadRequest,
			},
			{
				name:           "Invalid Email Format",
				body:           structs.SignUpRequest{Email: "not-an-email", Password: "Password123!"},
				expectedStatus: http.StatusBadRequest,
			},
			{
				name:           "Password Too Short",
				body:           structs.SignUpRequest{Email: "test@example.com", Password: "short"},
				expectedStatus: http.StatusBadRequest,
			},
			{
				name:           "Malformed JSON Syntax",
				body:           "{malformed-json: true",
				expectedStatus: http.StatusBadRequest,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				req, w := testutils.CreateJSONRequest(http.MethodPost, "/signup", tt.body, nil)
				router.ServeHTTP(w, req)
				assert.Equal(t, tt.expectedStatus, w.Code)
			})
		}
	})

	t.Run("Login_ValidationFailures", func(t *testing.T) {
		tests := []struct {
			name           string
			body           interface{}
			expectedStatus int
		}{
			{
				name:           "Empty Credentials",
				body:           "{}",
				expectedStatus: http.StatusBadRequest,
			},
			{
				name:           "Missing Password",
				body:           map[string]string{"email": "valid@email.com"},
				expectedStatus: http.StatusBadRequest,
			},
			{
				name:           "Malformed JSON",
				body:           "invalid json string",
				expectedStatus: http.StatusBadRequest,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				req, w := testutils.CreateJSONRequest(http.MethodPost, "/login", tt.body, nil)
				router.ServeHTTP(w, req)
				assert.Equal(t, tt.expectedStatus, w.Code)
			})
		}
	})

	t.Run("VerifyEmail_ValidationFailures", func(t *testing.T) {
		req, w := testutils.CreateJSONRequest(http.MethodPost, "/verifyEmail", structs.VerifyEmailRequest{
			Email:            "test@example.com",
			ConfirmationCode: "", // Missing code
		}, nil)
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("GoogleLogin_MissingIDToken", func(t *testing.T) {
		req, w := testutils.CreateJSONRequest(http.MethodPost, "/googleLogin", map[string]string{}, nil)
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("VerifyToken_HeaderParsing", func(t *testing.T) {
		// 1. Missing Authorization Header -> 401
		req, w := testutils.CreateJSONRequest(http.MethodPost, "/verifyToken", nil, nil)
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusUnauthorized, w.Code)

		// 2. Malformed Header (Not Bearer) -> 400
		req2, w2 := testutils.CreateJSONRequest(http.MethodPost, "/verifyToken", nil, map[string]string{
			"Authorization": "Basic 12345",
		})
		router.ServeHTTP(w2, req2)
		assert.Equal(t, http.StatusBadRequest, w2.Code)

		// 3. Invalid/Garbage Token String -> 401
		req3, w3 := testutils.CreateJSONRequest(http.MethodPost, "/verifyToken", nil, map[string]string{
			"Authorization": "Bearer invalid.jwt.token",
		})
		router.ServeHTTP(w3, req3)
		assert.Equal(t, http.StatusUnauthorized, w3.Code)
	})
}

func TestDebugMatchmakingPoolRoute(t *testing.T) {
	router := testutils.SetupTestRouter()

	t.Run("Forbidden_Without_Admin_Context", func(t *testing.T) {
		req, w := testutils.CreateJSONRequest(http.MethodGet, "/debug/matchmaking-pool", nil, nil)
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("Allowed_With_Admin_Context", func(t *testing.T) {
		adminRouter := gin.New()
		adminRouter.Use(func(c *gin.Context) {
			c.Set("isAdmin", true)
			c.Next()
		})
		adminRouter.GET("/debug/matchmaking-pool", routes.GetMatchmakingPoolStatusHandler)

		req, w := testutils.CreateJSONRequest(http.MethodGet, "/debug/matchmaking-pool", nil, nil)
		adminRouter.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		assert.NoError(t, err)
		assert.Contains(t, resp, "pool")
		assert.Contains(t, resp, "poolSize")
	})
}

func TestNotFoundRoute(t *testing.T) {
	router := testutils.SetupTestRouter()
	req, w := testutils.CreateJSONRequest(http.MethodGet, "/non-existent-endpoint", nil, nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}
