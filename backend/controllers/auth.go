package controllers

import (
	"context"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"arguehub/config"
	"arguehub/db"
	"arguehub/models"
	"arguehub/services"
	"arguehub/structs"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/api/idtoken"
)

type GoogleLoginRequest struct {
	IDToken string `json:"idToken" binding:"required"`
}

func GoogleLogin(ctx *gin.Context) {
	cfg := loadConfig(ctx)
	if cfg == nil {
		return
	}

	var request GoogleLoginRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}

	// Verify Google ID token
	payload, err := idtoken.Validate(ctx, request.IDToken, cfg.GoogleOAuth.ClientID)
	if err != nil {
		ctx.JSON(401, gin.H{"error": "Invalid Google ID token", "message": err.Error()})
		return
	}

	// Extract email and name from Google token
	email, ok := payload.Claims["email"].(string)
	if !ok || email == "" {
		ctx.JSON(400, gin.H{"error": "Email not found in Google token"})
		return
	}
	nickname, _ := payload.Claims["name"].(string)
	if nickname == "" {
		nickname = utils.ExtractNameFromEmail(email)
	}
	avatarURL, _ := payload.Claims["picture"].(string)

	// Check if user exists in MongoDB
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var existingUser models.User
	err = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": email}).Decode(&existingUser)
	if err != nil && err != mongo.ErrNoDocuments {
		ctx.JSON(500, gin.H{"error": "Database error", "message": err.Error()})
		return
	}

	now := time.Now()
	if err == mongo.ErrNoDocuments {
		// Create new user
		newUser := models.User{
			Email:            email,
			DisplayName:      nickname,
			Nickname:         nickname,
			Bio:              "",
			Rating:           1200.0,
			RD:               350.0,
			Volatility:       0.06,
			LastRatingUpdate: now,
			AvatarURL:        avatarURL,
			IsVerified:       true,
			Score:            0,          // Initialize gamification score
			Badges:           []string{}, // Initialize badges array
			CurrentStreak:    0,          // Initialize streak
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		result, err := db.MongoDatabase.Collection("users").InsertOne(dbCtx, newUser)
		if err != nil {
			ctx.JSON(500, gin.H{"error": "Failed to create user", "message": err.Error()})
			return
		}
		newUser.ID = result.InsertedID.(primitive.ObjectID)
		existingUser = newUser
	}

	// Normalize stats if needed to prevent NaN values
	if normalizeUserStats(&existingUser) {
		if err := persistUserStats(dbCtx, &existingUser); err != nil {
			log.Printf("Error persisting user stats for %s: %v", RedactEmail(email), err)
		}
	}

	// Generate JWT
	token, err := generateJWT(existingUser.Email, cfg.JWT.Secret, cfg.JWT.Expiry)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to generate token", "message": err.Error()})
		return
	}

	// Return user details (excluding sensitive fields)
	ctx.JSON(http.StatusOK, gin.H{
		"message":     "Google login successful",
		"accessToken": token,
		"user":        buildUserResponse(existingUser),
	})
}

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

	// Create new user (unverified)
	now := time.Now()
	newUser := models.User{
		Email:            request.Email,
		DisplayName:      utils.ExtractNameFromEmail(request.Email),
		Nickname:         utils.ExtractNameFromEmail(request.Email),
		Bio:              "",
		Rating:           1200.0,
		RD:               350.0,
		Volatility:       0.06,
		LastRatingUpdate: now,
		AvatarURL:        "https://avatar.iran.liara.run/public/10",
		Password:         string(hashedPassword),
		IsVerified:       false,
		VerificationCode: verificationCode,
		Score:            0,
		Badges:           []string{},
		CurrentStreak:    0,
		CreatedAt:        now,
		UpdatedAt:        now,
		// MFA Initialization Hook
		MFAEnabled: false,
		MFAType:    "totp", // Default type
	}

	// Insert user into MongoDB
	result, err := db.MongoDatabase.Collection("users").InsertOne(dbCtx, newUser)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to create user", "message": err.Error()})
		return
	}
	newUser.ID = result.InsertedID.(primitive.ObjectID)

	// Send verification email
	err = utils.SendVerificationEmail(request.Email, verificationCode)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to send verification email", "message": err.Error()})
		return
	}

	// Return success response
	ctx.JSON(200, gin.H{
		"message": "Sign-up successful. Please verify your email.",
	})
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

	// Find user with matching email and verification code
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{
		"email":            request.Email,
		"verificationCode": request.ConfirmationCode,
	}).Decode(&user)
	if err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid email or verification code"})
		return
	}

	// Check if verification code is expired (24 hours)
	if time.Since(user.CreatedAt) > 24*time.Hour {
		ctx.JSON(400, gin.H{"error": "Verification code expired. Please sign up again."})
		return
	}

	// Update user verification status
	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"isVerified":       true,
			"verificationCode": "",
			"updatedAt":        now,
		},
	}
	_, err = db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"email": request.Email}, update)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to verify email", "message": err.Error()})
		return
	}

	// Update local user object
	user.IsVerified = true
	user.VerificationCode = ""
	user.UpdatedAt = now

	// Generate JWT for immediate login
	token, err := generateJWT(user.Email, cfg.JWT.Secret, cfg.JWT.Expiry)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to generate token", "message": err.Error()})
		return
	}

	// Return user details and access token
	ctx.JSON(200, gin.H{
		"message":     "Email verification successful. You are now logged in.",
		"accessToken": token,
		"user":        buildUserResponse(user),
	})
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

	// Normalize stats if needed
	if normalizeUserStats(&user) {
		if err := persistUserStats(dbCtx, &user); err != nil {
			log.Printf("Error persisting user stats on login for %s: %v", RedactEmail(user.Email), err)
		}
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

	// MFA Hook: Check if MFA is enabled for the user
	if user.MFAEnabled {
		// Log MFA requirement for security audits
		log.Printf("MFA required for user: %s", RedactEmail(user.Email))

		// Generate a short-lived pending MFA token
		// This token persists the authenticated email but doesn't grant full access yet.
		pendingToken, err := generateJWT(user.Email, cfg.JWT.Secret, 5) // 5 minutes expiry
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initiate MFA"})
			return
		}

		// Return 202 Accepted to signal that MFA is required to completion
		ctx.JSON(http.StatusAccepted, gin.H{
			"message":      "MFA required",
			"mfaType":      user.MFAType,
			"pendingToken": pendingToken,
		})
		return
	}

	// Generate JWT
	token, err := generateJWT(user.Email, cfg.JWT.Secret, cfg.JWT.Expiry)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token", "message": err.Error()})
		return
	}

	// Return user details
	ctx.JSON(http.StatusOK, gin.H{
		"message":     "Sign-in successful",
		"accessToken": token,
		"user":        buildUserResponse(user),
	})
}

