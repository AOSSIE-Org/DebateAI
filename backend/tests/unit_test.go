package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"arguehub/rating"
	"arguehub/structs"
	"arguehub/tests/testutils"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGlicko2RatingEngine(t *testing.T) {
	g := rating.New(nil) // DefaultConfig
	require.NotNil(t, g)

	t.Run("NewPlayer_Defaults", func(t *testing.T) {
		p := g.NewPlayer()
		assert.Equal(t, 1500.0, p.Rating)
		assert.Equal(t, 350.0, p.RD)
		assert.Equal(t, 0.06, p.Volatility)
		assert.False(t, p.LastUpdate.IsZero())
	})

	t.Run("UpdateMatch_P1Wins", func(t *testing.T) {
		p1 := g.NewPlayer()
		p2 := g.NewPlayer()

		now := time.Now()
		g.UpdateMatch(p1, p2, 1.0, now)

		assert.Greater(t, p1.Rating, 1500.0, "Winner rating should increase")
		assert.Less(t, p2.Rating, 1500.0, "Loser rating should decrease")
		assert.Less(t, p1.RD, 350.0, "Winner RD should decrease after match")
		assert.Less(t, p2.RD, 350.0, "Loser RD should decrease after match")
	})

	t.Run("UpdateMatch_Draw", func(t *testing.T) {
		p1 := g.NewPlayer()
		p2 := g.NewPlayer()

		now := time.Now()
		g.UpdateMatch(p1, p2, 0.5, now)

		// Equal players drawing should maintain roughly equal ratings
		assert.InDelta(t, 1500.0, p1.Rating, 1.0)
		assert.InDelta(t, 1500.0, p2.Rating, 1.0)
	})

	t.Run("UpdateMatch_UpsetWin", func(t *testing.T) {
		underdog := &rating.Player{Rating: 1200.0, RD: 100.0, Volatility: 0.06, LastUpdate: time.Now()}
		favorite := &rating.Player{Rating: 1800.0, RD: 100.0, Volatility: 0.06, LastUpdate: time.Now()}

		now := time.Now()
		g.UpdateMatch(underdog, favorite, 1.0, now) // Underdog wins

		// Underdog should gain significant rating points
		assert.Greater(t, underdog.Rating, 1250.0, "Underdog should gain substantial rating from upset")
		assert.Less(t, favorite.Rating, 1750.0, "Favorite should lose substantial rating from upset")
	})
}

func TestRequestStructValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("SignUpRequest_TableDriven", func(t *testing.T) {
		tests := []struct {
			name        string
			payload     interface{}
			shouldError bool
		}{
			{
				name:        "Valid payload",
				payload:     structs.SignUpRequest{Email: "user@example.com", Password: "StrongPassword123"},
				shouldError: false,
			},
			{
				name:        "Invalid email syntax",
				payload:     structs.SignUpRequest{Email: "not-an-email", Password: "StrongPassword123"},
				shouldError: true,
			},
			{
				name:        "Password too short (< 8 chars)",
				payload:     structs.SignUpRequest{Email: "user@example.com", Password: "123"},
				shouldError: true,
			},
			{
				name:        "Empty email",
				payload:     structs.SignUpRequest{Email: "", Password: "StrongPassword123"},
				shouldError: true,
			},
			{
				name:        "Empty password",
				payload:     structs.SignUpRequest{Email: "user@example.com", Password: ""},
				shouldError: true,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				body, _ := json.Marshal(tt.payload)
				req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")

				var reqStruct structs.SignUpRequest
				err := binding.Default(http.MethodPost, "application/json").Bind(req, &reqStruct)
				if tt.shouldError {
					assert.Error(t, err)
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})

	t.Run("LoginRequest_TableDriven", func(t *testing.T) {
		tests := []struct {
			name        string
			payload     interface{}
			shouldError bool
		}{
			{
				name:        "Valid login credentials",
				payload:     structs.LoginRequest{Email: "user@example.com", Password: "password123"},
				shouldError: false,
			},
			{
				name:        "Missing password",
				payload:     structs.LoginRequest{Email: "user@example.com", Password: ""},
				shouldError: true,
			},
			{
				name:        "Invalid email format",
				payload:     structs.LoginRequest{Email: "invalid-email", Password: "password123"},
				shouldError: true,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				body, _ := json.Marshal(tt.payload)
				req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")

				var reqStruct structs.LoginRequest
				err := binding.Default(http.MethodPost, "application/json").Bind(req, &reqStruct)
				if tt.shouldError {
					assert.Error(t, err)
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})
}

func TestUtilityFunctions(t *testing.T) {
	t.Run("GenerateRandomCode", func(t *testing.T) {
		code := utils.GenerateRandomCode(6)
		assert.Equal(t, 6, len(code))
		for _, ch := range code {
			assert.True(t, ch >= '0' && ch <= '9', "Character must be numeric digit")
		}

		// Successive calls should yield different codes
		code2 := utils.GenerateRandomCode(6)
		assert.NotEqual(t, code, code2)
	})

	t.Run("ExtractNameFromEmail", func(t *testing.T) {
		assert.Equal(t, "john.doe", utils.ExtractNameFromEmail("john.doe@debateai.org"))
		assert.Equal(t, "alice", utils.ExtractNameFromEmail("alice@example.com"))
		assert.Equal(t, "plainuser", utils.ExtractNameFromEmail("plainuser"))
	})
}

func TestJWTClaimsAndValidation(t *testing.T) {
	secret := "test-jwt-secret-key-12345"
	email := "debater@debateai.org"

	t.Run("Generate_Valid_Token", func(t *testing.T) {
		token, err := testutils.GenerateTestJWT(email, secret, 60)
		require.NoError(t, err)
		assert.NotEmpty(t, token)
		parts := strings.Split(token, ".")
		assert.Equal(t, 3, len(parts), "JWT should have 3 dot-separated parts")
	})

	t.Run("Generate_Expired_Token", func(t *testing.T) {
		// Generate with negative expiry minutes
		token, err := testutils.GenerateTestJWT(email, secret, -10)
		require.NoError(t, err)
		assert.NotEmpty(t, token)
	})
}
