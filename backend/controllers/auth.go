package controllers

import (
	"context"
	"errors"
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

	payload, err := idtoken.Validate(ctx, request.IDToken, cfg.GoogleOAuth.ClientID)
	if err != nil {
		ctx.JSON(401, gin.H{"error": "Invalid Google ID token", "message": err.Error()})
		return
	}

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
		// Check if displayName is already taken for new Google users
		var existingDisplayName models.User
		dnErr := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"displayName": nickname}).Decode(&existingDisplayName)
		if dnErr == nil {
			ctx.JSON(400, gin.H{"error": "Display name already taken"})
			return
		} else if !errors.Is(dnErr, mongo.ErrNoDocuments) {
			ctx.JSON(500, gin.H{"error": "Database error"})
			return
		}

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
			Score:            0,
			Badges:           []string{},
			CurrentStreak:    0,
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

	if normalizeUserStats(&existingUser) {
		if err := persistUserStats(dbCtx, &existingUser); err != nil {
		}
	}

	token, err := generateJWT(existingUser.Email, cfg.JWT.Secret, cfg.JWT.Expiry)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to generate token", "message": err.Error()})
		return
	}

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
	request.Email = strings.ToLower(strings.TrimSpace(request.Email))

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

	// Check if displayName is already taken
	defaultDisplayName := utils.ExtractNameFromEmail(request.Email)
	var existingDisplayName models.User
	err = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"displayName": defaultDisplayName}).Decode(&existingDisplayName)
	if err == nil {
		ctx.JSON(400, gin.H{"error": "Display name already taken"})
		return
	} else if !errors.Is(err, mongo.ErrNoDocuments) {
		ctx.JSON(500, gin.H{"error": "Database error"})
		return
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to hash password", "message": err.Error()})
		return
	}

	verificationCode := utils.GenerateRandomCode(6)

	now := time.Now()
	newUser := models.User{
		Email:                  request.Email,
		DisplayName:            defaultDisplayName,
		Nickname:               defaultDisplayName,
		Bio:                    "",
		Rating:                 1200.0,
		RD:                     350.0,
		Volatility:             0.06,
		LastRatingUpdate:       now,
		AvatarURL:              "https://api.dicebear.com/9.x/big-ears/svg?seed=Jude",
		Password:               string(hashedPassword),
		IsVerified:             false,
		VerificationCode:       verificationCode,
		VerificationCodeExpiry: now.Add(24 * time.Hour),
		VerificationCodeSentAt: now,
		Score:                  0,
		Badges:                 []string{},
		CurrentStreak:          0,
		CreatedAt:              now,
		UpdatedAt:              now,
	}

	result, err := db.MongoDatabase.Collection("users").InsertOne(dbCtx, newUser)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			ctx.JSON(400, gin.H{"error": "Display name already taken"})
			return
		}
		ctx.JSON(500, gin.H{"error": "Failed to create user", "message": err.Error()})
		return
	}
	newUser.ID = result.InsertedID.(primitive.ObjectID)

	err = utils.SendVerificationEmail(request.Email, verificationCode)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to send verification email", "message": err.Error()})
		return
	}

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
	request.Email = strings.ToLower(strings.TrimSpace(request.Email))

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

	expiry := user.VerificationCodeExpiry
	if expiry.IsZero() {
		// Legacy accounts created before this fix have no VerificationCodeExpiry
		// persisted — fall back to the original 24h-from-signup rule so their
		// still-valid codes aren't wrongly rejected.
		expiry = user.CreatedAt.Add(24 * time.Hour)
	}
	if time.Now().After(expiry) {
		ctx.JSON(400, gin.H{"error": "Verification code expired. Please request a new one."})
		return
	}

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"isVerified":             true,
			"verificationCode":       "",
			"verificationCodeExpiry": time.Time{},
			"verificationCodeSentAt": time.Time{},
			"updatedAt":              now,
		},
	}
	_, err = db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"email": request.Email}, update)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to verify email", "message": err.Error()})
		return
	}

	user.IsVerified = true
	user.VerificationCode = ""
	user.UpdatedAt = now

	token, err := generateJWT(user.Email, cfg.JWT.Secret, cfg.JWT.Expiry)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to generate token", "message": err.Error()})
		return
	}

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
	request.Email = strings.ToLower(strings.TrimSpace(request.Email))

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": request.Email}).Decode(&user)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if normalizeUserStats(&user) {
		if err := persistUserStats(dbCtx, &user); err != nil {
		}
	}

	if !user.IsVerified {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Email not verified", "code": "EMAIL_NOT_VERIFIED"})
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(request.Password))
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	token, err := generateJWT(user.Email, cfg.JWT.Secret, cfg.JWT.Expiry)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token", "message": err.Error()})
		return
	}

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
		"github":           user.GitHub,
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
	request.Email = strings.ToLower(strings.TrimSpace(request.Email))

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": request.Email}).Decode(&user)
	if err != nil {
		ctx.JSON(400, gin.H{"error": "User not found"})
		return
	}

	resetCode := utils.GenerateRandomCode(6)

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"resetPasswordCode":       hashResetCode(resetCode, cfg.JWT.Secret),
			"resetPasswordCodeExpiry": now.Add(15 * time.Minute),
			"updatedAt":               now,
		},
	}
	_, err = db.MongoDatabase.Collection("users").UpdateOne(dbCtx, bson.M{"email": request.Email}, update)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to initiate password reset", "message": err.Error()})
		return
	}

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
	request.Email = strings.ToLower(strings.TrimSpace(request.Email))

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var user models.User
	hashedCode := hashResetCode(request.Code, cfg.JWT.Secret)
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": request.Email, "resetPasswordCode": hashedCode}).Decode(&user)
	if err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid email or reset code"})
		return
	}

	if user.ResetPasswordCodeExpiry.IsZero() || time.Now().After(user.ResetPasswordCodeExpiry) {
		ctx.JSON(400, gin.H{"error": "Reset code has expired. Please request a new one."})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(request.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to hash password", "message": err.Error()})
		return
	}

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"password":                string(hashedPassword),
			"resetPasswordCode":       "",
			"resetPasswordCodeExpiry": time.Time{},
			"updatedAt":               now,
		},
	}
	result, err := db.MongoDatabase.Collection("users").UpdateOne(
		dbCtx,
		bson.M{
			"email":                   request.Email,
			"resetPasswordCode":       hashedCode,
			"resetPasswordCodeExpiry": bson.M{"$gt": now},
		},
		update,
	)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Failed to reset password", "message": err.Error()})
		return
	}
	if result.MatchedCount == 0 {
		ctx.JSON(400, gin.H{"error": "Reset code is invalid or has expired. Please request a new one."})
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

	claims, err := validateJWT(tokenString, cfg.JWT.Secret)
	if err != nil {
		ctx.JSON(401, gin.H{"error": "Invalid or expired token", "message": err.Error()})
		return
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var user models.User
	err = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": claims["sub"].(string)}).Decode(&user)
	if err != nil {
		ctx.JSON(401, gin.H{"error": "User not found"})
		return
	}

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
			"github":           user.GitHub,
			"isVerified":       user.IsVerified,
			"createdAt":        user.CreatedAt.Format(time.RFC3339),
			"updatedAt":        user.UpdatedAt.Format(time.RFC3339),
		},
	})
}

