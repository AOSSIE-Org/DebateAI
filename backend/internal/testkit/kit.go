package testkit

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"arguehub/db"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// JWTSecret matches jwt.secret in testdata/config.test.yml.
const JWTSecret = "test-jwt-secret-for-debateai-suite"

// ConfigPath returns the committed test config, independent of the gitignored production file.
func ConfigPath() string {
	candidates := []string{
		"testdata/config.test.yml",
		"../testdata/config.test.yml",
		"backend/testdata/config.test.yml",
	}
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			abs, err := filepath.Abs(candidate)
			if err == nil {
				return abs
			}
			return candidate
		}
	}
	return ""
}

// ConnectMongo connects to MONGO_TEST_URI, points the process at a fresh database,
// and drops that database when the test ends.
// A missing URI skips the test. A URI that does not answer fails the test.
func ConnectMongo(t *testing.T) *mongo.Database {
	t.Helper()

	uri := os.Getenv("MONGO_TEST_URI")
	if uri == "" {
		t.Skip("MONGO_TEST_URI is not set; database integration tests need an ephemeral MongoDB")
	}

	dbName := fmt.Sprintf("debateai_test_%d_%d", os.Getpid(), time.Now().UnixNano())
	targetURI, err := withDatabase(uri, dbName)
	if err != nil {
		t.Fatalf("parse MONGO_TEST_URI: %v", err)
	}

	var client *mongo.Client
	var lastErr error
	deadline := time.Now().Add(30 * time.Second)
	for {
		client, lastErr = mongo.Connect(context.Background(), options.Client().ApplyURI(targetURI))
		if lastErr == nil {
			pingCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			lastErr = client.Ping(pingCtx, nil)
			cancel()
			if lastErr == nil {
				break
			}
			_ = client.Disconnect(context.Background())
		}
		if time.Now().After(deadline) {
			t.Fatalf("MONGO_TEST_URI is set but MongoDB is unreachable: %v", lastErr)
		}
		time.Sleep(500 * time.Millisecond)
	}

	database := client.Database(dbName)
	prevClient := db.MongoClient
	prevDB := db.MongoDatabase
	db.MongoClient = client
	db.MongoDatabase = database

	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = database.Drop(ctx)
		_ = client.Disconnect(ctx)
		db.MongoClient = prevClient
		db.MongoDatabase = prevDB
	})

	return database
}

func withDatabase(uri, dbName string) (string, error) {
	parsed, err := url.Parse(uri)
	if err != nil {
		return "", err
	}
	parsed.Path = "/" + dbName
	return parsed.String(), nil
}

// StartSMTP serves a localhost SMTP endpoint and points SMTP_* env vars at it.
// Sign-up sends mail before it returns success, and PlainAuth allows this only for localhost.
func StartSMTP(t *testing.T) {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen smtp: %v", err)
	}
	t.Cleanup(func() { _ = listener.Close() })

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			go serveSMTP(conn)
		}
	}()

	_, port, err := net.SplitHostPort(listener.Addr().String())
	if err != nil {
		t.Fatalf("smtp port: %v", err)
	}
	if _, err := strconv.Atoi(port); err != nil {
		t.Fatalf("smtp port: %v", err)
	}

	t.Setenv("SMTP_HOST", "127.0.0.1")
	t.Setenv("SMTP_PORT", port)
	t.Setenv("SMTP_USERNAME", "test-user")
	t.Setenv("SMTP_PASSWORD", "test-password")
	t.Setenv("SMTP_SENDER_EMAIL", "noreply@debateai.test")
	t.Setenv("SMTP_SENDER_NAME", "DebateAI Test")
}

func serveSMTP(conn net.Conn) {
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
	reader := bufio.NewReader(conn)
	_, _ = conn.Write([]byte("220 localhost ESMTP debateai-test\r\n"))

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return
		}
		cmd := strings.ToUpper(strings.TrimSpace(line))
		switch {
		case strings.HasPrefix(cmd, "EHLO"), strings.HasPrefix(cmd, "HELO"):
			_, _ = conn.Write([]byte("250-localhost\r\n250 AUTH PLAIN LOGIN\r\n"))
		case strings.HasPrefix(cmd, "AUTH"):
			_, _ = conn.Write([]byte("235 Authentication successful\r\n"))
		case strings.HasPrefix(cmd, "DATA"):
			_, _ = conn.Write([]byte("354 End data with <CR><LF>.<CR><LF>\r\n"))
			for {
				dataLine, err := reader.ReadString('\n')
				if err != nil || strings.TrimSpace(dataLine) == "." {
					break
				}
			}
			_, _ = conn.Write([]byte("250 OK\r\n"))
		case strings.HasPrefix(cmd, "QUIT"):
			_, _ = conn.Write([]byte("221 Bye\r\n"))
			return
		default:
			_, _ = conn.Write([]byte("250 OK\r\n"))
		}
	}
}
