package db

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"

	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const settlementTestDBName = "debateai_settlement_test"

func setupSettlementTestDB(t *testing.T) {
	t.Helper()

	uri := os.Getenv("MONGO_TEST_URI")
	if uri == "" {
		t.Skip("set MONGO_TEST_URI to run MongoDB integration tests")
	}

	parsed, err := url.Parse(uri)
	if err != nil {
		t.Fatalf("parse MONGO_TEST_URI: %v", err)
	}

	if parsed.Path != "/"+settlementTestDBName {
		t.Fatalf(
			"refusing to run destructive tests against database %q; expected %q",
			parsed.Path,
			"/"+settlementTestDBName,
		)
	}

	oldClient := MongoClient
	oldDatabase := MongoDatabase
	oldDebates := DebateVsBotCollection
	oldTournaments := TournamentCollection

	if err := ConnectMongoDB(uri); err != nil {
		t.Fatalf("connect to test MongoDB: %v", err)
	}

	testClient := MongoClient
	testDB := MongoDatabase

	t.Cleanup(func() {
		_ = testClient.Disconnect(context.Background())
		MongoClient = oldClient
		MongoDatabase = oldDatabase
		DebateVsBotCollection = oldDebates
		TournamentCollection = oldTournaments
	})

	// These tests are destructive. The database-name guard above ensures
	// they only clear collections in the dedicated settlement test database.
	for _, name := range []string{
		"debates_vs_bot",
		"users",
		"score_updates",
	} {
		if err := testDB.Collection(name).Drop(context.Background()); err != nil {
			var commandErr mongo.CommandError
			if !errors.As(err, &commandErr) || commandErr.Code != 26 {
				t.Fatalf("drop test collection %q: %v", name, err)
			}
		}
	}

	if err := EnsureIndexes(); err != nil {
		t.Fatalf("ensure test indexes: %v", err)
	}
}

type settlementFixture struct {
	debateID primitive.ObjectID
	userID   primitive.ObjectID
	email    string
}

