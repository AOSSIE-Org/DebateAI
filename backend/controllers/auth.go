package controllers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"arguehub/config"
	"arguehub/db"
	"arguehub/models"
	"arguehub/structs"
	"arguehub/utils"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsConfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

func SignUp(ctx *gin.Context) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return
	}

	var request structs.SignUpRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}

	err := signUpWithCognito(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, request.Password, ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to sign up", "message": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{"message": "Sign-up successful"})
}

func VerifyEmail(ctx *gin.Context) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return
	}

	var request structs.VerifyEmailRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}

	err := verifyEmailWithCognito(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, request.ConfirmationCode, ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to verify email", "message": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{"message": "Email verification successful"})
}

func Login(ctx *gin.Context) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return
	}

	var request structs.LoginRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid input",
			"message": "Check email and password format",
		})
		return
	}

	// 1) Attempt Cognito login
	token, err := loginWithCognito(
		cfg.Cognito.AppClientId,
		cfg.Cognito.AppClientSecret,
		request.Email,
		request.Password,
		ctx,
	)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":   "Failed to sign in",
			"message": "Invalid email or password",
		})
		return
	}

	// 2) After successful Cognito login, check if user exists in MongoDB
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existingUser models.User
	findErr := db.MongoDatabase.Collection("users").
		FindOne(dbCtx, bson.M{"email": request.Email}).
		Decode(&existingUser)

	if findErr != nil {
		if findErr == mongo.ErrNoDocuments {
			// User does NOT exist in the database. Creating a new user with default Elo=1200.
			newUser := models.User{
				Email:     request.Email,
				EloRating: 1200,
			}

			_, insertErr := db.MongoDatabase.Collection("users").InsertOne(dbCtx, newUser)
			if insertErr != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{
					"error":   "Failed to create user in database",
					"message": insertErr.Error(),
				})
				return
			}

		} else {
			ctx.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Database error",
				"message": findErr.Error(),
			})
			return
		}
	}
	ctx.JSON(http.StatusOK, gin.H{
		"message":     "Sign-in successful",
		"accessToken": token,
	})
}

func ForgotPassword(ctx *gin.Context) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return
	}

	var request structs.ForgotPasswordRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid input", "message": "Check email format"})
		return
	}

	_, err := initiateForgotPassword(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to initiate password reset", "message": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{"message": "Password reset initiated. Check your email for further instructions."})
}

func VerifyForgotPassword(ctx *gin.Context) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return
	}

	var request structs.VerifyForgotPasswordRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}

	_, err := confirmForgotPassword(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, request.Code, request.NewPassword, ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to confirm password reset", "message": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{"message": "Password successfully changed"})
}

func VerifyToken(ctx *gin.Context) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return
	}

	authHeader := ctx.GetHeader("Authorization")
	if authHeader == "" {
		ctx.JSON(401, gin.H{"error": "Missing token"})
		return
	}

	tokenParts := strings.Split(authHeader, " ")
	if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
		ctx.JSON(400, gin.H{"error": "Invalid token format"})
		return
	}
	token := tokenParts[1]

	valid, err := validateTokenWithCognito(cfg.Cognito.UserPoolId, token, ctx)
	if err != nil {
		ctx.JSON(401, gin.H{"error": "Invalid or expired token", "message": err.Error()})
		return
	}

	if !valid {
		ctx.JSON(401, gin.H{"error": "Token is invalid or expired"})
		return
	}

	ctx.JSON(200, gin.H{"message": "Token is valid"})
}

func loadConfig(ctx *gin.Context) *config.Config {
	cfgPath := os.Getenv("CONFIG_PATH")
	if cfgPath == "" {
		cfgPath = "./config/config.prod.yml"
	}
	cfg, err := config.LoadConfig(cfgPath)
	if err != nil {
		log.Println("Failed to load config")
		ctx.JSON(500, gin.H{"error": "Internal server error"})
		return nil
	}
	return cfg
}

func signUpWithCognito(appClientId, appClientSecret, email, password string, ctx *gin.Context) error {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return fmt.Errorf("failed to load configuration")
	}

	config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion(cfg.Cognito.Region))
	if err != nil {
		log.Println("Error loading AWS config:", err)
		return fmt.Errorf("failed to load AWS config: %v", err)
	}

	cognitoClient := cognitoidentityprovider.NewFromConfig(config)

	secretHash := utils.GenerateSecretHash(email, appClientId, appClientSecret)

	signupInput := cognitoidentityprovider.SignUpInput{
		ClientId:   aws.String(appClientId),
		Password:   aws.String(password),
		SecretHash: aws.String(secretHash),
		Username:   aws.String(email),
		UserAttributes: []types.AttributeType{
			{
				Name:  aws.String("email"),
				Value: aws.String(email),
			},
			{
				Name:  aws.String("nickname"),
				Value: aws.String(utils.ExtractNameFromEmail(email)),
			},
		},
	}

	signupStatus, err := cognitoClient.SignUp(ctx, &signupInput)
	if err != nil {
		log.Println("Error during sign-up:", err)
		return fmt.Errorf("sign-up failed: %v", err)
	}

	log.Println("Sign-up successful:", signupStatus)
	return nil
}

