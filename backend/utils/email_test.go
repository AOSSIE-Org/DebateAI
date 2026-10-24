package utils

import (
	"strings"
	"testing"
)

// legacyBrandName is the pre-rename product name. It must never reach users,
// so every user-facing email is checked against it.
const legacyBrandName = "arguehub"

func TestProductNameIsDebateAI(t *testing.T) {
	if ProductName != "DebateAI" {
		t.Errorf("ProductName = %q, expected %q", ProductName, "DebateAI")
	}
}

func TestVerificationEmailUsesDebateAIBrand(t *testing.T) {
	msg := string(buildVerificationEmail(
		"debater@example.com",
		"DebateAI Team",
		"noreply@debateai.test",
		"123456",
	))

	if !strings.Contains(msg, "Subject: Verify Your DebateAI Account") {
		t.Errorf("verification email subject is not branded with %q:\n%s", ProductName, msg)
	}

	if !strings.Contains(msg, "Welcome to DebateAI!") {
		t.Errorf("verification email body is not branded with %q:\n%s", ProductName, msg)
	}

	if strings.Contains(strings.ToLower(msg), legacyBrandName) {
		t.Errorf("verification email still contains the legacy brand name %q:\n%s", legacyBrandName, msg)
	}

	// The rest of the message must be unchanged by the rebranding.
	if !strings.Contains(msg, "To: debater@example.com") {
		t.Errorf("verification email lost its recipient:\n%s", msg)
	}

	if !strings.Contains(msg, "From: DebateAI Team <noreply@debateai.test>") {
		t.Errorf("verification email lost its sender:\n%s", msg)
	}

	if !strings.Contains(msg, "123456") {
		t.Errorf("verification email lost the verification code:\n%s", msg)
	}

	if !strings.Contains(msg, "This code will expire in 24 hours.") {
		t.Errorf("verification email lost its expiry notice:\n%s", msg)
	}
}

func TestPasswordResetEmailUsesDebateAIBrand(t *testing.T) {
	msg := string(buildPasswordResetEmail(
		"debater@example.com",
		"DebateAI Team",
		"noreply@debateai.test",
		"654321",
	))

	if !strings.Contains(msg, "Subject: DebateAI Password Reset") {
		t.Errorf("password reset email subject is not branded with %q:\n%s", ProductName, msg)
	}

	if strings.Contains(strings.ToLower(msg), legacyBrandName) {
		t.Errorf("password reset email still contains the legacy brand name %q:\n%s", legacyBrandName, msg)
	}

	if !strings.Contains(msg, "To: debater@example.com") {
		t.Errorf("password reset email lost its recipient:\n%s", msg)
	}

	if !strings.Contains(msg, "654321") {
		t.Errorf("password reset email lost the reset code:\n%s", msg)
	}

	if !strings.Contains(msg, "This code will expire in 15 minutes.") {
		t.Errorf("password reset email lost its expiry notice:\n%s", msg)
	}
}
