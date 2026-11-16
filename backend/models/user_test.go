package models

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestUserJSONOmissionAndPublicDTO(t *testing.T) {
	now := time.Now().UTC()
	user := User{
		ID:                      primitive.NewObjectID(),
		Email:                   "secret@example.com",
		DisplayName:             "TestUser",
		Nickname:                "tester",
		Password:                "$2a$10$supersecrethashvalue",
		VerificationCode:        "987654",
		VerificationCodeExpiry:  now.Add(time.Hour),
		VerificationCodeSentAt:  now,
		ResetPasswordCode:       "123456",
		ResetPasswordCodeExpiry: now.Add(time.Hour),
	}

	// 1. Verify sensitive fields are omitted when marshaling User directly
	userBytes, err := json.Marshal(user)
	if err != nil {
		t.Fatalf("failed to marshal User: %v", err)
	}
	userJSON := string(userBytes)

	forbiddenSecrets := []string{
		"$2a$10$supersecrethashvalue",
		"987654",
		"123456",
		"verificationCodeExpiry",
		"verificationCodeSentAt",
		"resetPasswordCodeExpiry",
	}
	for _, secret := range forbiddenSecrets {
		if strings.Contains(userJSON, secret) {
			t.Errorf("User JSON leaked sensitive field/value %q: %s", secret, userJSON)
		}
	}

	// 2. Verify PublicUserDTO omits email and all secret fields
	dtoBytes, err := json.Marshal(user.ToPublicDTO())
	if err != nil {
		t.Fatalf("failed to marshal PublicUserDTO: %v", err)
	}
	dtoJSON := string(dtoBytes)

	if strings.Contains(dtoJSON, "secret@example.com") {
		t.Errorf("PublicUserDTO leaked email: %s", dtoJSON)
	}
	for _, secret := range forbiddenSecrets {
		if strings.Contains(dtoJSON, secret) {
			t.Errorf("PublicUserDTO leaked sensitive field/value %q: %s", secret, dtoJSON)
		}
	}
}