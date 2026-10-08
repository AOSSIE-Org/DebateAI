package utils

import (
	"strings"
	"testing"
)

func TestHashPasswordAndCheck(t *testing.T) {
	password := "SecretPass123!"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}
	if hash == "" || hash == password {
		t.Fatal("Hash should be non-empty and not plain text")
	}

	// Verify correct password
	if !CheckPasswordHash(password, hash) {
		t.Error("Expected CheckPasswordHash to return true for correct password")
	}

	// Verify incorrect password
	if CheckPasswordHash("WrongPassword", hash) {
		t.Error("Expected CheckPasswordHash to return false for wrong password")
	}
}

func TestExtractNameFromEmail(t *testing.T) {
	tests := []struct {
		email    string
		expected string
	}{
		{"alice@example.com", "alice"},
		{"john.doe@company.org", "john.doe"},
		{"test+alias@mail.net", "test+alias"},
		{"noatsymbol", "noatsymbol"},
	}

	for _, tt := range tests {
		result := ExtractNameFromEmail(tt.email)
		if result != tt.expected {
			t.Errorf("ExtractNameFromEmail(%q) = %q, expected %q", tt.email, result, tt.expected)
		}
	}
}

func TestGenerateRandomToken(t *testing.T) {
	lengths := []int{16, 32, 64}

	for _, length := range lengths {
		token, err := GenerateRandomToken(length)
		if err != nil {
			t.Fatalf("GenerateRandomToken(%d) returned error: %v", length, err)
		}
		if token == "" {
			t.Fatalf("GenerateRandomToken(%d) returned empty string", length)
		}
	}

	// Two consecutive tokens should be unique
	token1, _ := GenerateRandomToken(32)
	token2, _ := GenerateRandomToken(32)
	if token1 == token2 {
		t.Error("Expected consecutive random tokens to be distinct")
	}
}

func TestGenerateSecretHash(t *testing.T) {
	hash1 := GenerateSecretHash("user1", "client123", "secret456")
	hash2 := GenerateSecretHash("user1", "client123", "secret456")
	hash3 := GenerateSecretHash("user2", "client123", "secret456")

	if hash1 == "" {
		t.Fatal("Secret hash should not be empty")
	}
	if hash1 != hash2 {
		t.Errorf("Expected deterministic secret hash for identical inputs: %q != %q", hash1, hash2)
	}
	if hash1 == hash3 {
		t.Errorf("Expected different secret hashes for different users: %q == %q", hash1, hash3)
	}
}

func TestJWTTokenLifecycle(t *testing.T) {
	secret := "test-secret-key-for-jwt-unit-tests"
	SetJWTSecret(secret)

	if GetJWTSecret() != secret {
		t.Errorf("GetJWTSecret() = %q, expected %q", GetJWTSecret(), secret)
	}

	userID := "user-abc-123"
	email := "debater@debateai.org"

	token, err := GenerateJWTToken(userID, email)
	if err != nil {
		t.Fatalf("GenerateJWTToken failed: %v", err)
	}
	if token == "" || len(strings.Split(token, ".")) != 3 {
		t.Fatalf("Generated token is not a valid 3-part JWT: %q", token)
	}

	// Parse valid token
	claims, err := ParseJWTToken(token)
	if err != nil {
		t.Fatalf("ParseJWTToken failed on valid token: %v", err)
	}
	if claims.UserID != userID {
		t.Errorf("Expected UserID %q, got %q", userID, claims.UserID)
	}
	if claims.Email != email {
		t.Errorf("Expected Email %q, got %q", email, claims.Email)
	}

	// Test GetUserIDFromToken
	parsedUserID, err := GetUserIDFromToken(token)
	if err != nil {
		t.Fatalf("GetUserIDFromToken failed: %v", err)
	}
	if parsedUserID != userID {
		t.Errorf("GetUserIDFromToken = %q, expected %q", parsedUserID, userID)
	}

	// Test ValidateTokenAndFetchEmail
	valid, parsedEmail, err := ValidateTokenAndFetchEmail("", token, nil)
	if err != nil || !valid {
		t.Fatalf("ValidateTokenAndFetchEmail failed: valid=%v, err=%v", valid, err)
	}
	if parsedEmail != email {
		t.Errorf("ValidateTokenAndFetchEmail email = %q, expected %q", parsedEmail, email)
	}

	// Test invalid token
	_, err = ParseJWTToken("invalid.token.string")
	if err == nil {
		t.Error("Expected error parsing invalid token string, got nil")
	}

	// Test token verified with different secret
	SetJWTSecret("completely-different-secret-key")
	_, err = ParseJWTToken(token)
	if err == nil {
		t.Error("Expected error validating token signed with a different secret")
	}

	// Restore original secret
	SetJWTSecret(secret)
}
