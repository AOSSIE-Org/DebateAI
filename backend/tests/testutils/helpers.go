package testutils

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"arguehub/db"
	"arguehub/routes"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/mongo"
)

func init() {
	// Ensure CONFIG_PATH points to a valid config file regardless of where `go test` is invoked
	if os.Getenv("CONFIG_PATH") == "" {
		candidates := []string{
			"../config/config.prod.yml",
			"../config/config.prod.sample.yml",
			"./config/config.prod.yml",
			"./config/config.prod.sample.yml",
			"../../config/config.prod.yml",
			"../../config/config.prod.sample.yml",
		}
		for _, cand := range candidates {
			if abs, err := filepath.Abs(cand); err == nil {
				if _, err := os.Stat(abs); err == nil {
					_ = os.Setenv("CONFIG_PATH", abs)
					break
				}
			}
		}
	}
}

// SetupTestRouter initializes an isolated Gin engine with all main routes registered.
func SetupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// Register exported route handlers from the routes package
	router.POST("/signup", routes.SignUpRouteHandler)
	router.POST("/verifyEmail", routes.VerifyEmailRouteHandler)
	router.POST("/login", routes.LoginRouteHandler)
	router.POST("/googleLogin", routes.GoogleLoginRouteHandler)
	router.POST("/forgotPassword", routes.ForgotPasswordRouteHandler)
	router.POST("/confirmForgotPassword", routes.VerifyForgotPasswordRouteHandler)
	router.POST("/verifyToken", routes.VerifyTokenRouteHandler)

	router.GET("/debug/matchmaking-pool", routes.GetMatchmakingPoolStatusHandler)

	return router
}

// CreateJSONRequest creates a mock HTTP request with a JSON payload and headers.
func CreateJSONRequest(method, target string, body interface{}, headers map[string]string) (*http.Request, *httptest.ResponseRecorder) {
	var bodyReader io.Reader
	if body != nil {
		if rawStr, ok := body.(string); ok {
			bodyReader = bytes.NewBufferString(rawStr)
		} else {
			data, _ := json.Marshal(body)
			bodyReader = bytes.NewBuffer(data)
		}
	}

	req := httptest.NewRequest(method, target, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	w := httptest.NewRecorder()
	return req, w
}

// GenerateTestJWT generates a signed JWT token for testing token authentication.
func GenerateTestJWT(email, secret string, expiryMinutes int) (string, error) {
	now := time.Now()
	expirationTime := now.Add(time.Minute * time.Duration(expiryMinutes))

	claims := jwt.MapClaims{
		"sub": email,
		"exp": expirationTime.Unix(),
		"iat": now.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// WithTestDB executes a test function with the MongoDB instance if it is reachable,
// or skips the test gracefully if no database is connected.
func WithTestDB(t *testing.T, fn func(database *mongo.Database)) {
	if db.MongoDatabase == nil {
		t.Skip("MongoDB connection not initialized, skipping database-dependent test")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if db.MongoClient == nil || db.MongoClient.Ping(ctx, nil) != nil {
		t.Skip("MongoDB server unreachable, skipping database-dependent test")
		return
	}

	fn(db.MongoDatabase)
}