func seedSettlementFixture(t *testing.T) settlementFixture {
	t.Helper()

	ctx := context.Background()
	fixture := settlementFixture{
		debateID: primitive.NewObjectID(),
		userID:   primitive.NewObjectID(),
		email:    fmt.Sprintf("%s@example.test", primitive.NewObjectID().Hex()),
	}

	user := models.User{
		ID:          fixture.userID,
		Email:       fixture.email,
		DisplayName: "test-" + fixture.userID.Hex(),
		Score:       0,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if _, err := MongoDatabase.Collection("users").InsertOne(ctx, user); err != nil {
		t.Fatalf("insert test user: %v", err)
	}

	debate := models.DebateVsBot{
		ID:        fixture.debateID,
		Email:     fixture.email,
		BotName:   "TestBot",
		BotLevel:  "medium",
		Topic:     "Integration test topic",
		Outcome:   "pending",
		CreatedAt: time.Now().Unix(),
	}

	if _, err := DebateVsBotCollection.InsertOne(ctx, debate); err != nil {
		t.Fatalf("insert test debate: %v", err)
	}

	return fixture
}

func readTestScore(t *testing.T, userID primitive.ObjectID) int {
	t.Helper()

	var user models.User
	err := MongoDatabase.Collection("users").FindOne(
		context.Background(),
		bson.M{"_id": userID},
	).Decode(&user)
	if err != nil {
		t.Fatalf("read test user: %v", err)
	}
	return user.Score
}

func countTestScoreUpdates(t *testing.T, debateID primitive.ObjectID) int64 {
	t.Helper()

	count, err := MongoDatabase.Collection("score_updates").CountDocuments(
		context.Background(),
		bson.M{"debateId": debateID.Hex()},
	)
	if err != nil {
		t.Fatalf("count score updates: %v", err)
	}
	return count
}

func TestSettleBotDebate_SuccessAndRetryAreIdempotent(t *testing.T) {
	setupSettlementTestDB(t)
	fixture := seedSettlementFixture(t)

	judgment := `{"verdict":{"winner":"user"}}`

	first, err := SettleBotDebate(
		context.Background(),
		fixture.debateID,
		fixture.email,
		"win",
		judgment,
	)
	if err != nil {
		t.Fatalf("first settlement failed: %v", err)
	}
	if first.AlreadySettled {
		t.Fatal("first settlement unexpectedly marked as already settled")
	}
	if first.ResultStatus != "win" {
		t.Fatalf("expected win, got %q", first.ResultStatus)
	}

	_, err = SettleBotDebate(
		context.Background(),
		fixture.debateID,
		fixture.email,
		"loss",
		`{"verdict":{"winner":"bot"}}`,
	)

	if !errors.Is(err, ErrDebateAlreadySettled) {
		t.Fatalf("expected ErrDebateAlreadySettled, got %v", err)
	}

	if got := readTestScore(t, fixture.userID); got != 50 {
		t.Fatalf("conflicting retry changed score to %d", got)
	}
	if got := countTestScoreUpdates(t, fixture.debateID); got != 1 {
		t.Fatalf("expected exactly one score update, got %d", got)
	}
}

func TestSettleBotDebate_RejectsConflictingOperation(t *testing.T) {
	setupSettlementTestDB(t)
	fixture := seedSettlementFixture(t)

	_, err := SettleBotDebate(
		context.Background(),
		fixture.debateID,
		fixture.email,
		"win",
		`{"verdict":{"winner":"user"}}`,
	)
	if err != nil {
		t.Fatalf("initial settlement failed: %v", err)
	}

	_, err = SettleBotDebate(
		context.Background(),
		fixture.debateID,
		fixture.email,
		"loss",
		"",
	)
	if !errors.Is(err, ErrDebateAlreadySettled) {
		t.Fatalf("expected ErrDebateAlreadySettled, got %v", err)
	}

	if got := readTestScore(t, fixture.userID); got != 50 {
		t.Fatalf("conflicting operation changed score to %d", got)
	}
	if got := countTestScoreUpdates(t, fixture.debateID); got != 1 {
		t.Fatalf("expected one score update, got %d", got)
	}
}

func TestSettleBotDebate_ConcurrentRetriesAwardOnce(t *testing.T) {
	setupSettlementTestDB(t)
	fixture := seedSettlementFixture(t)

	const workers = 2
	start := make(chan struct{})
	errs := make(chan error, workers)

	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start

			_, err := SettleBotDebate(
				context.Background(),
				fixture.debateID,
				fixture.email,
				"win",
				`{"verdict":{"winner":"user"}}`,
			)
			errs <- err
		}()
	}

	close(start)
	wg.Wait()
	close(errs)

	for err := range errs {
		if err != nil && !errors.Is(err, ErrDebateAlreadySettled) {
			t.Errorf("unexpected concurrent settlement error: %v", err)
		}
	}

	if got := readTestScore(t, fixture.userID); got != 50 {
		t.Fatalf("expected exactly 50 points, got %d", got)
	}
	if got := countTestScoreUpdates(t, fixture.debateID); got != 1 {
		t.Fatalf("expected exactly one score update, got %d", got)
	}
}

func TestSettleBotDebate_RollsBackWhenScoreUpdateInsertFails(t *testing.T) {
	setupSettlementTestDB(t)
	fixture := seedSettlementFixture(t)

	// Reject every score_updates insert. The debate update and score
	// increment must roll back with the failed insert.
	err := MongoDatabase.RunCommand(
		context.Background(),
		bson.D{
			{Key: "collMod", Value: "score_updates"},
			{Key: "validator", Value: bson.M{"rejectInsert": true}},
		},
	).Err()
	if err != nil {
		t.Fatalf("configure test-only rejecting validator: %v", err)
	}

	_, err = SettleBotDebate(
		context.Background(),
		fixture.debateID,
		fixture.email,
		"win",
		`{"verdict":{"winner":"user"}}`,
	)
	if err == nil {
		t.Fatal("expected settlement to fail when score update insert is rejected")
	}

	var debate models.DebateVsBot
	if err := DebateVsBotCollection.FindOne(
		context.Background(),
		bson.M{"_id": fixture.debateID},
	).Decode(&debate); err != nil {
		t.Fatalf("read debate after rollback: %v", err)
	}
	if debate.Outcome != "pending" {
		t.Fatalf("expected debate outcome to roll back to pending, got %q", debate.Outcome)
	}
	if !debate.SettledAt.IsZero() {
		t.Fatal("expected settledAt to roll back")
	}
	if debate.Judgment != "" {
		t.Fatalf("expected judgment to roll back, got %q", debate.Judgment)
	}
	if got := readTestScore(t, fixture.userID); got != 0 {
		t.Fatalf("expected score to roll back to 0, got %d", got)
	}
	if got := countTestScoreUpdates(t, fixture.debateID); got != 0 {
		t.Fatalf("expected no score update records, got %d", got)
	}
}

