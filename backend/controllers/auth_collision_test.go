package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/structs"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func setupTestDB(t *testing.T) {
	_ = os.Setenv("CONFIG_PATH", "../config/config.prod.yml")
	mongoURI := os.Getenv("DATABASE_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017/debateai_test"
	}
	err := db.ConnectMongoDB(mongoURI)
	if err != nil {
		t.Skipf("Skipping live Mongo test: failed to connect to %s: %v", mongoURI, err)
	}
}

func TestSignUp_AutoResolvedDisplayNameOnCollision(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB(t)

	userCol := db.MongoDatabase.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	testBaseName := "testcolautouser"
	email1 := testBaseName + "@domain1.com"
	email2 := testBaseName + "@domain2.com"

	// Cleanup
	_, _ = userCol.DeleteMany(ctx, bson.M{
		"$or": []bson.M{
			{"displayName": bson.M{"$regex": "^" + testBaseName}},
			{"email": email1},
			{"email": email2},
		},
	})
	defer func() {
		cleanupCtx, cCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cCancel()
		_, _ = userCol.DeleteMany(cleanupCtx, bson.M{
			"$or": []bson.M{
				{"displayName": bson.M{"$regex": "^" + testBaseName}},
				{"email": email1},
				{"email": email2},
			},
		})
	}()

	// 1. Seed existing user with exact displayName = testBaseName
	now := time.Now()
	user1 := models.User{
		ID:          primitive.NewObjectID(),
		Email:       email1,
		DisplayName: testBaseName,
		Nickname:    testBaseName,
		IsVerified:  true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, err := userCol.InsertOne(ctx, user1)
	if err != nil {
		t.Fatalf("failed to insert initial user1: %v", err)
	}

	// 2. User 2 registers with the same email username prefix, but NO custom displayName
	signupReq := structs.SignUpRequest{
		Email:    email2,
		Password: "Password123!",
	}
	body, _ := json.Marshal(signupReq)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/signup", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	SignUp(c)

	// User 2 must NOT be rejected with 400!
	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK for auto-resolved displayName, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 3. Verify in DB that User 2 was inserted with a discriminator suffix (e.g. testcolautouser_XXXX)
	verifyCtx, vCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer vCancel()
	var user2 models.User
	err = userCol.FindOne(verifyCtx, bson.M{"email": email2}).Decode(&user2)
	if err != nil {
		t.Fatalf("failed to fetch user2 from DB: %v", err)
	}

	if !strings.HasPrefix(user2.DisplayName, testBaseName+"_") {
		t.Fatalf("expected user2 displayName to start with %q, got %q", testBaseName+"_", user2.DisplayName)
	}

	t.Logf("Successfully auto-resolved colliding display name for User 2: %q", user2.DisplayName)
}

func TestSignUp_CustomDisplayNameSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB(t)

	userCol := db.MongoDatabase.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	email := "testcustomname@example.com"
	customName := "UniqueDebater99"

	_, _ = userCol.DeleteMany(ctx, bson.M{
		"$or": []bson.M{
			{"displayName": customName},
			{"email": email},
		},
	})
	defer func() {
		cleanupCtx, cCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cCancel()
		_, _ = userCol.DeleteMany(cleanupCtx, bson.M{
			"$or": []bson.M{
				{"displayName": customName},
				{"email": email},
			},
		})
	}()

	signupReq := structs.SignUpRequest{
		Email:       email,
		Password:    "Password123!",
		DisplayName: customName,
	}
	body, _ := json.Marshal(signupReq)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/signup", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	SignUp(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d. Body: %s", w.Code, w.Body.String())
	}

	verifyCtx, vCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer vCancel()
	var created models.User
	err := userCol.FindOne(verifyCtx, bson.M{"email": email}).Decode(&created)
	if err != nil {
		t.Fatalf("failed to fetch created user: %v", err)
	}

	if created.DisplayName != customName {
		t.Fatalf("expected displayName %q, got %q", customName, created.DisplayName)
	}
}

func TestSignUp_ExplicitCustomDisplayNameCollision_Returns400(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTestDB(t)

	userCol := db.MongoDatabase.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	existingName := "OccupiedDebater"
	email1 := "existingoccupied@example.com"
	email2 := "newuseroccupied@example.com"

	_, _ = userCol.DeleteMany(ctx, bson.M{
		"$or": []bson.M{
			{"displayName": existingName},
			{"email": email1},
			{"email": email2},
		},
	})
	defer func() {
		cleanupCtx, cCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cCancel()
		_, _ = userCol.DeleteMany(cleanupCtx, bson.M{
			"$or": []bson.M{
				{"displayName": existingName},
				{"email": email1},
				{"email": email2},
			},
		})
	}()

	// Seed existing user with existingName
	now := time.Now()
	_, err := userCol.InsertOne(ctx, models.User{
		ID:          primitive.NewObjectID(),
		Email:       email1,
		DisplayName: existingName,
		Nickname:    existingName,
		IsVerified:  true,
		CreatedAt:   now,
		UpdatedAt:   now,
	})
	if err != nil {
		t.Fatalf("failed to insert user: %v", err)
	}

	// Try to register new user with explicitly specified occupied name
	signupReq := structs.SignUpRequest{
		Email:       email2,
		Password:    "Password123!",
		DisplayName: existingName,
	}
	body, _ := json.Marshal(signupReq)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/signup", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	SignUp(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 Bad Request for taken explicit displayName, got %d. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}

	if resp["error"] != "Display name already taken" {
		t.Fatalf("expected error 'Display name already taken', got %v", resp["error"])
	}
}

func TestResolveUniqueDisplayName_Unit(t *testing.T) {
	setupTestDB(t)

	userCol := db.MongoDatabase.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	base := "testunitresolver"

	// Cleanup
	_, _ = userCol.DeleteMany(ctx, bson.M{"displayName": bson.M{"$regex": "^" + base}})
	defer func() {
		cleanupCtx, cCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cCancel()
		_, _ = userCol.DeleteMany(cleanupCtx, bson.M{"displayName": bson.M{"$regex": "^" + base}})
	}()

	// 1. Initial resolution when free
	resolved1, err := resolveUniqueDisplayName(ctx, userCol, base)
	if err != nil {
		t.Fatalf("resolveUniqueDisplayName returned error: %v", err)
	}
	if resolved1 != base {
		t.Fatalf("expected resolved1 to equal base %q, got %q", base, resolved1)
	}

	// 2. Insert user with that base name
	_, err = userCol.InsertOne(ctx, models.User{
		ID:          primitive.NewObjectID(),
		Email:       "testunitresolver@example.com",
		DisplayName: base,
		Nickname:    base,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	})
	if err != nil {
		t.Fatalf("failed to insert user: %v", err)
	}

	// 3. Second resolution should detect collision and append discriminator
	resolved2, err := resolveUniqueDisplayName(ctx, userCol, base)
	if err != nil {
		t.Fatalf("resolveUniqueDisplayName returned error on collision: %v", err)
	}
	if !strings.HasPrefix(resolved2, base+"_") {
		t.Fatalf("expected resolved2 to have prefix %q, got %q", base+"_", resolved2)
	}
	t.Logf("Collision resolved successfully: %q -> %q", base, resolved2)
}
