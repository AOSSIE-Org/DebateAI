package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"arguehub/db"
	"arguehub/internal/testkit"
	"arguehub/models"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func setupDebateVsBotTestDB(t *testing.T) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	_ = os.Setenv("ENV", "test")

	testkit.StartSMTP(t)

	if cfgPath := testkit.ConfigPath(); cfgPath != "" {
		_ = os.Setenv("CONFIG_PATH", cfgPath)
	}

	mongoURI := os.Getenv("MONGO_TEST_URI")
	if mongoURI == "" {
		mongoURI = os.Getenv("DATABASE_URI")
	}
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017/debateai_test"
	}

	parsedURI, err := url.Parse(mongoURI)
	dbName := "debateai_test"
	if err == nil && parsedURI.Path != "" && parsedURI.Path != "/" {
		dbName = strings.TrimPrefix(parsedURI.Path, "/")
	}
	if !strings.Contains(strings.ToLower(dbName), "test") {
		t.Fatalf("Refusing to run tests against non-test database: %q", dbName)
	}

	err = db.ConnectMongoDB(mongoURI)
	if err != nil {
		redacted := "MongoDB"
		if parsedURI != nil && parsedURI.Host != "" {
			redacted = parsedURI.Host
		}
		t.Skipf("Skipping live Mongo test: failed to connect to %s: %v", redacted, err)
	}
}

