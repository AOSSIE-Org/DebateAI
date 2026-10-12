package controllers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"arguehub/db"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestFollowUserHandler_RedisNil(t *testing.T) {
	orig := db.RedisClient
	defer func() { db.RedisClient = orig }()

	db.RedisClient = nil

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/community/follow/64b1f2e3d4c5b6a789012345", nil)

	FollowUserHandler(c)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected HTTP 503, got %d", w.Code)
	}

	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}

	if resp["error"] != "Redis not available for rate limiting" {
		t.Errorf("unexpected error message: %q", resp["error"])
	}
}

func TestToggleLikeHandler_RedisNil(t *testing.T) {
	orig := db.RedisClient
	defer func() { db.RedisClient = orig }()

	db.RedisClient = nil

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/community/like/64b1f2e3d4c5b6a789012345", nil)

	ToggleLikeHandler(c)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected HTTP 503, got %d", w.Code)
	}

	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}

	if resp["error"] != "Redis not available" {
		t.Errorf("unexpected error message: %q", resp["error"])
	}
}

func TestHandlers_RedisInitialized(t *testing.T) {
	orig := db.RedisClient
	defer func() { db.RedisClient = orig }()

	// Provide a non-nil client to verify handlers proceed beyond the Redis nil check
	dummy := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
	db.RedisClient = dummy

	// Test FollowUserHandler: should pass Redis check and fail on missing Authorization header
	wFollow := httptest.NewRecorder()
	cFollow, _ := gin.CreateTestContext(wFollow)
	cFollow.Request = httptest.NewRequest(http.MethodPost, "/community/follow/64b1f2e3d4c5b6a789012345", nil)

	FollowUserHandler(cFollow)

	if wFollow.Code != http.StatusUnauthorized {
		t.Errorf("expected HTTP 401 when Authorization header missing, got %d", wFollow.Code)
	}

	// Test ToggleLikeHandler: should pass Redis check and fail on missing Authorization header
	wLike := httptest.NewRecorder()
	cLike, _ := gin.CreateTestContext(wLike)
	cLike.Request = httptest.NewRequest(http.MethodPost, "/community/like/64b1f2e3d4c5b6a789012345", nil)

	ToggleLikeHandler(cLike)

	if wLike.Code != http.StatusUnauthorized {
		t.Errorf("expected HTTP 401 when Authorization header missing, got %d", wLike.Code)
	}
}
