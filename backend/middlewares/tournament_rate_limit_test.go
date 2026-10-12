package middlewares

import (
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"net/http/httptest"
	"testing"
)

func TestTournamentInviteRateLimit(t *testing.T) {
	router := gin.New()
	user := primitive.NewObjectID()
	router.Use(func(c *gin.Context) { c.Set("userID", user) })
	router.POST("/join", TournamentInviteRateLimit(), func(c *gin.Context) { c.Status(202) })
	for attempt := 0; attempt < 11; attempt++ {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest("POST", "/join", nil))
		want := 202
		if attempt == 10 {
			want = 429
		}
		if response.Code != want {
			t.Fatalf("attempt %d: got %d want %d", attempt, response.Code, want)
		}
	}
}

func TestTournamentInviteRateLimitSharedIP(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("userID", primitive.NewObjectID()) })
	router.POST("/join", TournamentInviteRateLimit(), func(c *gin.Context) { c.Status(202) })
	for attempt := 0; attempt < 31; attempt++ {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest("POST", "/join", nil))
		want := 202
		if attempt == 30 {
			want = 429
		}
		if response.Code != want {
			t.Fatalf("shared IP attempt %d: got %d want %d", attempt, response.Code, want)
		}
		if attempt == 30 && response.Header().Get("Retry-After") != "60" {
			t.Fatal("missing retry interval")
		}
	}
}