func createDebateVsBotTestUserAndToken(t *testing.T, email string) (string, primitive.ObjectID) {
	t.Helper()
	utils.SetJWTSecret(testkit.JWTSecret)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userCol := db.MongoDatabase.Collection("users")
	userID := primitive.NewObjectID()
	now := time.Now()

	// Ensure clean slate for test user
	_, _ = userCol.DeleteOne(ctx, bson.M{"email": email})

	testUser := models.User{
		ID:          userID,
		Email:       email,
		DisplayName: "TestDebater",
		Nickname:    "TestDebater",
		IsVerified:  true,
		Score:       100,
		Badges:      []string{},
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, err := userCol.InsertOne(ctx, testUser)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}

	claims := utils.Claims{
		Email: email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   email,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := tok.SignedString([]byte(testkit.JWTSecret))
	if err != nil {
		t.Fatalf("failed to sign test JWT: %v", err)
	}

	return signedToken, userID
}

// TestBotDebate_SingleDocumentAcrossMultipleTurns verifies that consecutive turns
// within the same bot debate session update the existing document rather than inserting duplicates.
func TestBotDebate_SingleDocumentAcrossMultipleTurns(t *testing.T) {
	setupDebateVsBotTestDB(t)

	testEmail := "singledoctest@example.com"
	token, userID := createDebateVsBotTestUserAndToken(t, testEmail)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Cleanup any previous debate records for test user
	_, _ = db.DebateVsBotCollection.DeleteMany(ctx, bson.M{"email": testEmail})
	_, _ = db.MongoDatabase.Collection("transcripts").DeleteMany(ctx, bson.M{"email": testEmail})
	defer func() {
		cleanupCtx, cCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cCancel()
		_, _ = db.DebateVsBotCollection.DeleteMany(cleanupCtx, bson.M{"email": testEmail})
		_, _ = db.MongoDatabase.Collection("users").DeleteOne(cleanupCtx, bson.M{"_id": userID})
	}()

	// 1. Initiate debate via POST /vsbot/create
	createReq := DebateRequest{
		BotName:  "Rookie Rick",
		BotLevel: "Easy",
		Topic:    "Renewable Energy vs Fossil Fuels",
		Stance:   "Against",
		History:  []models.Message{},
		PhaseTimings: []PhaseTiming{
			{Name: "opening", Time: 60},
		},
	}
	createBody, _ := json.Marshal(createReq)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/vsbot/create", bytes.NewReader(createBody))
	c.Request.Header.Set("Authorization", "Bearer "+token)
	c.Request.Header.Set("Content-Type", "application/json")

	CreateDebate(c)

	if w.Code != http.StatusOK {
		t.Fatalf("CreateDebate failed with status %d: %s", w.Code, w.Body.String())
	}

	var createResp DebateResponse
	if err := json.Unmarshal(w.Body.Bytes(), &createResp); err != nil {
		t.Fatalf("failed to decode CreateDebate response: %v", err)
	}

	debateID := createResp.DebateId
	if debateID == "" {
		t.Fatalf("expected non-empty debateId from CreateDebate")
	}

	// Verify MongoDB contains exactly 1 document
	count, err := db.DebateVsBotCollection.CountDocuments(ctx, bson.M{"email": testEmail})
	if err != nil {
		t.Fatalf("count documents failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 document after CreateDebate, got %d", count)
	}

	// 2. Turn 1 via POST /vsbot/debate passing debateId
	turn1History := []models.Message{
		{Sender: "User", Text: "Solar power is scalable and sustainable.", Phase: "opening"},
	}
	turn1Req := DebateRequest{
		DebateId: debateID,
		BotName:  "Rookie Rick",
		BotLevel: "Easy",
		Topic:    "Renewable Energy vs Fossil Fuels",
		Stance:   "Against",
		History:  turn1History,
	}
	turn1Body, _ := json.Marshal(turn1Req)

	w1 := httptest.NewRecorder()
	c1, _ := gin.CreateTestContext(w1)
	c1.Request = httptest.NewRequest(http.MethodPost, "/vsbot/debate", bytes.NewReader(turn1Body))
	c1.Request.Header.Set("Authorization", "Bearer "+token)
	c1.Request.Header.Set("Content-Type", "application/json")

	SendDebateMessage(c1)

	if w1.Code != http.StatusOK {
		t.Fatalf("SendDebateMessage Turn 1 failed with status %d: %s", w1.Code, w1.Body.String())
	}

	var turn1Resp DebateMessageResponse
	_ = json.Unmarshal(w1.Body.Bytes(), &turn1Resp)
	if turn1Resp.DebateId != debateID {
		t.Fatalf("expected Turn 1 to return same debateId %q, got %q", debateID, turn1Resp.DebateId)
	}

	// Check document count after Turn 1: MUST STILL BE 1
	count, _ = db.DebateVsBotCollection.CountDocuments(ctx, bson.M{"email": testEmail})
	if count != 1 {
		t.Fatalf("expected 1 document after Turn 1, got %d (duplicate inserted!)", count)
	}

	// 3. Turn 2 via POST /vsbot/debate
	turn2History := append(turn1History,
		models.Message{Sender: "Bot", Text: turn1Resp.Response, Phase: "opening"},
		models.Message{Sender: "User", Text: "Fossil fuels cause catastrophic emissions.", Phase: "opening"},
	)
	turn2Req := DebateRequest{
		DebateId: debateID,
		BotName:  "Rookie Rick",
		BotLevel: "Easy",
		Topic:    "Renewable Energy vs Fossil Fuels",
		Stance:   "Against",
		History:  turn2History,
	}
	turn2Body, _ := json.Marshal(turn2Req)

	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = httptest.NewRequest(http.MethodPost, "/vsbot/debate", bytes.NewReader(turn2Body))
	c2.Request.Header.Set("Authorization", "Bearer "+token)
	c2.Request.Header.Set("Content-Type", "application/json")

	SendDebateMessage(c2)

	if w2.Code != http.StatusOK {
		t.Fatalf("SendDebateMessage Turn 2 failed with status %d: %s", w2.Code, w2.Body.String())
	}

	var turn2Resp DebateMessageResponse
	_ = json.Unmarshal(w2.Body.Bytes(), &turn2Resp)
	if turn2Resp.DebateId != debateID {
		t.Fatalf("expected Turn 2 to return same debateId %q, got %q", debateID, turn2Resp.DebateId)
	}

	// Check document count after Turn 2: MUST STILL BE 1
	count, _ = db.DebateVsBotCollection.CountDocuments(ctx, bson.M{"email": testEmail})
	if count != 1 {
		t.Fatalf("expected 1 document after Turn 2, got %d (duplicate inserted!)", count)
	}

	// 4. Verify the document has the accumulated history
	objID, _ := primitive.ObjectIDFromHex(debateID)
	var finalDoc models.DebateVsBot
	err = db.DebateVsBotCollection.FindOne(ctx, bson.M{"_id": objID}).Decode(&finalDoc)
	if err != nil {
		t.Fatalf("failed to fetch final debate doc: %v", err)
	}

	// History should contain: User 1, Bot 1, User 2, Bot 2 (4 messages total)
	if len(finalDoc.History) < 4 {
		t.Fatalf("expected at least 4 messages in history, got %d", len(finalDoc.History))
	}

	t.Logf("Success: 3 turns executed with exactly 1 document in debates_vs_bot (ID: %s, history count: %d)",
		debateID, len(finalDoc.History))
}

// TestBotDebate_JudgeTargetsSpecificSession verifies that POST /vsbot/judge with debateId
// accurately targets and updates the specified debate session without race conditions.
func TestBotDebate_JudgeTargetsSpecificSession(t *testing.T) {
	setupDebateVsBotTestDB(t)

	testEmail := "judgetargettest@example.com"
	token, userID := createDebateVsBotTestUserAndToken(t, testEmail)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, _ = db.DebateVsBotCollection.DeleteMany(ctx, bson.M{"email": testEmail})
	defer func() {
		cleanupCtx, cCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cCancel()
		_, _ = db.DebateVsBotCollection.DeleteMany(cleanupCtx, bson.M{"email": testEmail})
		_, _ = db.MongoDatabase.Collection("users").DeleteOne(cleanupCtx, bson.M{"_id": userID})
	}()

	now := time.Now().Unix()
	// Insert Session A (earlier)
	sessionAID := primitive.NewObjectID()
	sessionA := models.DebateVsBot{
		ID:        sessionAID,
		Email:     testEmail,
		BotName:   "Rookie Rick",
		Topic:     "Topic A",
		Outcome:   "",
		CreatedAt: now - 100,
	}
	_, _ = db.DebateVsBotCollection.InsertOne(ctx, sessionA)

	// Insert Session B (latest)
	sessionBID := primitive.NewObjectID()
	sessionB := models.DebateVsBot{
		ID:        sessionBID,
		Email:     testEmail,
		BotName:   "Philosopher Phil",
		Topic:     "Topic B",
		Outcome:   "",
		CreatedAt: now,
	}
	_, _ = db.DebateVsBotCollection.InsertOne(ctx, sessionB)

	// Judge Session A specifically
	judgeReq := JudgeRequest{
		DebateId: sessionAID.Hex(),
		History: []models.Message{
			{Sender: "User", Text: "Argument for Session A"},
			{Sender: "Bot", Text: "Counter for Session A"},
		},
	}
	judgeBody, _ := json.Marshal(judgeReq)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/vsbot/judge", bytes.NewReader(judgeBody))
	c.Request.Header.Set("Authorization", "Bearer "+token)
	c.Request.Header.Set("Content-Type", "application/json")

	JudgeDebate(c)

	if w.Code != http.StatusOK {
		t.Fatalf("JudgeDebate failed with status %d: %s", w.Code, w.Body.String())
	}

	// Verify Session A outcome and final history were updated
	var updatedA models.DebateVsBot
	_ = db.DebateVsBotCollection.FindOne(ctx, bson.M{"_id": sessionAID}).Decode(&updatedA)
	if updatedA.Outcome != "win" && updatedA.Outcome != "loss" && updatedA.Outcome != "draw" {
		t.Fatalf("expected Session A outcome to be normalized (win/loss/draw), got %q", updatedA.Outcome)
	}
	if len(updatedA.History) != len(judgeReq.History) {
		t.Fatalf("expected Session A history length to match final judged history (%d), got %d",
			len(judgeReq.History), len(updatedA.History))
	}

	// Verify Session B outcome remains untouched
	var updatedB models.DebateVsBot
	_ = db.DebateVsBotCollection.FindOne(ctx, bson.M{"_id": sessionBID}).Decode(&updatedB)
	if updatedB.Outcome != "" {
		t.Fatalf("expected Session B outcome to remain empty, got %q", updatedB.Outcome)
	}

	t.Logf("Success: JudgeDebate correctly updated Session A without altering Session B")
}

// TestBotDebate_UnauthorizedAccessRejected verifies that users cannot modify
// or judge another user's debate session document.
func TestBotDebate_UnauthorizedAccessRejected(t *testing.T) {
	setupDebateVsBotTestDB(t)

	emailOwner := "owner@example.com"
	_, userOwnerID := createDebateVsBotTestUserAndToken(t, emailOwner)

	emailAttacker := "attacker@example.com"
	tokenAttacker, userAttackerID := createDebateVsBotTestUserAndToken(t, emailAttacker)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	defer func() {
		cleanupCtx, cCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cCancel()
		_, _ = db.DebateVsBotCollection.DeleteMany(cleanupCtx, bson.M{
			"email": bson.M{"$in": []string{emailOwner, emailAttacker}},
		})
		_, _ = db.MongoDatabase.Collection("users").DeleteMany(cleanupCtx, bson.M{
			"_id": bson.M{"$in": []primitive.ObjectID{userOwnerID, userAttackerID}},
		})
	}()

	ownerDebateID := primitive.NewObjectID()
	ownerDebate := models.DebateVsBot{
		ID:        ownerDebateID,
		Email:     emailOwner,
		BotName:   "Rookie Rick",
		Topic:     "Private Debate",
		CreatedAt: time.Now().Unix(),
	}
	_, _ = db.DebateVsBotCollection.InsertOne(ctx, ownerDebate)

	// Attacker attempts to send turn to owner's debate
	turnReq := DebateRequest{
		DebateId: ownerDebateID.Hex(),
		BotName:  "Rookie Rick",
		BotLevel: "Easy",
		Topic:    "Private Debate",
		Stance:   "Against",
		History:  []models.Message{{Sender: "User", Text: "Intruder"}},
	}
	turnBody, _ := json.Marshal(turnReq)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/vsbot/debate", bytes.NewReader(turnBody))
	c.Request.Header.Set("Authorization", "Bearer "+tokenAttacker)
	c.Request.Header.Set("Content-Type", "application/json")

	SendDebateMessage(c)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected status 404 for unauthorized debate access, got %d", w.Code)
	}

	// Attacker attempts to judge owner's debate
	judgeReq := JudgeRequest{
		DebateId: ownerDebateID.Hex(),
		History:  []models.Message{{Sender: "User", Text: "Intruder"}},
	}
	judgeBody, _ := json.Marshal(judgeReq)

	wJudge := httptest.NewRecorder()
	cJudge, _ := gin.CreateTestContext(wJudge)
	cJudge.Request = httptest.NewRequest(http.MethodPost, "/vsbot/judge", bytes.NewReader(judgeBody))
	cJudge.Request.Header.Set("Authorization", "Bearer "+tokenAttacker)
	cJudge.Request.Header.Set("Content-Type", "application/json")

	JudgeDebate(cJudge)

	if wJudge.Code != http.StatusNotFound {
		t.Fatalf("expected status 404 for unauthorized judge access, got %d", wJudge.Code)
	}
}

