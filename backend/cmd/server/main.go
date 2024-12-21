package main

import (
	// "context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"regexp"
	"log"
    "os"
	"github.com/gin-gonic/gin"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsConfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
    "github.com/gin-contrib/cors"
	appConfig "arguehub/config"
    "path/filepath"
)

func SignUpRouteHandler(ctx *gin.Context) {
    rootPath := os.Getenv("APP_ROOT_PATH")
	if rootPath == "" {
		log.Println("APP_ROOT_PATH environment variable is not set")
		return
	}

	configPath := filepath.Join(rootPath, "config", "config.prod.yml")
	cfg, err := appConfig.LoadConfig(configPath)
	if err != nil {
		log.Printf("Failed to load config: %v", err)
		ctx.JSON(500, gin.H{"error": "Failed to load config"})
		return
	}

    fmt.Println("signing up")

    var request struct {
        Email    string `json:"email" binding:"required,email"`
        Password string `json:"password" binding:"required,min=8"`
    }

    if err := ctx.ShouldBindJSON(&request); err != nil {
        ctx.JSON(400, gin.H{"error": "Invalid input", "message": err.Error()})
        return
    }

	fmt.Println(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret);
    err = signUpWithCognito(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, request.Password, ctx)
    if err != nil {
        ctx.JSON(500, gin.H{"error": "Failed to sign up", "message": err.Error()})
        return
    }

    ctx.JSON(200, gin.H{"message": "Sign-up successful"})
}
func signUpWithCognito(appClientId, appClientSecret, email, password string, ctx *gin.Context) error {
    config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion("ap-south-1"))
    if err != nil {
        log.Println("Error loading AWS config:", err)
        return fmt.Errorf("failed to load AWS config: %v", err)
    }

    cognitoClient := cognitoidentityprovider.NewFromConfig(config)

    secretHash := generateSecretHash(email, appClientId, appClientSecret)

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
                Value: aws.String(extractNameFromEmail(email)),
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

func VerifyEmailRouteHandler(ctx *gin.Context) {
    rootPath := os.Getenv("APP_ROOT_PATH")
	if rootPath == "" {
		log.Println("APP_ROOT_PATH environment variable is not set")
		return
	}

	configPath := filepath.Join(rootPath, "config", "config.prod.yml")
	cfg, err := appConfig.LoadConfig(configPath)
	if err != nil {
		log.Printf("Failed to load config: %v", err)
		ctx.JSON(500, gin.H{"error": "Failed to load config"})
		return
	}

    var request struct {
        Email           string `json:"email" binding:"required,email"`
        ConfirmationCode string `json:"confirmationCode" binding:"required"`
    }

    if err := ctx.ShouldBindJSON(&request); err != nil {
        ctx.JSON(400, gin.H{"error": "Invalid input", "message": err.Error()})
        return
    }

    err = verifyEmailWithCognito(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, request.ConfirmationCode, ctx)
    if err != nil {
        ctx.JSON(500, gin.H{"error": "Failed to verify email", "message": err.Error()})
        return
    }

    ctx.JSON(200, gin.H{"message": "Email verification successful"})
}

func verifyEmailWithCognito(appClientId, appClientSecret, email, confirmationCode string, ctx *gin.Context) error {
    config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion("ap-south-1"))
    if err != nil {
        log.Println("Error loading AWS config:", err)
        return fmt.Errorf("failed to load AWS config: %v", err)
    }

    cognitoClient := cognitoidentityprovider.NewFromConfig(config)

    secretHash := generateSecretHash(email, appClientId, appClientSecret)

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

func LoginRouteHandler(ctx *gin.Context) {
    cfgPath := os.Getenv("CONFIG_PATH")
    if cfgPath == "" {
        cfgPath = "./config/config.prod.yml"
    }
    cfg, err := appConfig.LoadConfig(cfgPath)
    if err != nil {
        log.Println("Failed to load config")
        ctx.JSON(500, gin.H{"error": "Internal server error"})
        return
    }

    var request struct {
        Email    string `json:"email" binding:"required,email"`
        Password string `json:"password" binding:"required,min=8"`
    }

    if err := ctx.ShouldBindJSON(&request); err != nil {
        ctx.JSON(400, gin.H{"error": "Invalid input", "message": "Check email and password format"})
        return
    }

    token, err := loginWithCognito(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, request.Password, ctx);
    if err != nil {
        ctx.JSON(401, gin.H{"error": "Failed to sign in", "message": "Invalid email or password"})
        return
    }

    ctx.JSON(200, gin.H{"message": "Sign-in successful", "accessToken": token})
}

func loginWithCognito(appClientId, appClientSecret, email, password string, ctx *gin.Context) (string, error) {
    config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion("ap-south-1"))
    if err != nil {
        return "", fmt.Errorf("failed to load AWS config")
    }

    cognitoClient := cognitoidentityprovider.NewFromConfig(config)
    secretHash := generateSecretHash(email, appClientId, appClientSecret)

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

