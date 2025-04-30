package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
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

func ValidateTokenAndFetchEmail(configPath, token string, ctx *gin.Context) (bool, string, error) {
	log.Printf("Starting token validation...")
	log.Printf("Attempting to load config from path: %s", configPath) // Log path every time

	// Load application config
	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		log.Printf("Error loading config: %v", err)
		return false, "", fmt.Errorf("failed to load config: %v", err)
	}
	log.Println("Config loaded successfully.")

	// Initialize AWS config with region
	awsCfg, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion(cfg.Cognito.Region))
	if err != nil {
		log.Printf("Error loading AWS config: %v", err)
		return false, "", fmt.Errorf("failed to load AWS config: %v", err)
	}
	log.Println("AWS config loaded successfully.")

	// Create Cognito client
	cognitoClient := cognitoidentityprovider.NewFromConfig(awsCfg)
	log.Println("Cognito client initialized.")

	// Validate token with Cognito GetUser
	getUserOutput, err := cognitoClient.GetUser(ctx, &cognitoidentityprovider.GetUserInput{
		AccessToken: &token,
	})
	if err != nil {
		log.Printf("Token validation failed: %v", err)
		return false, "", fmt.Errorf("token validation failed: %v", err)
	}
	log.Println("Token validation successful.")

	// Extract email from user attributes
	var email string
	for _, attr := range getUserOutput.UserAttributes {
		log.Printf("Found attribute: %s = %s", *attr.Name, *attr.Value)
		if *attr.Name == "email" {
			email = *attr.Value
			break
		}
	}

	if email == "" {
		log.Println("Email not found in token.")
		return false, "", errors.New("email not found in token")
	}

	log.Printf("Email retrieved successfully: %s", email)
	return true, email, nil
}
