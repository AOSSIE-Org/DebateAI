package controllers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
)

// hashResetCode returns a keyed HMAC-SHA256 of the reset code, hex-encoded.
// Keying with a server secret means the stored value can't be brute-forced
// offline from database contents alone (a plain hash of a 6-digit code would be).
// It's deterministic, so it still works with an exact-match lookup/update filter.
func hashResetCode(code, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(code))
	return hex.EncodeToString(mac.Sum(nil))
}
