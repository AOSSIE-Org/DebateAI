package middlewares

import (
	"arguehub/config"
	"arguehub/db"
	"arguehub/models"
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
)

func AuthMiddleware(configPath string) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("AuthMiddleware called for path: %s", c.Request.URL.Path)
		
		cfg, err := config.LoadConfig(configPath)
		if err != nil {
			log.Printf("Failed to load config: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load configuration"})
			c.Abort()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			log.Printf("No Authorization header for path: %s", c.Request.URL.Path)
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
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token", "message": err.Error()})
			c.Abort()
			return
		}

		email := claims["sub"].(string)
		
		// Fetch user from database
		dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		var user models.User
		err = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": email}).Decode(&user)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
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
