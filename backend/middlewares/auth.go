package middlewares

import (
	"arguehub/config"
	"arguehub/db"
	"arguehub/models"
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

func AuthMiddleware(configPath string) gin.HandlerFunc {
	return func(c *gin.Context) {

		cfg, err := config.LoadConfig(configPath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load configuration"})
			c.Abort()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			c.Abort()
			return
		}

		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			c.Abort()
			return
		}

		claims, err := validateJWT(tokenParts[1], cfg.JWT.Secret)
		if err != nil {
			log.Printf("JWT validation failed for path %s: %v", c.Request.URL.Path, err)
			log.Printf("Current server time: %s", time.Now().Format(time.RFC3339))
			// Try to decode token to see expiration time even if invalid
			if token, decodeErr := jwt.Parse(tokenParts[1], nil); decodeErr == nil {
				if mapClaims, ok := token.Claims.(jwt.MapClaims); ok {
					if exp, exists := mapClaims["exp"]; exists {
						if expFloat, ok := exp.(float64); ok {
							expTime := time.Unix(int64(expFloat), 0)
							log.Printf("Token expiration time: %s (Unix: %.0f)", expTime.Format(time.RFC3339), expFloat)
							log.Printf("Time until expiration: %v", time.Until(expTime))
						}
					}
				}
			}
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token", "message": err.Error()})
			c.Abort()
			return
		}

		email, ok := claims["sub"].(string)
		if !ok || email == "" {
			log.Printf("Invalid or missing 'sub' claim in JWT")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		// Fetch user from database
		dbCtx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		if db.MongoDatabase == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not initialized"})
			c.Abort()
			return
		}

		var user models.User
		err = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": email}).Decode(&user)
		if err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			} else {
				log.Printf("Failed to load user %s: %v", email, err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Authentication lookup failed"})
			}
			c.Abort()
			return
		}

		// Set user data in context
		c.Set("email", email)
		c.Set("userID", user.ID)
		c.Set("displayName", user.DisplayName)
		c.Set("avatarUrl", user.AvatarURL)
		c.Set("rating", user.Rating)
		c.Next()
	}
}

func validateJWT(tokenString, secret string) (jwt.MapClaims, error) {
	// Use ParseWithClaims to get better error messages
	claims := jwt.MapClaims{}
	
	token, err := jwt.ParseWithClaims(tokenString, &claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	
	if err != nil {
		// In jwt/v5, check for specific error types
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, fmt.Errorf("token is expired")
		}
		if errors.Is(err, jwt.ErrTokenNotValidYet) {
			return nil, fmt.Errorf("token is not valid yet")
		}
		if errors.Is(err, jwt.ErrTokenMalformed) {
			return nil, fmt.Errorf("token is malformed")
		}
		// Check error message for additional context
		errMsg := err.Error()
		if strings.Contains(errMsg, "expired") || strings.Contains(errMsg, "exp") {
			return nil, fmt.Errorf("token is expired")
		}
		return nil, fmt.Errorf("token validation failed: %v", err)
	}
	
	if !token.Valid {
		return nil, fmt.Errorf("token is invalid")
	}
	
	// Log successful validation for debugging
	log.Printf("JWT validation successful - Email: %v, Exp: %v", claims["sub"], claims["exp"])
	
	return claims, nil
}
