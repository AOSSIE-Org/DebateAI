package tests

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"arguehub/models"
	"arguehub/tests/testutils"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

// TestLiveServerHealth probes the live backend server if reachable to confirm active endpoint responses.
func TestLiveServerHealth(t *testing.T) {
	baseURL := "http://localhost:1313"
	client := &http.Client{Timeout: 1 * time.Second}

	resp, err := client.Get(baseURL + "/debug/matchmaking-pool")
	if err != nil {
		t.Logf("Live server is not running on %s (skipping live probe)", baseURL)
		return
	}
	defer resp.Body.Close()

	// Since debug route is protected without admin flags, 403 or 200 confirms the server is alive
	assert.Contains(t, []int{http.StatusOK, http.StatusForbidden}, resp.StatusCode,
		"Expected live server to respond with 200 or 403")
	t.Logf("Successfully verified live server at %s (Status: %d)", baseURL, resp.StatusCode)
}

// TestDBUserAuthFixtureFlow validates database user insertion, bcrypt credential check, and deferred cleanup.
func TestDBUserAuthFixtureFlow(t *testing.T) {
	testutils.WithTestDB(t, func(database *mongo.Database) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		usersCol := database.Collection("users")
		testEmail := fmt.Sprintf("testfixture_%d@debateai.test", time.Now().UnixNano())
		rawPassword := "SecureTestPassword123!"

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(rawPassword), bcrypt.DefaultCost)
		require.NoError(t, err)

		now := time.Now()
		testUser := models.User{
			Email:            testEmail,
			DisplayName:      "TestFixtureUser",
			Nickname:         "TestFixtureUser",
			Password:         string(hashedPassword),
			IsVerified:       true,
			Rating:           1200.0,
			RD:               350.0,
			Volatility:       0.06,
			LastRatingUpdate: now,
			CreatedAt:        now,
			UpdatedAt:        now,
		}

		// Insert test fixture
		res, err := usersCol.InsertOne(ctx, testUser)
		require.NoError(t, err, "Failed to insert test fixture into database")
		require.NotNil(t, res.InsertedID)

		// Guarantee atomic cleanup in defer
		defer func() {
			cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cleanupCancel()
			_, _ = usersCol.DeleteOne(cleanupCtx, bson.M{"email": testEmail})
		}()

		// Query fixture back
		var queriedUser models.User
		err = usersCol.FindOne(ctx, bson.M{"email": testEmail}).Decode(&queriedUser)
		require.NoError(t, err, "Failed to find inserted test fixture")
		assert.Equal(t, testEmail, queriedUser.Email)
		assert.True(t, queriedUser.IsVerified)

		// Verify password authentication logic against stored hash
		err = bcrypt.CompareHashAndPassword([]byte(queriedUser.Password), []byte(rawPassword))
		assert.NoError(t, err, "Password verification against hash should succeed")

		// Verify wrong password fails
		err = bcrypt.CompareHashAndPassword([]byte(queriedUser.Password), []byte("WrongPassword123!"))
		assert.Error(t, err, "Wrong password must fail authentication")
	})
}
