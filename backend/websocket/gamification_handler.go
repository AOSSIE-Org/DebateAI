package websocket

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
)

// GamificationWebSocketHandler handles WebSocket connections for gamification updates
func GamificationWebSocketHandler(c *gin.Context) {
	// Get token from Authorization header or query parameter
	var tokenString string
	authz := c.GetHeader("Authorization")
	if authz != "" {
		// Extract token from header
		tokenParts := strings.Split(authz, " ")
		if len(tokenParts) == 2 && tokenParts[0] == "Bearer" {
			tokenString = tokenParts[1]
		}
	}
	
	// Fallback to query parameter if header not present
	if tokenString == "" {
		tokenString = c.Query("token")
	}
	
	if tokenString == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
		return
	}

	// Get JWT secret from utils
	jwtSecret := utils.GetJWTSecret()
	if jwtSecret == "" {
		log.Printf("JWT secret not configured")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server configuration error"})
		return
	}

	// Validate JWT token
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(jwtSecret), nil
	})

	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
		return
	}

	email, ok := claims["sub"].(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token: missing email"})
		return
	}

	// Get user from database
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	var user models.User
	err = db.MongoDatabase.Collection("users").FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	// Upgrade connection to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Create gamification client
	client := &GamificationClient{
		Conn:   conn,
		UserID: user.ID.Hex(),
	}

	// Register client
	RegisterGamificationClient(client)

	// Send welcome message
	welcomeMsg := map[string]interface{}{
		"type":    "connected",
		"message": "Connected to gamification updates",
		"userId":  user.ID.Hex(),
	}
	client.SafeWriteJSON(welcomeMsg)

	// Handle client disconnection
	defer func() {
		UnregisterGamificationClient(client)
	}()

	// Keep connection alive and handle incoming messages (ping/pong)
	for {
		messageType, _, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Gamification WebSocket error: %v", err)
			}
			break
		}

		// Handle ping/pong for keepalive
		if messageType == websocket.PingMessage {
			if err := conn.WriteMessage(websocket.PongMessage, nil); err != nil {
				log.Printf("Error writing pong: %v", err)
				break
			}
		}
	}
}

