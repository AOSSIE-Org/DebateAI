package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"os"
	"regexp"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv" // Importing godotenv
)

var (
	appClientId     string
	appClientSecret string
)

func init() {
	// Load environment variables from the .env file
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Error loading .env file")
	}

	// Read the Cognito App Client ID and Secret from the environment variables
	appClientId = os.Getenv("COGNITO_APP_CLIENT_ID")
	appClientSecret = os.Getenv("COGNITO_APP_CLIENT_SECRET")

	if appClientId == "" || appClientSecret == "" {
		fmt.Println("COGNITO_APP_CLIENT_ID and COGNITO_APP_CLIENT_SECRET must be set in .env file")
	}
}



func SignUpRouteHandler(ctx *gin.Context){
	fmt.Println("signing up");
	
	password := "abc123!"
	email := "keshavnischal@gmail.com";

	signUpWithCognito(email, password);
	ctx.JSON(200, "signing up");
}
func signUpWithCognito(email string, password string) {
	ctx := context.Background()
	config, err := config.LoadDefaultConfig(ctx, config.WithRegion("ap-south-1"))

	if err != nil {
		fmt.Println("Error:", err)
	} else {
		fmt.Println("Successfully Loaded the cognito config for signUp")
	}

	cognitoClient := cognitoidentityprovider.NewFromConfig(config)

	// Validate the email format using regex
	if !isValidEmail(email) {
		fmt.Println("Invalid email format.")
		return
	}

	// Validate the nickname extracted from email
	nickname := extractNameFromEmail(email)
	if len(nickname) == 0 {
		fmt.Println("Nickname cannot be empty.")
		return
	}

	// Validate the password (e.g., at least 8 characters)
	if !isValidPassword(password) {
		fmt.Println("Password is too weak.")
		return
	}

	secretHash := generateSecretHash(email, appClientId, appClientSecret)

	// Create the sign-up input
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
				Value: aws.String(nickname),
			},
		},
	}

	signupStatus, err := cognitoClient.SignUp(ctx, &signupInput)

	if err != nil {
		fmt.Println("Error:", err)
	} else {
		fmt.Println("Sign-up successful:", signupStatus)
	}
}

// Email validation function using regex
func isValidEmail(email string) bool {
	re := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return re.MatchString(email)
}

// Password validation function
func isValidPassword(password string) bool {
	// Simple validation: password should be at least 8 characters
	return len(password) >= 8
}

func VerifyEmailRouteHandler(ctx *gin.Context){
	email := "keshavnischal@gmail.com"
	confirmationCode := "985588";
	
	verifyEmailWithCognito(email, confirmationCode)
}
func verifyEmailWithCognito(email string, confirmationCode string){
	ctx := context.Background()
	config, _ := config.LoadDefaultConfig(ctx, config.WithRegion("ap-south-1"))
	
	cognitoClient := cognitoidentityprovider.NewFromConfig(config)
	
	

	secretHash := generateSecretHash(email, appClientId, appClientSecret)
	confirmSignUpInput := cognitoidentityprovider.ConfirmSignUpInput{
		ClientId: aws.String(appClientId), 
		ConfirmationCode: aws.String(confirmationCode),
		Username: aws.String(email), 
		SecretHash: aws.String(secretHash),
	}
	confirmationStatus, err := cognitoClient.ConfirmSignUp(ctx, &confirmSignUpInput);

	if err != nil {
		fmt.Println("Error:", err)
	} else {
		fmt.Println("Sign-up successful:", confirmationStatus)
	}
}
func generateSecretHash(username, clientId, clientSecret string) string {
	hmacInstance := hmac.New(sha256.New, []byte(clientSecret));
	hmacInstance.Write([]byte(username+clientId));
	secretHashByte := hmacInstance.Sum(nil);
	
	secretHashString := base64.StdEncoding.EncodeToString(secretHashByte);
	return secretHashString;
}
func extractNameFromEmail(email string) string{
	re := regexp.MustCompile(`^([^@]+)`)
    
    match := re.FindStringSubmatch(email)

	return match[1];
}
func SignInRouteHandler(ctx *gin.Context){
	email := "keshavnischal@gmail.com"
	password := "abc123!"
	signInWithCognito(email, password)
}
func signInWithCognito(email string, password string){
	ctx := context.Background()
	config, _ := config.LoadDefaultConfig(ctx, config.WithRegion("ap-south-1"))
	
	cognitoClient := cognitoidentityprovider.NewFromConfig(config)
	
	secretHash := generateSecretHash(email, appClientId, appClientSecret)
	authInput := cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: types.AuthFlowTypeUserPasswordAuth,
		ClientId: aws.String(appClientId),
		AuthParameters: map[string]string{
			"USERNAME":email,
			"PASSWORD":password,
			"SECRET_HASH": secretHash,
		},
	}
	authOutput,err := cognitoClient.InitiateAuth(ctx, &authInput)

	if err != nil {
		fmt.Println("Error:", err)
	} else {
		fmt.Println("Sign-in successful:", authOutput.AuthenticationResult)
	}
}



// unimplemented routes

func SignOutRouteHandler(ctx *gin.Context) {
	// Implement sign-out logic here
	fmt.Println("Signing out...")
	// Add sign-out logic
	ctx.JSON(200, "Signed out successfully")
}

// RefreshTokenRouteHandler handles token refresh requests.
func RefreshTokenRouteHandler(ctx *gin.Context) {
	// Implement token refresh logic here
	fmt.Println("Refreshing token...")
	// Add token refresh logic
	ctx.JSON(200, "Token refreshed successfully")
}

// ForgotPasswordRouteHandler handles password reset requests.
func ForgotPasswordRouteHandler(ctx *gin.Context) {
	// Implement forgot password logic here
	fmt.Println("Handling forgot password...")
	// Add forgot password logic
	ctx.JSON(200, "Password reset email sent")
}

// ResetPasswordRouteHandler handles password reset requests.
func ResetPasswordRouteHandler(ctx *gin.Context) {
	// Implement reset password logic here
	fmt.Println("Resetting password...")
	// Add password reset logic
	ctx.JSON(200, "Password reset successfully")
}

// VerifyEmailRouteHandler handles email verification for signup.
func VerifyEmailRouteHandler(ctx *gin.Context) {
	// Implement email verification logic here
	fmt.Println("Verifying email...")
	// Add email verification logic
	ctx.JSON(200, "Email verified successfully")
}

// ProfileRouteHandler handles getting the user profile.
func ProfileRouteHandler(ctx *gin.Context) {
	// Implement profile fetching logic here
	fmt.Println("Fetching user profile...")
	// Add profile logic
	ctx.JSON(200, "User profile")
}

// UpdateProfileRouteHandler handles profile update requests.
func UpdateProfileRouteHandler(ctx *gin.Context) {
	// Implement profile update logic here
	fmt.Println("Updating profile...")
	// Add profile update logic
	ctx.JSON(200, "Profile updated successfully")
}

// DeleteAccountRouteHandler handles account deletion requests.
func DeleteAccountRouteHandler(ctx *gin.Context) {
	// Implement account deletion logic here
	fmt.Println("Deleting account...")
	// Add account deletion logic
	ctx.JSON(200, "Account deleted successfully")
}