func generateJWT(email, secret string, expiryMinutes int) (string, error) {
	now := time.Now()
	expirationTime := now.Add(time.Minute * time.Duration(expiryMinutes))

	log.Printf("JWT Generation - Email: %s, Now: %s, Expiry: %s (in %d minutes)", email, now.Format(time.RFC3339), expirationTime.Format(time.RFC3339), expiryMinutes)

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
		ctx.JSON(500, gin.H{"error": "Internal server error"})
		return nil
	}
	return cfg
}

func GetMatchmakingPoolStatus(ctx *gin.Context) {
	matchmakingService := services.GetMatchmakingService()
	pool := matchmakingService.GetPool()

	ctx.JSON(200, gin.H{
		"pool":      pool,
		"poolSize":  len(pool),
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func ResendVerification(ctx *gin.Context) {
	var request structs.ResendVerificationRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(400, gin.H{"error": "Invalid input", "message": err.Error()})
		return
	}
	request.Email = strings.ToLower(strings.TrimSpace(request.Email))

	const genericMessage = "If an account exists for this email and is not yet verified, a new verification code has been sent."

	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user models.User
	err := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": request.Email}).Decode(&user)
	if err != nil {
		// Don't reveal whether the account exists.
		ctx.JSON(200, gin.H{"message": genericMessage})
		return
	}

	if user.IsVerified {
		// Don't reveal that the account is already verified.
		ctx.JSON(200, gin.H{"message": genericMessage})
		return
	}

	const resendCooldown = 2 * time.Minute
	now := time.Now()
	cooldownThreshold := now.Add(-resendCooldown)

	claimFilter := bson.M{
		"email": request.Email,
		"$or": []bson.M{
			{"verificationCodeSentAt": bson.M{"$exists": false}},
			{"verificationCodeSentAt": time.Time{}},
			{"verificationCodeSentAt": bson.M{"$lte": cooldownThreshold}},
		},
	}
	claimUpdate := bson.M{"$set": bson.M{"verificationCodeSentAt": now, "updatedAt": now}}

	var prevUser models.User
	claimResult := db.MongoDatabase.Collection("users").FindOneAndUpdate(dbCtx, claimFilter, claimUpdate)
	if err := claimResult.Decode(&prevUser); err != nil {
		if err == mongo.ErrNoDocuments {
			var current models.User
			wait := resendCooldown
			if ferr := db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": request.Email}).Decode(&current); ferr == nil && !current.VerificationCodeSentAt.IsZero() {
				remaining := resendCooldown - time.Since(current.VerificationCodeSentAt)
				if remaining > 0 {
					wait = remaining
				}
			}
			ctx.JSON(429, gin.H{
				"error":             "Please wait before requesting another code",
				"retryAfterSeconds": int(wait.Seconds()),
			})
			return
		}
		ctx.JSON(500, gin.H{"error": "Failed to resend code", "message": err.Error()})
		return
	}

	// Slot claimed successfully — generate and send the new code.
	newCode := utils.GenerateRandomCode(6)
	err = utils.SendVerificationEmail(request.Email, newCode)

	// SMTP delivery can be slow. dbCtx's 5s budget may already be spent by
	// the time we get here, so use a fresh context for the DB writes below
	// rather than risk them silently failing on an expired context.
	postCtx, postCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer postCancel()

	if err != nil {
		// Delivery failed — revert the claimed timestamp so the user isn't
		// wrongly stuck in cooldown for a code they never received. Only
		// revert if verificationCodeSentAt still equals the value THIS
		// request set, so we don't clobber a legitimate newer claim.
		revertFilter := bson.M{"email": request.Email, "verificationCodeSentAt": now}
		revertUpdate := bson.M{"$set": bson.M{"verificationCodeSentAt": prevUser.VerificationCodeSentAt}}
		db.MongoDatabase.Collection("users").UpdateOne(postCtx, revertFilter, revertUpdate)

		ctx.JSON(500, gin.H{"error": "Failed to send verification email", "message": err.Error()})
		return
	}

	// Guard the write with the same claim timestamp: if this request was
	// abnormally slow and a newer resend already superseded it, this
	// update matches nothing instead of overwriting the newer code with
	// this stale one.
	codeUpdate := bson.M{
		"$set": bson.M{
			"verificationCode":       newCode,
			"verificationCodeExpiry": now.Add(24 * time.Hour),
			"updatedAt":              time.Now(),
		},
	}
	result, err := db.MongoDatabase.Collection("users").UpdateOne(
		postCtx,
		bson.M{"email": request.Email, "verificationCodeSentAt": now},
		codeUpdate,
	)
	if err != nil {
		ctx.JSON(500, gin.H{"error": "Code sent but failed to persist, please try again", "message": err.Error()})
		return
	}
	if result.MatchedCount == 0 {
		// Superseded by a newer resend — the code we just emailed was
		// never persisted, so silently drop it rather than stomp on the
		// newer, currently-valid one.
		ctx.JSON(200, gin.H{"message": genericMessage})
		return
	}

	ctx.JSON(200, gin.H{"message": genericMessage})
}
