package main

import (
	"log"
	"os"
	"strconv"

	"arguehub/config"
	"arguehub/db"
	"arguehub/internal/debate"
	"arguehub/middlewares"
	"arguehub/routes"
	"arguehub/services"
	"arguehub/utils"
	"arguehub/websocket"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)


import "github.com/joho/godotenv"

func main() {
    // Load .env file
    if err := godotenv.Load(); err != nil {
        log.Println("No .env file found")
    }

    // Now os.Getenv("GEMINI_API_KEY") will work!
    apiKey := os.Getenv("GEMINI_API_KEY")
    // 1. Load the configuration
    cfg, err := config.LoadConfig("./config/config.prod.yml")
    if err != nil {
        panic("Failed to load config: " + err.Error())
    }

    // Initialize Gemini for Translation
    // Assuming your cfg has an APIKey field, or use os.Getenv
    geminiKey := os.Getenv("GEMINI_API_KEY") 
    if err := services.InitGemini(geminiKey); err != nil {
        log.Printf("⚠️ Warning: Gemini failed to initialize: %v", err)
    } else {
        log.Println("✅ Gemini AI initialized for translations")
    }
    // ---------------------------

    services.InitDebateVsBotService(cfg)
    services.InitCoachService()
    services.InitRatingService(cfg)

	// Connect to MongoDB using the URI from the configuration
	if err := db.ConnectMongoDB(cfg.Database.URI); err != nil {
		panic("Failed to connect to MongoDB: " + err.Error())
	}
	log.Println("Connected to MongoDB")

	// Initialize Casbin RBAC
	if err := middlewares.InitCasbin("./config/config.prod.yml"); err != nil {
		log.Fatalf("Failed to initialize Casbin: %v", err)
	}
	log.Println("Casbin RBAC initialized")

	// Connect to Redis if configured
	
	if cfg.Redis.Addr != "" {
		redisURL := cfg.Redis.Addr
		if redisURL == "" {
			redisURL = "localhost:6379"
		}
		if err := debate.InitRedis(redisURL, cfg.Redis.Password, cfg.Redis.DB); err != nil {
			log.Printf("⚠️ Warning: Failed to initialize Redis: %v", err)
			log.Printf("⚠️ Some realtime features will be unavailable until Redis is reachable")
		} else {
			log.Println("Connected to Redis")
		}
	} else {
		log.Println("Redis Addr not configured; continuing without Redis-backed features")
	}
	// Start the room watching service for matchmaking after DB connection
	go websocket.WatchForNewRooms()

	utils.SetJWTSecret(cfg.JWT.Secret)

	// Seed initial debate-related data
	utils.SeedDebateData()
	utils.PopulateTestUsers()

	// Create uploads directory
	os.MkdirAll("uploads", os.ModePerm)

	// Set up the Gin router and configure routes
	router := setupRouter(cfg)
	port := strconv.Itoa(cfg.Server.Port)

	if err := router.Run(":" + port); err != nil {
		panic("Failed to start server: " + err.Error())
	}
}

func setupRouter(cfg *config.Config) *gin.Engine {
	router := gin.Default()

	// Set trusted proxies (adjust as needed)
	router.SetTrustedProxies([]string{"127.0.0.1", "localhost"})

	// Configure CORS for  frontend (e.g., localhost:5173 for Vite)
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))
	router.OPTIONS("/*path", func(c *gin.Context) { c.Status(204) })

	// Public routes for authentication
	router.POST("/signup", routes.SignUpRouteHandler)
	router.POST("/verifyEmail", routes.VerifyEmailRouteHandler)
	router.POST("/login", routes.LoginRouteHandler)
	router.POST("/googleLogin", routes.GoogleLoginRouteHandler)
	router.POST("/forgotPassword", routes.ForgotPasswordRouteHandler)
	router.POST("/confirmForgotPassword", routes.VerifyForgotPasswordRouteHandler)
	router.POST("/verifyToken", routes.VerifyTokenRouteHandler)
    router.POST("/api/translate", TranslationHandler)

	// Debug endpoint for matchmaking pool status
	router.GET("/debug/matchmaking-pool", routes.GetMatchmakingPoolStatusHandler)

	// WebSocket routes (handle auth internally)
	router.GET("/ws/matchmaking", websocket.MatchmakingHandler)
	router.GET("/ws/gamification", websocket.GamificationWebSocketHandler)

	
	// Protected routes (JWT auth)
	auth := router.Group("/")
	auth.Use(middlewares.AuthMiddleware("./config/config.prod.yml"))
	{
		auth.GET("/user/fetchprofile", routes.GetProfileRouteHandler)
		auth.PUT("/user/updateprofile", routes.UpdateProfileRouteHandler)
		auth.GET("/leaderboard", routes.GetLeaderboardRouteHandler)
		auth.POST("/debate/result", routes.UpdateRatingAfterDebateRouteHandler)

		// Gamification routes
		auth.POST("/api/award-badge", routes.AwardBadgeRouteHandler)
		auth.POST("/api/update-score", routes.UpdateScoreRouteHandler)
		auth.GET("/api/leaderboard", routes.GetGamificationLeaderboardRouteHandler)

		routes.SetupDebateVsBotRoutes(auth)

		// WebSocket signaling endpoint (handles auth internally)
		router.GET("/ws", websocket.WebsocketHandler)

		// Set up transcript routes
		routes.SetupTranscriptRoutes(auth)

		auth.GET("/coach/strengthen-argument/weak-statement", routes.GetWeakStatement)
		auth.POST("/coach/strengthen-argument/evaluate", routes.EvaluateStrengthenedArgument)

		// Add Room routes.
		auth.GET("/rooms", routes.GetRoomsHandler)
		auth.POST("/rooms", routes.CreateRoomHandler)
		auth.POST("/rooms/:id/join", routes.JoinRoomHandler)
		auth.GET("/rooms/:id/participants", routes.GetRoomParticipantsHandler)

		// Chat functionality is now handled by the main WebSocket handler

		// Team routes
		routes.SetupTeamRoutes(auth)
		routes.SetupTeamDebateRoutes(auth)
		routes.SetupTeamChatRoutes(auth)
		routes.SetupTeamMatchmakingRoutes(auth)
		log.Println("Team routes registered")

		// Community routes
		routes.SetupCommunityRoutes(auth)
		log.Println("Community routes registered")
	}

	// Team WebSocket handler
	router.GET("/ws/team", websocket.TeamWebsocketHandler)

	// Admin routes
	routes.SetupAdminRoutes(router, "./config/config.prod.yml")
	log.Println("Admin routes registered")

	// Debate spectator WebSocket handler (no auth required for anonymous spectators)
	// FIX: Use websocket.DebateWebsocketHandler (moved to websocket package)
	router.GET("/ws/debate/:debateID", websocket.DebateWebsocketHandler)

	return router
}


type TranslationRequest struct {
	Text       string `json:"text"`
	TargetLang string `json:"target_lang"`
}

type TranslationResponse struct {
	TranslatedText string `json:"translatedText"`
}

func TranslationHandler(c *gin.Context) {
	var req TranslationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request"})
		return
	}

	// This calls the TranslateContent function we created in services/gemini.go
	translated, err := services.TranslateContent(req.Text, "en", req.TargetLang)
	if err != nil {
		c.JSON(500, gin.H{"error": "Translation failed"})
		return
	}

	c.JSON(200, TranslationResponse{
		TranslatedText: translated,
	})
}