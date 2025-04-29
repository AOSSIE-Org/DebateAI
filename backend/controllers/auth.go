package controllers

import (
	"arguehub/config"
	"arguehub/structs"
	"arguehub/utils"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsConfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
	"github.com/gin-gonic/gin"
)

func getAwsConfig(ctx *gin.Context, region string) (aws.Config, error) {
	config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion(region))
	if err != nil {
		log.Printf("Error loading AWS config: %v", err)
		return aws.Config{}, fmt.Errorf("failed to load AWS config: %v", err)
	}
	return config, nil
}

func SignUp(ctx *gin.Context) {
	cfg, err := loadConfig(ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Internal server error", "message": err.Error()})
		return
	}
	if cfg == nil {
		return
	}

	var request structs.SignUpRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}

	err = signUpWithCognito(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, request.Password, cfg.Cognito.Region, ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to sign up", "message": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{"message": "Sign-up successful"})
}

func VerifyEmail(ctx *gin.Context) {
	cfg, err := loadConfig(ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Internal server error", "message": err.Error()})
		return
	}
	if cfg == nil {
		return
	}

	var request structs.VerifyEmailRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}

	err = verifyEmailWithCognito(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, request.ConfirmationCode, cfg.Cognito.Region, ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to verify email", "message": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{"message": "Email verification successful"})
}

func Login(ctx *gin.Context) {
	cfg, err := loadConfig(ctx)

	if err != nil {
		ctx.JSON(500, gin.H{"error": "Internal server error", "message": err.Error()})
		return
	}
	if cfg == nil {
		return
	}

	var request structs.LoginRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid input", "message": "Check email and password format"})
		return
	}

	token, err := loginWithCognito(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, request.Password, cfg.Cognito.Region, ctx)
	if err != nil {
		fmt.Println(err)
		ctx.JSON(401, gin.H{"error": "Failed to sign in", "message": "Invalid email or password"})
		return
	}

	ctx.JSON(200, gin.H{"message": "Sign-in successful", "accessToken": token})
}

func ForgotPassword(ctx *gin.Context) {
	cfg, err := loadConfig(ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Internal server error", "message": err.Error()})
		return
	}
	if cfg == nil {
		return
	}

	var request structs.ForgotPasswordRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid input", "message": "Check email format"})
		return
	}

	_, err = initiateForgotPassword(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, cfg.Cognito.Region, ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to initiate password reset", "message": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{"message": "Password reset initiated. Check your email for further instructions."})
}

func VerifyForgotPassword(ctx *gin.Context) {
	cfg, err := loadConfig(ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Internal server error", "message": err.Error()})
		return
	}
	if cfg == nil {
		return
	}

	var request structs.VerifyForgotPasswordRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}

	_, err = confirmForgotPassword(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, request.Code, request.NewPassword, cfg.Cognito.Region, ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to confirm password reset", "message": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{"message": "Password successfully changed"})
}

func VerifyToken(ctx *gin.Context) {
	cfg, err := loadConfig(ctx)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Internal server error", "message": err.Error()})
		return
	}

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

	valid, err := validateTokenWithCognito(cfg.Cognito.UserPoolId, token, cfg.Cognito.Region, ctx)
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

func loadConfig(ctx *gin.Context) (*config.Config, error) {
	cfgPath := os.Getenv("CONFIG_PATH")
	if cfgPath == "" {
		cfgPath = "./config/config.prod.yml"
	}
	cfg, err := config.LoadConfig(cfgPath)
	if err != nil {
		log.Printf("Failed to load config from %s: %v", cfgPath, err)
		return nil, fmt.Errorf("failed to load config: %v", err)
	}
	return cfg, nil
}

func signUpWithCognito(appClientId, appClientSecret, email, password, region string, ctx *gin.Context) error {
	cfg, err := loadConfig(ctx)
	if cfg == nil {
		return fmt.Errorf("failed to load config")
	}

	config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion(cfg.Cognito.Region)) // TODO: Hardcoded value should be replaced
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
	fmt.Println("Testing: ", appClientId)
	signupStatus, err := cognitoClient.SignUp(ctx, &signupInput)
	if err != nil {
		log.Println("Error during sign-up:", err)
		return fmt.Errorf("sign-up failed: %v", err)
	}

	log.Println("Sign-up successful:", signupStatus)
	return nil
}

func verifyEmailWithCognito(appClientId, appClientSecret, email, confirmationCode, region string, ctx *gin.Context) error {
	config, err := getAwsConfig(ctx, region)

	if err != nil {
		log.Println("Error loading AWS config:", err)
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

func loginWithCognito(appClientId, appClientSecret, email, password, region string, ctx *gin.Context) (string, error) {
	config, err := getAwsConfig(ctx, region)
	// if cfg == nil {
	// 	return "",fmt.Errorf("failed to load config")
	// }
	if err != nil {
		fmt.Println(err)
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
	fmt.Println(email)
	fmt.Println(appClientId)
	fmt.Println(secretHash)

	authOutput, err := cognitoClient.InitiateAuth(ctx, &authInput)
	if err != nil {
		return "", fmt.Errorf("authentication failed")
	}

	return *authOutput.AuthenticationResult.AccessToken, nil
}

func initiateForgotPassword(appClientId, appClientSecret, email, region string, ctx *gin.Context) (*cognitoidentityprovider.ForgotPasswordOutput, error) {
	config, err := getAwsConfig(ctx, region)
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

func confirmForgotPassword(appClientId, appClientSecret, email, code, newPassword, region string, ctx *gin.Context) (*cognitoidentityprovider.ConfirmForgotPasswordOutput, error) {
	config, err := getAwsConfig(ctx, region)

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

func validateTokenWithCognito(userPoolId, token, region string, ctx *gin.Context) (bool, error) {
	config, err := getAwsConfig(ctx, region)

	if err != nil {
		return false, fmt.Errorf("failed to load AWS config")
	}

	cognitoClient := cognitoidentityprovider.NewFromConfig(config)

	_, err = cognitoClient.GetUser(ctx, &cognitoidentityprovider.GetUserInput{
		AccessToken: aws.String(token),
	})
	if err != nil {
		log.Println("Token verification failed:", err)
		return false, fmt.Errorf("token validation failed: %v", err)
	}

	return true, nil
}