// TestBotDebate_InvalidDebateID_Returns400 verifies input validation for malformed debate IDs.
func TestBotDebate_InvalidDebateID_Returns400(t *testing.T) {
	setupDebateVsBotTestDB(t)

	token, userID := createDebateVsBotTestUserAndToken(t, "invalididtest@example.com")
	defer func() {
		cleanupCtx, cCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cCancel()
		_, _ = db.MongoDatabase.Collection("users").DeleteOne(cleanupCtx, bson.M{"_id": userID})
	}()

	// Invalid debate ID on SendDebateMessage
	turnReq := DebateRequest{
		DebateId: "invalid-hex-objectid",
		BotName:  "Rookie Rick",
		BotLevel: "Easy",
		Topic:    "Some Topic",
		Stance:   "Against",
	}
	turnBody, _ := json.Marshal(turnReq)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/vsbot/debate", bytes.NewReader(turnBody))
	c.Request.Header.Set("Authorization", "Bearer "+token)
	c.Request.Header.Set("Content-Type", "application/json")

	SendDebateMessage(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for malformed debateId, got %d", w.Code)
	}

	// Invalid debate ID on JudgeDebate
	judgeReq := JudgeRequest{
		DebateId: "invalid-hex-objectid",
		History:  []models.Message{{Sender: "User", Text: "Hi"}},
	}
	judgeBody, _ := json.Marshal(judgeReq)

	wJudge := httptest.NewRecorder()
	cJudge, _ := gin.CreateTestContext(wJudge)
	cJudge.Request = httptest.NewRequest(http.MethodPost, "/vsbot/judge", bytes.NewReader(judgeBody))
	cJudge.Request.Header.Set("Authorization", "Bearer "+token)
	cJudge.Request.Header.Set("Content-Type", "application/json")

	JudgeDebate(cJudge)

	if wJudge.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for malformed debateId on judge, got %d", wJudge.Code)
	}
}