func normalizeUserStats(user *models.User) bool {
	updated := false
	if math.IsNaN(user.Rating) || math.IsInf(user.Rating, 0) {
		user.Rating = 1200.0
		updated = true
	}
	if math.IsNaN(user.RD) || math.IsInf(user.RD, 0) {
		user.RD = 350.0
		updated = true
	}
	if math.IsNaN(user.Volatility) || math.IsInf(user.Volatility, 0) || user.Volatility <= 0 {
		user.Volatility = 0.06
		updated = true
	}
	if user.LastRatingUpdate.IsZero() {
		user.LastRatingUpdate = time.Now()
		updated = true
	}
	if updated {
		user.UpdatedAt = time.Now()
	}
	return updated
}

func persistUserStats(ctx context.Context, user *models.User) error {
	if user.ID.IsZero() {
		return nil
	}
	collection := db.MongoDatabase.Collection("users")
	update := bson.M{
		"$set": bson.M{
			"rating":           user.Rating,
			"rd":               user.RD,
			"volatility":       user.Volatility,
			"lastRatingUpdate": user.LastRatingUpdate,
			"updatedAt":        user.UpdatedAt,
		},
	}
	_, err := collection.UpdateByID(ctx, user.ID, update)
	return err
}

func sanitizeFloat(value, fallback float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return fallback
	}
	return value
}

func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(time.RFC3339)
}

func buildUserResponse(user models.User) gin.H {
	return gin.H{
		"id":               user.ID.Hex(),
		"email":            user.Email,
		"displayName":      user.DisplayName,
		"nickname":         user.Nickname,
		"bio":              user.Bio,
		"rating":           sanitizeFloat(user.Rating, 1200.0),
		"rd":               sanitizeFloat(user.RD, 350.0),
		"volatility":       sanitizeFloat(user.Volatility, 0.06),
		"lastRatingUpdate": formatTime(user.LastRatingUpdate),
		"avatarUrl":        user.AvatarURL,
		"twitter":          user.Twitter,
		"instagram":        user.Instagram,
		"linkedin":         user.LinkedIn,
		"isVerified":       user.IsVerified,
		"createdAt":        formatTime(user.CreatedAt),
		"updatedAt":        formatTime(user.UpdatedAt),
	}
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
	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"resetPasswordCode": resetCode,
			"updatedAt":         now,
		},
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
	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"password":          string(hashedPassword),
			"resetPasswordCode": "",
			"updatedAt":         now,
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

	// Return user details
	ctx.JSON(200, gin.H{
		"message": "Token is valid",
		"user": gin.H{
			"id":               user.ID.Hex(),
			"email":            user.Email,
			"displayName":      user.DisplayName,
			"nickname":         user.Nickname,
			"bio":              user.Bio,
			"rating":           user.Rating,
			"rd":               user.RD,
			"volatility":       user.Volatility,
			"lastRatingUpdate": user.LastRatingUpdate.Format(time.RFC3339),
			"avatarUrl":        user.AvatarURL,
			"twitter":          user.Twitter,
			"instagram":        user.Instagram,
			"linkedin":         user.LinkedIn,
			"isVerified":       user.IsVerified,
			"createdAt":        user.CreatedAt.Format(time.RFC3339),
			"updatedAt":        user.UpdatedAt.Format(time.RFC3339),
		},
	})
}

