package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"

	"arguehub/config"

	awsConfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/gin-gonic/gin"
)

// Config holds Cognito secret configuration
type Config struct {
	CognitoSecret string `json:"cognito_secret"`
}

// GenerateSecretHash creates a secret hash for Cognito flows
func GenerateSecretHash(username, clientId, clientSecret string) string {
	hmacInstance := hmac.New(sha256.New, []byte(clientSecret))
	hmacInstance.Write([]byte(username + clientId))
	secretHashByte := hmacInstance.Sum(nil)
	return base64.StdEncoding.EncodeToString(secretHashByte)
}

// ExtractNameFromEmail extracts the username before '@'
func ExtractNameFromEmail(email string) string {
	re := regexp.MustCompile(`^([^@]+)`)
	match := re.FindStringSubmatch(email)
	if len(match) < 2 {
		return email
	}
	return match[1]
}

// ValidateTokenAndFetchEmail verifies a Cognito access token and retrieves email
func ValidateTokenAndFetchEmail(configPath, token string, ctx *gin.Context) (bool, string, error) {
	// Load application config
	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		return false, "", fmt.Errorf("failed to load config: %v", err)
	}

	// Initialize AWS config with region
	awsCfg, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion(cfg.Cognito.Region))
	if err != nil {
		return false, "", fmt.Errorf("failed to load AWS config: %v", err)
	}

	// Create Cognito client
	cognitoClient := cognitoidentityprovider.NewFromConfig(awsCfg)

	// Validate token with Cognito GetUser
	getUserOutput, err := cognitoClient.GetUser(ctx, &cognitoidentityprovider.GetUserInput{
		AccessToken: &token,
	})
	if err != nil {
		return false, "", fmt.Errorf("token validation failed: %v", err)
	}

	// Extract email from user attributes
	var email string
	for _, attr := range getUserOutput.UserAttributes {
		if *attr.Name == "email" {
			email = *attr.Value
			break
		}
	}
	if email == "" {
		return false, "", errors.New("email not found in token")
	}

	return true, email, nil
}
