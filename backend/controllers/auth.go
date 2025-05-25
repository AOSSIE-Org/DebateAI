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

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

func SignUp(ctx *gin.Context) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return
	}

	var request structs.SignUpRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		log.Printf("Binding error: %v", err)
		ctx.JSON(400, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}

	// Check if user already exists
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var existingUser models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": request.Email}).Decode(&existingUser)
	if err == nil {
		ctx.JSON(400, gin.H{"error": "User already exists"})
		return
	}
	if err != mongo.ErrNoDocuments {
		ctx.JSON(500, gin.H{"error": "Database error", "message": err.Error()})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to hash password", "message": err.Error()})
		return
	}

	// Generate verification code
	verificationCode := utils.GenerateRandomCode(6)

	// Create new user
	newUser := models.User{
		Email:            request.Email,
		Password:         string(hashedPassword),
		Nickname:         utils.ExtractNameFromEmail(request.Email),
		EloRating:        1200,
		IsVerified:       false,
		VerificationCode: verificationCode,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	// Insert user into MongoDB
	_, err = db.MongoDatabase.Collection("users").InsertOne(dbCtx, newUser)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to create user", "message": err.Error()})
		return
	}

	// Send verification email (implement email sending logic)
	err = utils.SendVerificationEmail(request.Email, verificationCode)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to send verification email", "message": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{"message": "Sign-up successful. Please verify your email."})
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

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": request.Email, "verificationCode": request.ConfirmationCode}).Decode(&user)
	if err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid email or verification code"})
		return
	}

	// Update user verification status
	update := bson.M{
		"$set": bson.M{"isVerified": true, "verificationCode": "", "updatedAt": time.Now()},
	}
	_, err = db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"email": request.Email}, update)
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input", "message": "Check email and password format"})
		return
	}

	// Find user in MongoDB
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": request.Email}).Decode(&user)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Check if user is verified
	if !user.IsVerified {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Email not verified"})
		return
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(request.Password))
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Generate JWT
	token, err := generateJWT(user.Email, cfg.JWT.Secret, cfg.JWT.Expiry)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token", "message": err.Error()})
		return
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

	// Find user
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": request.Email}).Decode(&user)
	if err != nil {
		ctx.JSON(400, gin.H{"error": "User not found"})
		return
	}

	// Generate reset code
	resetCode := utils.GenerateRandomCode(6)

	// Update user with reset code
	update := bson.M{
		"$set": bson.M{"resetPasswordCode": resetCode, "updatedAt": time.Now()},
	}
	_, err = db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"email": request.Email}, update)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to initiate password reset", "message": err.Error()})
		return
	}

	// Send reset email
	err = utils.SendPasswordResetEmail(request.Email, resetCode)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to send reset email", "message": err.Error()})
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

	// Find user with reset code
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": request.Email, "resetPasswordCode": request.Code}).Decode(&user)
	if err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid email or reset code"})
		return
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(request.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to hash password", "message": err.Error()})
		return
	}

	// Update user with new password
	update := bson.M{
		"$set": bson.M{
			"password":          string(hashedPassword),
			"resetPasswordCode": "",
			"updatedAt":         time.Now(),
		},
	}
	_, err = db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"email": request.Email}, update)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to reset password", "message": err.Error()})
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
	tokenString := tokenParts[1]

	// Validate JWT
	claims, err := validateJWT(tokenString, cfg.JWT.Secret)
	if err != nil {
		ctx.JSON(401, gin.H{"error": "Invalid or expired token", "message": err.Error()})
		return
	}

	// Verify user exists in MongoDB
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var user models.User
	err = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": claims["sub"].(string)}).Decode(&user)
	if err != nil {
		ctx.JSON(401, gin.H{"error": "User not found"})
		return
	}

	ctx.JSON(200, gin.H{"message": "Token is valid"})
}

// Helper function to generate JWT
func generateJWT(email, secret string, expiryMinutes int) (string, error) {
	claims := jwt.MapClaims{
		"sub": email,
		"exp": time.Now().Add(time.Minute * time.Duration(expiryMinutes)).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// Helper function to validate JWT
func validateJWT(tokenString, secret string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}
	return nil, fmt.Errorf("invalid token")
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