func ForgotPasswordRouteHandler(ctx *gin.Context) {
    cfgPath := os.Getenv("CONFIG_PATH")
    if cfgPath == "" {
        cfgPath = "./config/config.prod.yml"
    }
    cfg, err := appConfig.LoadConfig(cfgPath)
    if err != nil {
        log.Println("Failed to load config")
        ctx.JSON(500, gin.H{"error": "Internal server error"})
        return
    }

    var request struct {
        Email string `json:"email" binding:"required,email"`
    }

    if err := ctx.ShouldBindJSON(&request); err != nil {
        ctx.JSON(400, gin.H{"error": "Invalid input", "message": "Check email format"})
        return
    }

    _, err = initiateForgotPassword(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, ctx)
    if err != nil {
        ctx.JSON(500, gin.H{"error": "Failed to initiate password reset", "message": err.Error()})
        return
    }

    ctx.JSON(200, gin.H{"message": "Password reset initiated. Check your email for further instructions."})
}

func initiateForgotPassword(appClientId, appClientSecret, email string, ctx *gin.Context) (*cognitoidentityprovider.ForgotPasswordOutput, error) {
    config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion("ap-south-1"))
    if err != nil {
        return nil, fmt.Errorf("failed to load AWS config")
    }

    cognitoClient := cognitoidentityprovider.NewFromConfig(config)
    secretHash := generateSecretHash(email, appClientId, appClientSecret)

    forgotPasswordInput := cognitoidentityprovider.ForgotPasswordInput{
        ClientId:    aws.String(appClientId),
        Username:    aws.String(email),
        SecretHash:  aws.String(secretHash),
    }

    output, err := cognitoClient.ForgotPassword(ctx, &forgotPasswordInput)
    if err != nil {
        return nil, fmt.Errorf("error initiating forgot password: %v", err)
    }

    return output, nil
}


func VerifyForgotPasswordRouteHandler(ctx *gin.Context) {
    cfgPath := os.Getenv("CONFIG_PATH")
    if cfgPath == "" {
        cfgPath = "./config/config.prod.yml"
    }
    cfg, err := appConfig.LoadConfig(cfgPath)
    if err != nil {
        log.Println("Failed to load config")
        ctx.JSON(500, gin.H{"error": "Internal server error"})
        return
    }

    var request struct {
        Email       string `json:"email" binding:"required,email"`
        Code        string `json:"code" binding:"required"`
        NewPassword string `json:"newPassword" binding:"required,min=8"`
    }

    if err := ctx.ShouldBindJSON(&request); err != nil {
        ctx.JSON(400, gin.H{"error": "Invalid input", "message": err.Error()})
        return
    }

    _, err = confirmForgotPassword(cfg.Cognito.AppClientId, cfg.Cognito.AppClientSecret, request.Email, request.Code, request.NewPassword, ctx)
    if err != nil {
        ctx.JSON(500, gin.H{"error": "Failed to confirm password reset", "message": err.Error()})
        return
    }

    ctx.JSON(200, gin.H{"message": "Password successfully changed"})
}

func confirmForgotPassword(appClientId, appClientSecret, email, code, newPassword string, ctx *gin.Context) (*cognitoidentityprovider.ConfirmForgotPasswordOutput, error) {
    config, err := awsConfig.LoadDefaultConfig(ctx, awsConfig.WithRegion("ap-south-1"))
    if err != nil {
        return nil, fmt.Errorf("failed to load AWS config")
    }

    cognitoClient := cognitoidentityprovider.NewFromConfig(config)
    secretHash := generateSecretHash(email, appClientId, appClientSecret)

    confirmForgotPasswordInput := cognitoidentityprovider.ConfirmForgotPasswordInput{
        ClientId:    aws.String(appClientId),
        Username:    aws.String(email),
        ConfirmationCode: aws.String(code),
        Password:    aws.String(newPassword),
        SecretHash:  aws.String(secretHash),
    }

    output, err := cognitoClient.ConfirmForgotPassword(ctx, &confirmForgotPasswordInput)
    if err != nil {
        return nil, fmt.Errorf("error confirming forgot password: %v", err)
    }

    return output, nil
}

func server() {
    router := gin.Default()
    router.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"https://upgraded-meme-499jj7wxv9pf5g5g-5173.app.github.dev"},
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
        ExposeHeaders:    []string{"Content-Length"},
        AllowCredentials: true,
    }))
    router.OPTIONS("/*path", func(c *gin.Context) {
        c.Status(204)
    })
    router.POST("/signup", SignUpRouteHandler)
    router.POST("/verifyEmail", VerifyEmailRouteHandler)
    router.POST("/login", LoginRouteHandler)
    router.POST("/forgotPassword", ForgotPasswordRouteHandler)
    router.POST("/confirmForgotPassword", VerifyForgotPasswordRouteHandler)

    router.Run(":8000")
}

func main(){
	server();
}