// TestBotDebate_LegacyFallbackWithoutDebateId verifies that legacy requests
// omitting debateId continue to function as before.
func TestBotDebate_LegacyFallbackWithoutDebateId(t *testing.T) {
	setupDebateVsBotTestDB(t)

	testEmail := "legacyclient@example.com"
	token, userID := createDebateVsBotTestUserAndToken(t, testEmail)

	defer func() {
		cleanupCtx, cCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cCancel()
		_, _ = db.DebateVsBotCollection.DeleteMany(cleanupCtx, bson.M{"email": testEmail})
		_, _ = db.MongoDatabase.Collection("users").DeleteOne(cleanupCtx, bson.M{"_id": userID})
	}()

	turnReq := DebateRequest{
		BotName:  "Rookie Rick",
		BotLevel: "Easy",
		Topic:    "Legacy Topic",
		Stance:   "Against",
		History:  []models.Message{{Sender: "User", Text: "Legacy turn"}},
	}
	turnBody, _ := json.Marshal(turnReq)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/vsbot/debate", bytes.NewReader(turnBody))
	c.Request.Header.Set("Authorization", "Bearer "+token)
	c.Request.Header.Set("Content-Type", "application/json")

	SendDebateMessage(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 for legacy request, got %d: %s", w.Code, w.Body.String())
	}

	var resp DebateMessageResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.DebateId == "" {
		t.Fatalf("expected legacy response to include generated debateId")
	}
}

