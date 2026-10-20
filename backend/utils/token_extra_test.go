package utils

import (
	"errors"
	"testing"
	"time"
	"unicode"

	"github.com/golang-jwt/jwt/v5"
)

func TestParseJWTTokenExpired(t *testing.T) {
	secret := "test-secret-key-for-jwt-unit-tests"
	SetJWTSecret(secret)

	claims := &Claims{
		Email: "debater@debateai.org",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Minute)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	_, err = ParseJWTToken(signed)
	if !errors.Is(err, ErrTokenExpired) {
		t.Fatalf("ParseJWTToken error = %v, want ErrTokenExpired", err)
	}
}

func TestGenerateRandomCodeDigits(t *testing.T) {
	code := GenerateRandomCode(6)
	if len(code) != 6 {
		t.Fatalf("length = %d", len(code))
	}
	for _, ch := range code {
		if !unicode.IsDigit(ch) {
			t.Fatalf("code %q contains non-digit %q", code, ch)
		}
	}
}
