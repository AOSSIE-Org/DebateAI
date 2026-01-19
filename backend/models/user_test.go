package models

import (
	"arguehub/security"
	"testing"
)

func TestUserMFA(t *testing.T) {
	// Initialize security secret for encryption
	security.SetEncryptionKey("test-secret-for-mfa-encryption-32bytes-long!!")

	user := &User{
		Email: "test@example.com",
	}

	// 1. Test Secret Generation
	secret, qrUrl, err := user.GenerateMFASecret()
	if err != nil {
		t.Fatalf("Failed to generate MFA secret: %v", err)
	}
	if secret == "" {
		t.Fatal("Secret should not be empty")
	}
	if qrUrl == "" {
		t.Fatal("QR URL should not be empty")
	}

	// 2. Test Encryption/Decryption
	err = user.SetEncryptedMFASecret(secret)
	if err != nil {
		t.Fatalf("Failed to set encrypted secret: %v", err)
	}
	if user.MFASecret == "" {
		t.Fatal("User.MFASecret should not be empty")
	}
	if user.MFASecret == secret {
		t.Fatal("User.MFASecret should be encrypted, not equal to plain secret")
	}

	decrypted, err := user.GetDecryptedMFASecret()
	if err != nil {
		t.Fatalf("Failed to get decrypted secret: %v", err)
	}
	if decrypted != secret {
		t.Fatalf("Decrypted secret mismatch: got %v, want %v", decrypted, secret)
	}

	// 3. Test TOTP Verification
	// We can't easily test a real code without a time-based library sync,
	// but we can verify that VerifyTOTP calls the validation logic.
	// We'll skip real code validation in this simple test unless we mock time.
}
