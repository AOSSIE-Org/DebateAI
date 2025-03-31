package main

import (
	"log"
	"strconv"

	"arguehub/config"
	"arguehub/db"
	"arguehub/middlewares"
	"arguehub/routes"
	"arguehub/utils"
	"arguehub/websocket"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load the configuration from the specified YAML file
	cfg, err := config.LoadConfig("./config/config.prod.yml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Establish a connection to MongoDB using the URI from the configuration
	if err := db.ConnectMongoDB(cfg.Database.URI); err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	log.Println("Connected to MongoDB")

	// Populate initial debate-related data (custom data seeding utility function)
	utils.SeedDebateData()
	utils.PopulateTestUsers()

	// Set up the Gin router and configure CORS, middleware, and routes
	router := setupRouter(cfg)
	port := strconv.Itoa(cfg.Server.Port)
	log.Printf("Server starting on port %s", port)

	// Start the server on the configured port
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func setupRouter(cfg *config.Config) *gin.Engine {
	router := gin.Default()

	// Set trusted proxies to prevent reverse proxy issues in certain deployment scenarios
	router.SetTrustedProxies([]string{"127.0.0.1", "localhost"})

	// Apply CORS policy to allow requests from the frontend (localhost:5173)
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"}, // Allow frontend on localhost
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Handle preflight OPTIONS requests
	router.OPTIONS("/*path", func(c *gin.Context) {
		c.Status(204)
	})

	// Public routes for authentication and user actions
	router.POST("/signup", routes.SignUpRouteHandler)                              // Handle user signup
	router.POST("/verifyEmail", routes.VerifyEmailRouteHandler)                    // Verify user email
	router.POST("/login", routes.LoginRouteHandler)                                // Handle user login
	router.POST("/forgotPassword", routes.ForgotPasswordRouteHandler)              // Handle forgotten password requests
	router.POST("/confirmForgotPassword", routes.VerifyForgotPasswordRouteHandler) // Verify password reset token
	router.POST("/verifyToken", routes.VerifyTokenRouteHandler)                    // Verify token (JWT or other)

	// WebSocket route for real-time communication
	router.GET("/ws", websocket.WebsocketHandler)

	// Protected routes requiring authentication (JWT validation)
	auth := router.Group("/")
	auth.Use(middlewares.AuthMiddleware("./config/config.prod.yml")) // Apply custom authentication middleware
	{
		// Profile management routes
		auth.GET("/user/fetchprofile", routes.GetProfileRouteHandler)     // Fetch user profile data
		auth.PUT("/user/updateprofile", routes.UpdateProfileRouteHandler) // Update user profile

		// Get leaderboard with user rankings based on debates
		auth.GET("/leaderboard", routes.GetLeaderboardRouteHandler)

		// Update ELO score after a debate (e.g., for leaderboard updates)
		auth.POST("/debate/result", routes.UpdateEloAfterDebateRouteHandler)
	}

	return router
}