// Helper function to generate JWT
func generateJWT(email, secret string, expiryMinutes int) (string, error) {
	now := time.Now()
	expirationTime := now.Add(time.Minute * time.Duration(expiryMinutes))

	log.Printf("JWT Generation - Email: %s, Now: %s, Expiry: %s (in %d minutes)", RedactEmail(email), now.Format(time.RFC3339), expirationTime.Format(time.RFC3339), expiryMinutes)

	claims := jwt.MapClaims{
		"sub": email,
		"exp": expirationTime.Unix(),
		"iat": now.Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString([]byte(secret))
	if err != nil {
		log.Printf("JWT signing error: %v", err)
		return "", err
	}

	log.Printf("JWT Generated successfully - Expiration Unix: %d", expirationTime.Unix())
	return signedToken, nil
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

func VerifyTOTP(ctx *gin.Context) {
	var request struct {
		PendingToken string `json:"pendingToken" binding:"required"`
		Code         string `json:"code" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	cfg := loadConfig(ctx)
	if cfg == nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Validate the pending token to ensure this MFA check follows a successful password check
	claims, err := utils.ParseJWTToken(request.PendingToken)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired MFA session"})
		return
	}

	email := claims.Email
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user models.User
	err = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if !user.MFAEnabled {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "MFA not enabled for this user"})
		return
	}

	valid, err := user.VerifyTOTP(request.Code)
	if err != nil || !valid {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid MFA code"})
		return
	}

	// Issue full access token
	token, err := generateJWT(user.Email, cfg.JWT.Secret, cfg.JWT.Expiry)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":     "MFA verification successful",
		"accessToken": token,
		"user":        buildUserResponse(user),
	})
}

func EnableMFA(ctx *gin.Context) {
	email := ctx.GetString("email")
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	secret, qrUrl, err := user.GenerateMFASecret()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate MFA secret"})
		return
	}

	if err := user.SetEncryptedMFASecret(secret); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store MFA secret"})
		return
	}

	// Update user in DB with secret (but not enabled yet)
	_, err = db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"email": email}, bson.M{"$set": bson.M{"mfaSecret": user.MFASecret}})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"secret":    secret,
		"qrCodeUrl": qrUrl,
		"message":   "MFA secret generated. Please verify to enable MFA.",
	})
}

func FinalizeEnableMFA(ctx *gin.Context) {
	var request struct {
		Code string `json:"code" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	email := ctx.GetString("email")
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	valid, err := user.VerifyTOTP(request.Code)
	if err != nil || !valid {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid MFA code"})
		return
	}

	// Enable MFA
	_, err = db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"email": email}, bson.M{"$set": bson.M{"mfaEnabled": true, "mfaType": "totp"}})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enable MFA"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "MFA enabled successfully"})
}

func RedactEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return "****"
	}
	name := parts[0]
	if len(name) <= 2 {
		return "*@" + parts[1]
	}
	return name[:2] + "****@" + parts[1]
}

func loadConfig(ctx *gin.Context) *config.Config {
	cfgPath := os.Getenv("CONFIG_PATH")
	if cfgPath == "" {
		cfgPath = "./config/config.prod.yml"
	}
	cfg, err := config.LoadConfig(cfgPath)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Internal server error"})
		return nil
	}
	return cfg
}

// GetMatchmakingPoolStatus returns the current matchmaking pool status (debug endpoint)
func GetMatchmakingPoolStatus(ctx *gin.Context) {
	matchmakingService := services.GetMatchmakingService()
	pool := matchmakingService.GetPool()

	ctx.JSON(200, gin.H{
		"pool":      pool,
		"poolSize":  len(pool),
		"timestamp": time.Now().Format(time.RFC3339),
	})
}
