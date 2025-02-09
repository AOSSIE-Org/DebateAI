package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"regexp"
)

func GenerateSecretHash(username, clientId, clientSecret string) string {
	hmacInstance := hmac.New(sha256.New, []byte(clientSecret))
	hmacInstance.Write([]byte(username + clientId))
	secretHashByte := hmacInstance.Sum(nil)

	secretHashString := base64.StdEncoding.EncodeToString(secretHashByte)
	return secretHashString
}

func ExtractNameFromEmail(email string) string {
	re := regexp.MustCompile(`^([^@]+)`)
	match := re.FindStringSubmatch(email)
	return match[1]
}