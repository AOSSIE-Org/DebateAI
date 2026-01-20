package routes

import (
	"log"

	"arguehub/config"
	"arguehub/middlewares"
	"arguehub/services"
	"arguehub/websocket"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// SetupRouter configures the Gin engine and routes
func SetupRouter(cfg *config.Config) *gin.Engine {
	// Initialize global services
	services.InitAuthService(cfg)

	router := gin.Default()

	// Set trusted proxies (adjust as needed)
	router.SetTrustedProxies([]string{"127.0.0.1", "localhost"})

	// Configure CORS for your frontend (e.g., localhost:5173 for Vite)
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))
	router.OPTIONS("/*path", func(c *gin.Context) { c.Status(204) })

	// Public routes for authentication
	router.POST("/signup", SignUpRouteHandler)
	router.POST("/verifyEmail", VerifyEmailRouteHandler)
	router.POST("/login", LoginRouteHandler)
	router.POST("/googleLogin", GoogleLoginRouteHandler)
	router.POST("/forgotPassword", ForgotPasswordRouteHandler)
	router.POST("/confirmForgotPassword", VerifyForgotPasswordRouteHandler)
	router.POST("/verifyToken", VerifyTokenRouteHandler)

	// Debug endpoint for matchmaking pool status
	router.GET("/debug/matchmaking-pool", GetMatchmakingPoolStatusHandler)

	// WebSocket routes (handle auth internally)
	router.GET("/ws/matchmaking", websocket.MatchmakingHandler)
	router.GET("/ws/gamification", websocket.GamificationWebSocketHandler)

	// Protected routes (JWT auth)
	auth := router.Group("/")
	auth.Use(middlewares.AuthMiddleware("./config/config.prod.yml")) // Ideally pass this path via config
	{
		auth.GET("/user/fetchprofile", GetProfileRouteHandler)
		auth.PUT("/user/updateprofile", UpdateProfileRouteHandler)
		auth.GET("/leaderboard", GetLeaderboardRouteHandler)
		auth.POST("/debate/result", UpdateRatingAfterDebateRouteHandler)

		// Gamification routes
		auth.POST("/api/award-badge", AwardBadgeRouteHandler)
		auth.POST("/api/update-score", UpdateScoreRouteHandler)
		auth.GET("/api/leaderboard", GetGamificationLeaderboardRouteHandler)

		SetupDebateVsBotRoutes(auth)

		// WebSocket signaling endpoint (handles auth internally)
		router.GET("/ws", websocket.WebsocketHandler)

		// Set up transcript routes
		SetupTranscriptRoutes(auth)

		auth.GET("/coach/strengthen-argument/weak-statement", GetWeakStatement)
		auth.POST("/coach/strengthen-argument/evaluate", EvaluateStrengthenedArgument)

		// Add Room routes.
		auth.GET("/rooms", GetRoomsHandler)
		auth.POST("/rooms", CreateRoomHandler)
		auth.POST("/rooms/:id/join", JoinRoomHandler)
		auth.GET("/rooms/:id/participants", GetRoomParticipantsHandler)

		// Chat functionality is now handled by the main WebSocket handler

		// Team routes
		SetupTeamRoutes(auth)
		SetupTeamDebateRoutes(auth)
		SetupTeamChatRoutes(auth)
		SetupTeamMatchmakingRoutes(auth)
		log.Println("Team routes registered")

		// Community routes
		SetupCommunityRoutes(auth)
		log.Println("Community routes registered")

		// Notification routes
		auth.GET("/notifications", GetNotificationsRouteHandler)
		auth.PUT("/notifications/:id/read", MarkNotificationAsReadRouteHandler)
		auth.PUT("/notifications/read-all", MarkAllNotificationsAsReadRouteHandler)
		auth.DELETE("/notifications/:id", DeleteNotificationRouteHandler)
	}

	// Team WebSocket handler
	router.GET("/ws/team", websocket.TeamWebsocketHandler)

	// Admin routes
	SetupAdminRoutes(router, "./config/config.prod.yml")
	log.Println("Admin routes registered")

	// Debate spectator WebSocket handler (no auth required for anonymous spectators)
	router.GET("/ws/debate/:debateID", websocket.DebateWebsocketHandler)

	return router
}