// TestBotDebate_LegacyJudgeFallbackTargetsLatest verifies that a judge request
// without debateId updates the most recent session (not an arbitrary older one).
func TestBotDebate_LegacyJudgeFallbackTargetsLatest(t *testing.T) {
	setupDebateVsBotTestDB(t)

	testEmail := "legacyjudge@example.com"
	token, userID := createDebateVsBotTestUserAndToken(t, testEmail)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, _ = db.DebateVsBotCollection.DeleteMany(ctx, bson.M{"email": testEmail})
	defer func() {
		cleanupCtx, cCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cCancel()
		_, _ = db.DebateVsBotCollection.DeleteMany(cleanupCtx, bson.M{"email": testEmail})
		_, _ = db.MongoDatabase.Collection("users").DeleteOne(cleanupCtx, bson.M{"_id": userID})
	}()

	now := time.Now().Unix()
	oldID := primitive.NewObjectID()
	_, _ = db.DebateVsBotCollection.InsertOne(ctx, models.DebateVsBot{
		ID:        oldID,
		Email:     testEmail,
		BotName:   "Rookie Rick",
		Topic:     "Old Topic",
		CreatedAt: now - 100,
	})
	newID := primitive.NewObjectID()
	_, _ = db.DebateVsBotCollection.InsertOne(ctx, models.DebateVsBot{
		ID:        newID,
		Email:     testEmail,
		BotName:   "Philosopher Phil",
		Topic:     "New Topic",
		CreatedAt: now,
	})

	judgeReq := JudgeRequest{
		History: []models.Message{
			{Sender: "User", Text: "Legacy argument"},
			{Sender: "Bot", Text: "Legacy counter"},
		},
	}
	judgeBody, _ := json.Marshal(judgeReq)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/vsbot/judge", bytes.NewReader(judgeBody))
	c.Request.Header.Set("Authorization", "Bearer "+token)
	c.Request.Header.Set("Content-Type", "application/json")

	JudgeDebate(c)

	if w.Code != http.StatusOK {
		t.Fatalf("JudgeDebate failed with status %d: %s", w.Code, w.Body.String())
	}

	var oldDebate models.DebateVsBot
	if err := db.DebateVsBotCollection.FindOne(ctx, bson.M{"_id": oldID}).Decode(&oldDebate); err != nil {
		t.Fatalf("failed to load old debate: %v", err)
	}
	if oldDebate.Outcome != "" {
		t.Fatalf("expected older session to remain untouched, got outcome %q", oldDebate.Outcome)
	}

	var newDebate models.DebateVsBot
	if err := db.DebateVsBotCollection.FindOne(ctx, bson.M{"_id": newID}).Decode(&newDebate); err != nil {
		t.Fatalf("failed to load latest debate: %v", err)
	}
	if newDebate.Outcome != "win" && newDebate.Outcome != "loss" && newDebate.Outcome != "draw" {
		t.Fatalf("expected latest session outcome to be normalized, got %q", newDebate.Outcome)
	}
	if len(newDebate.History) != len(judgeReq.History) {
		t.Fatalf("expected latest session history length %d, got %d", len(judgeReq.History), len(newDebate.History))
	}

	t.Logf("Success: legacy judge updated latest session %s and left older session %s untouched", newID.Hex(), oldID.Hex())
}
