package utils

import (
	"context"
	"log"
	"os"
	"time"

	"arguehub/config"
	"arguehub/db"

	"github.com/stretchr/testify/mock"
)

// SetupTestDB initializes a connection to a test database
// In a real scenario, this might spin up a Docker container or use a dedicated test DB URI
func SetupTestDB() {
	// Use a distinct test database URI or name
	testURI := os.Getenv("TEST_MONGO_URI")
	if testURI == "" {
		testURI = "mongodb://localhost:27017/debateai_test"
	}

	err := db.ConnectMongoDB(testURI)
	if err != nil {
		log.Fatalf("Failed to connect to test database: %v", err)
	}
	
	// Ensure we are starting with a clean slate
	err = db.MongoDatabase.Drop(context.Background())
	if err != nil {
		log.Printf("Warning: Failed to drop test database: %v", err)
	}
}

// TeardownTestDB cleans up the test database
func TeardownTestDB() {
	if db.MongoDatabase != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := db.MongoDatabase.Drop(ctx); err != nil {
			log.Printf("Failed to drop test database during teardown: %v", err)
		}
		if db.MongoClient != nil {
			if err := db.MongoClient.Disconnect(ctx); err != nil {
				log.Printf("Failed to disconnect from test database: %v", err)
			}
		}
	}
}

// LoadTestConfig loads configuration specifically for testing
func LoadTestConfig() *config.Config {
	// Constructing config based on config/config.go definition
	cfg := &config.Config{}
	
	// JWT
	cfg.JWT.Secret = "test-secret-key"
	cfg.JWT.Expiry = 60

	// Database (was Mongo in previous attempt, but struct has Database)
	cfg.Database.URI = "mongodb://localhost:27017/debateai_test"

	// GoogleOAuth (only ClientID is defined in struct)
	cfg.GoogleOAuth.ClientID = "test-client-id"

	// Gemini
	cfg.Gemini.ApiKey = "test-gemini-key"

	return cfg
}

// MockGeminiClient is a mock for external AI service interactions
type MockGeminiClient struct {
	mock.Mock
}

func (m *MockGeminiClient) GenerateContent(ctx context.Context, prompt string) (string, error) {
	args := m.Called(ctx, prompt)
	return args.String(0), args.Error(1)
}
