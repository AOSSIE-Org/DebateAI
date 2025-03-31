package middlewares

import (
	"fmt"
	"net/http"
	"strings"

	"arguehub/utils"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware verifies JWT and sets user email in context
func AuthMiddleware(configPath string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing Authorization token"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Authorization token format"})
			c.Abort()
			return
		}
		token := parts[1]

		// Validate token and fetch email
		valid, email, err := utils.ValidateTokenAndFetchEmail(configPath, token, c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": fmt.Sprintf("Token validation error: %v", err)})
			c.Abort()
			return
		}
		if !valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Set user email in context
		c.Set("userEmail", email)
		c.Next()
	}
}