func verifyEmailWithCognito(appClientId, appClientSecret, email, confirmationCode string, ctx *gin.Context) error {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return fmt.Errorf("failed to load configuration")
	}

	config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion(cfg.Cognito.Region))
	if err != nil {
		return fmt.Errorf("failed to load AWS config: %v", err)
	}

	cognitoClient := cognitoidentityprovider.NewFromConfig(config)

	secretHash := utils.GenerateSecretHash(email, appClientId, appClientSecret)

	confirmSignUpInput := cognitoidentityprovider.ConfirmSignUpInput{
		ClientId:         aws.String(appClientId),
		ConfirmationCode: aws.String(confirmationCode),
		Username:         aws.String(email),
		SecretHash:       aws.String(secretHash),
	}

	confirmationStatus, err := cognitoClient.ConfirmSignUp(ctx, &confirmSignUpInput)
	if err != nil {
		log.Println("Error during email verification:", err)
		return fmt.Errorf("email verification failed: %v", err)
	}

	log.Println("Email verification successful:", confirmationStatus)
	return nil
}

func loginWithCognito(appClientId, appClientSecret, email, password string, ctx *gin.Context) (string, error) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return "", fmt.Errorf("failed to load configuration")
	}

	config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion(cfg.Cognito.Region))
	if err != nil {
		return "", fmt.Errorf("failed to load AWS config")
	}

	cognitoClient := cognitoidentityprovider.NewFromConfig(config)
	secretHash := utils.GenerateSecretHash(email, appClientId, appClientSecret)

	authInput := cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: types.AuthFlowTypeUserPasswordAuth,
		ClientId: aws.String(appClientId),
		AuthParameters: map[string]string{
			"USERNAME":    email,
			"PASSWORD":    password,
			"SECRET_HASH": secretHash,
		},
	}

	authOutput, err := cognitoClient.InitiateAuth(ctx, &authInput)
	if err != nil {
		return "", fmt.Errorf("authentication failed")
	}

	return *authOutput.AuthenticationResult.AccessToken, nil
}

func initiateForgotPassword(appClientId, appClientSecret, email string, ctx *gin.Context) (*cognitoidentityprovider.ForgotPasswordOutput, error) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return nil, fmt.Errorf("failed to load configuration")
	}

	config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion(cfg.Cognito.Region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config")
	}

	cognitoClient := cognitoidentityprovider.NewFromConfig(config)
	secretHash := utils.GenerateSecretHash(email, appClientId, appClientSecret)

	forgotPasswordInput := cognitoidentityprovider.ForgotPasswordInput{
		ClientId:   aws.String(appClientId),
		Username:   aws.String(email),
		SecretHash: aws.String(secretHash),
	}

	output, err := cognitoClient.ForgotPassword(ctx, &forgotPasswordInput)
	if err != nil {
		return nil, fmt.Errorf("error initiating forgot password: %v", err)
	}

	return output, nil
}

func confirmForgotPassword(appClientId, appClientSecret, email, code, newPassword string, ctx *gin.Context) (*cognitoidentityprovider.ConfirmForgotPasswordOutput, error) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return nil, fmt.Errorf("failed to load configuration")
	}

	config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion(cfg.Cognito.Region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config")
	}

	cognitoClient := cognitoidentityprovider.NewFromConfig(config)
	secretHash := utils.GenerateSecretHash(email, appClientId, appClientSecret)

	confirmForgotPasswordInput := cognitoidentityprovider.ConfirmForgotPasswordInput{
		ClientId:         aws.String(appClientId),
		Username:         aws.String(email),
		ConfirmationCode: aws.String(code),
		Password:         aws.String(newPassword),
		SecretHash:       aws.String(secretHash),
	}

	output, err := cognitoClient.ConfirmForgotPassword(ctx, &confirmForgotPasswordInput)
	if err != nil {
		return nil, fmt.Errorf("error confirming forgot password: %v", err)
	}

	return output, nil
}
func validateTokenWithCognito(userPoolId, token string, ctx *gin.Context) (bool, error) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return false, fmt.Errorf("failed to load configuration")
	}

	config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion(cfg.Cognito.Region))
	if err != nil {
		return false, fmt.Errorf("failed to load AWS config: %v", err)
	}
	cognitoClient := cognitoidentityprovider.NewFromConfig(config)

	getUserOutput, err := cognitoClient.GetUser(ctx, &cognitoidentityprovider.GetUserInput{
		AccessToken: &token,
	})
	if err != nil {
		return false, fmt.Errorf("token validation failed: %v", err)
	}

	for _, attr := range getUserOutput.UserAttributes {
		log.Printf("   %s = %s\n", *attr.Name, *attr.Value)
	}

	return true, nil
}
