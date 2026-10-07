package models_test

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestUserJSONSerialization_DoesNotExposeSensitiveFields(t *testing.T) {
	user := models.User{
		ID:                      primitive.NewObjectID(),
		Email:                   "testuser@example.com",
		DisplayName:             "Test User",
		Password:                "super_secret_bcrypt_hash",
		VerificationCode:        "123456",
		VerificationCodeExpiry:  time.Now().Add(15 * time.Minute),
		VerificationCodeSentAt:  time.Now(),
		ResetPasswordCode:       "reset_code_xyz",
		ResetPasswordCodeExpiry: time.Now().Add(15 * time.Minute),
		Rating:                  1250.0,
		Score:                   10,
	}

	bytes, err := json.Marshal(user)
	if err != nil {
		t.Fatalf("failed to marshal user to JSON: %v", err)
	}

	jsonString := string(bytes)

	sensitiveKeywords := []string{
		"super_secret_bcrypt_hash",
		"123456",
		"reset_code_xyz",
		"\"Password\"",
		"\"password\"",
		"\"VerificationCode\"",
		"\"verificationCode\"",
		"\"ResetPasswordCode\"",
		"\"resetPasswordCode\"",
	}

	for _, kw := range sensitiveKeywords {
		if strings.Contains(jsonString, kw) {
			t.Errorf("expected JSON to not contain sensitive keyword %q, but got: %s", kw, jsonString)
		}
	}
}
