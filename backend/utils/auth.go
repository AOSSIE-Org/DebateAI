package utils

import (
	"crypto/hmac"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
	"time"

	"crypto/sha256"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrTokenExpired = errors.New("token has expired")
)

var jwtSecret string

func SetJWTSecret(secret string) {
	jwtSecret = secret
}

func getJWTSecret() string {
	if jwtSecret == "" {
		panic("JWT secret is not set in config")
	}
	return jwtSecret
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

// Password Hashing Functions
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password")
	}
	return string(bytes), nil
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// JWT Functions
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Sub    string `json:"sub"`
	jwt.RegisteredClaims
}

func GenerateJWTToken(userID, email string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)

	claims := &Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	jwtSecret := []byte(getJWTSecret())

	signedToken, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", fmt.Errorf("failed to generate token")
	}

	return signedToken, nil
}

func ParseJWTToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	jwtSecret := []byte(getJWTSecret())

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jwtSecret, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrInvalidToken
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// Token Generation
func GenerateRandomToken(length int) (string, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random token")
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func ValidateTokenAndFetchEmail(configPath, token string, c *gin.Context) (bool, string, error) {
	claims, err := ParseJWTToken(token)
	if err != nil {
		return false, "", err
	}

	// Try to get email from different possible fields
	email := claims.Email
	if email == "" {
		email = claims.Sub
	}

	return true, email, nil
}

func GetUserIDFromToken(token string) (string, error) {
	claims, err := ParseJWTToken(token)
	if err != nil {
		return "", err
	}

	return claims.UserID, nil
}

func GenerateSecretHash(username, clientID, clientSecret string) string {
	key := []byte(clientSecret)
	message := username + clientID

	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(message))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}
