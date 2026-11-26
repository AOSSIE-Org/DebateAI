package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"arguehub/internal/testkit"
	"arguehub/middlewares"
	"arguehub/routes"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func newPublicRouter() *gin.Engine {
	router := gin.New()
	router.POST("/signup", routes.SignUpRouteHandler)
	router.POST("/verifyEmail", routes.VerifyEmailRouteHandler)
	router.POST("/login", routes.LoginRouteHandler)
	router.POST("/googleLogin", routes.GoogleLoginRouteHandler)
	router.POST("/forgotPassword", routes.ForgotPasswordRouteHandler)
	router.POST("/confirmForgotPassword", routes.VerifyForgotPasswordRouteHandler)
	router.POST("/verifyToken", routes.VerifyTokenRouteHandler)
	router.POST("/resendVerification", routes.ResendVerificationRouteHandler)
	router.GET("/debug/matchmaking-pool", routes.GetMatchmakingPoolStatusHandler)
	return router
}

func newAppRouter() *gin.Engine {
	router := newPublicRouter()
	authed := router.Group("/")
	authed.Use(middlewares.AuthMiddleware(testkit.ConfigPath()))
	authed.PUT("/user/updateprofile", routes.UpdateProfileRouteHandler)
	authed.POST("/rooms", routes.CreateRoomHandler)
	return router
}

func jsonRequest(method, target string, body any, headers map[string]string) (*http.Request, *httptest.ResponseRecorder) {
	var reader io.Reader
	switch typed := body.(type) {
	case nil:
	case string:
		reader = bytes.NewBufferString(typed)
	default:
		data, err := json.Marshal(typed)
		if err != nil {
			panic(err)
		}
		reader = bytes.NewBuffer(data)
	}

	req := httptest.NewRequest(method, target, reader)
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	return req, httptest.NewRecorder()
}

func perform(router http.Handler, method, target string, body any, headers map[string]string) *httptest.ResponseRecorder {
	req, rec := jsonRequest(method, target, body, headers)
	router.ServeHTTP(rec, req)
	return rec
}

func decodeBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("status %d body %s: %v", rec.Code, rec.Body.String(), err)
	}
	return body
}

func errorText(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	text, _ := decodeBody(t, rec)["error"].(string)
	return text
}

func signSubjectToken(t *testing.T, email string, expiry time.Time) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub": email,
		"exp": expiry.Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(testkit.JWTSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}
