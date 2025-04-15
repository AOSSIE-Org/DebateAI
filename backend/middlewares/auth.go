package middlewares

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"arguehub/utils"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware verifies JWT and sets user email in context
func AuthMiddleware(configPath string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check Authorization header first
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			// Fallback to query parameter "token"
			tokenQuery := c.Query("token")
			if tokenQuery != "" {
				authHeader = "Bearer " + tokenQuery
			}
		}

		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing Authorization token"})
			c.Abort()
			return
		}

		// Split the header value into two parts (Bearer and the token)
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Authorization token format"})
			c.Abort()
			return
		}
		token := parts[1]

		// Validate token and fetch email using your utility function
		valid, email, err := utils.ValidateTokenAndFetchEmail(configPath, token, c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": fmt.Sprintf("Token validation error: %v", err)})
			c.Abort()
			return
		}
		if !valid {
			log.Println("Invalid or expired token:", token)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Set the user's email in the context for later use
		c.Set("userEmail", email)
		c.Next()
	}
}