func TestSettleBotDebate_RejectsInvalidOutcome(t *testing.T) {
	setupSettlementTestDB(t)
	fixture := seedSettlementFixture(t)

	_, err := SettleBotDebate(
		context.Background(),
		fixture.debateID,
		fixture.email,
		"invalid",
		"",
	)
	if err == nil {
		t.Fatal("expected an error for invalid outcome")
	}
	if err.Error() != `invalid debate outcome "invalid"` {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSettleBotDebate_RepeatedConcessionAwardsOnce(t *testing.T) {
	setupSettlementTestDB(t)
	fixture := seedSettlementFixture(t)

	// A concession is represented as a loss with no judgment.
	first, err := SettleBotDebate(
		context.Background(),
		fixture.debateID,
		fixture.email,
		"loss",
		"",
	)
	if err != nil {
		t.Fatalf("first concession failed: %v", err)
	}
	if first.AlreadySettled {
		t.Fatal("first concession unexpectedly marked as already settled")
	}

	// Retrying the same concession must not award points again.
	retry, err := SettleBotDebate(
		context.Background(),
		fixture.debateID,
		fixture.email,
		"loss",
		"",
	)
	if err != nil {
		t.Fatalf("repeated concession failed: %v", err)
	}
	if !retry.AlreadySettled {
		t.Fatal("expected repeated concession to be marked as already settled")
	}

	if got := readTestScore(t, fixture.userID); got != 10 {
		t.Fatalf("expected exactly 10 loss points, got %d", got)
	}
	if got := countTestScoreUpdates(t, fixture.debateID); got != 1 {
		t.Fatalf("expected exactly one score update, got %d", got)
	}
}

func TestSettleBotDebate_ConcessionCannotBeOverwrittenByJudgment(t *testing.T) {
	setupSettlementTestDB(t)
	fixture := seedSettlementFixture(t)

	_, err := SettleBotDebate(
		context.Background(),
		fixture.debateID,
		fixture.email,
		"loss",
		"",
	)
	if err != nil {
		t.Fatalf("initial concession failed: %v", err)
	}

	_, err = SettleBotDebate(
		context.Background(),
		fixture.debateID,
		fixture.email,
		"win",
		`{"verdict":{"winner":"user"}}`,
	)
	if !errors.Is(err, ErrDebateAlreadySettled) {
		t.Fatalf("expected ErrDebateAlreadySettled, got %v", err)
	}

	if got := readTestScore(t, fixture.userID); got != 10 {
		t.Fatalf("expected concession score to remain 10, got %d", got)
	}
	if got := countTestScoreUpdates(t, fixture.debateID); got != 1 {
		t.Fatalf("expected exactly one score update, got %d", got)
	}
}

func TestSettleBotDebate_MissingUserRollsBack(t *testing.T) {
	setupSettlementTestDB(t)

	ctx := context.Background()
	fixture := settlementFixture{
		debateID: primitive.NewObjectID(),
		userID:   primitive.NewObjectID(),
		email:    fmt.Sprintf("%s@example.test", primitive.NewObjectID().Hex()),
	}

	// Intentionally insert a debate without creating its user.
	debate := models.DebateVsBot{
		ID:        fixture.debateID,
		Email:     fixture.email,
		BotName:   "TestBot",
		BotLevel:  "medium",
		Topic:     "Missing user integration test",
		Outcome:   "pending",
		CreatedAt: time.Now().Unix(),
	}
	if _, err := DebateVsBotCollection.InsertOne(ctx, debate); err != nil {
		t.Fatalf("insert test debate: %v", err)
	}

	_, err := SettleBotDebate(
		ctx,
		fixture.debateID,
		fixture.email,
		"win",
		`{"verdict":{"winner":"user"}}`,
	)
	if err == nil {
		t.Fatal("expected settlement to fail when the user is missing")
	}

	var stored models.DebateVsBot
	if err := DebateVsBotCollection.FindOne(
		ctx,
		bson.M{"_id": fixture.debateID},
	).Decode(&stored); err != nil {
		t.Fatalf("read debate after failed settlement: %v", err)
	}
	if stored.Outcome != "pending" {
		t.Fatalf("expected pending outcome after rollback, got %q", stored.Outcome)
	}
	if !stored.SettledAt.IsZero() {
		t.Fatal("expected settledAt to remain zero")
	}
	if stored.Judgment != "" {
		t.Fatalf("expected empty judgment after rollback, got %q", stored.Judgment)
	}

	if got := countTestScoreUpdates(t, fixture.debateID); got != 0 {
		t.Fatalf("expected no score update records, got %d", got)
	}

	// Verify the user was not accidentally created.
	err = MongoDatabase.Collection("users").FindOne(
		ctx,
		bson.M{"email": fixture.email},
	).Err()
	if !errors.Is(err, mongo.ErrNoDocuments) {
		t.Fatalf("expected no user record, got error %v", err)
	}
}

func TestSettleBotDebate_RetriesCommitAfterConnectionDrop(t *testing.T) {
	setupSettlementTestDB(t)
	fixture := seedSettlementFixture(t)

	ctx := context.Background()
	adminDB := MongoClient.Database("admin")

	// Fail the first commitTransaction command by closing its connection.
	// The Go driver should retry the commit operation.
	err := adminDB.RunCommand(ctx, bson.D{
		{Key: "configureFailPoint", Value: "failCommand"},
		{Key: "mode", Value: bson.M{"times": 1}},
		{Key: "data", Value: bson.M{
			"failCommands":    bson.A{"commitTransaction"},
			"closeConnection": true,
		}},
	}).Err()
	if err != nil {
		t.Fatalf("enable commit failpoint: %v", err)
	}

	// Always disable the failpoint, including when an assertion fails.
	t.Cleanup(func() {
		disableCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		_ = adminDB.RunCommand(disableCtx, bson.D{
			{Key: "configureFailPoint", Value: "failCommand"},
			{Key: "mode", Value: "off"},
		}).Err()
	})

	result, settleErr := SettleBotDebate(
		ctx,
		fixture.debateID,
		fixture.email,
		"win",
		`{"verdict":{"winner":"user"}}`,
	)
	if settleErr != nil {
		t.Fatalf("settlement failed after simulated commit connection drop: %v", settleErr)
	}
	if result == nil {
		t.Fatal("expected a settlement result")
	}
	if result.ResultStatus != "win" {
		t.Fatalf("expected win, got %q", result.ResultStatus)
	}

	// The transaction must have committed all its effects exactly once.
	if got := readTestScore(t, fixture.userID); got != 50 {
		t.Fatalf("expected score 50, got %d", got)
	}
	if got := countTestScoreUpdates(t, fixture.debateID); got != 1 {
		t.Fatalf("expected exactly one score update, got %d", got)
	}

	var stored models.DebateVsBot
	if err := DebateVsBotCollection.FindOne(
		ctx,
		bson.M{"_id": fixture.debateID},
	).Decode(&stored); err != nil {
		t.Fatalf("read settled debate: %v", err)
	}
	if stored.Outcome != "win" {
		t.Fatalf("expected stored outcome win, got %q", stored.Outcome)
	}
	if stored.Judgment == "" || stored.SettledAt.IsZero() {
		t.Fatal("expected judgment and settledAt to be persisted")
	}
}
