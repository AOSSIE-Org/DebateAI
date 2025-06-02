package main

import (
	"log"
	"os"
	"strconv"

	"arguehub/config"
	"arguehub/db"
	"arguehub/middlewares"
	"arguehub/routes"
	"arguehub/services"
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

	services.InitDebateVsBotService(cfg)
	services.InitCoachService()
	// Connect to MongoDB using the URI from the configuration
	if err := db.ConnectMongoDB(cfg.Database.URI); err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	log.Println("Connected to MongoDB")

	// Seed initial debate-related data
	utils.SeedDebateData()
	utils.PopulateTestUsers()

	// Create uploads directory
	os.MkdirAll("uploads", os.ModePerm)

	// Set up the Gin router and configure routes
	router := setupRouter(cfg)
	port := strconv.Itoa(cfg.Server.Port)
	log.Printf("Server starting on port %s", port)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func setupRouter(cfg *config.Config) *gin.Engine {
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
	router.POST("/signup", routes.SignUpRouteHandler)
	router.POST("/verifyEmail", routes.VerifyEmailRouteHandler)
	router.POST("/login", routes.LoginRouteHandler)
	router.POST("/googleLogin", routes.GoogleLoginRouteHandler)
	router.POST("/forgotPassword", routes.ForgotPasswordRouteHandler)
	router.POST("/confirmForgotPassword", routes.VerifyForgotPasswordRouteHandler)
	router.POST("/verifyToken", routes.VerifyTokenRouteHandler)

	// Protected routes (JWT auth)
	auth := router.Group("/")
	auth.Use(middlewares.AuthMiddleware("./config/config.prod.yml"))
	{
		auth.GET("/user/fetchprofile", routes.GetProfileRouteHandler)
		auth.PUT("/user/updateprofile", routes.UpdateProfileRouteHandler)
		auth.GET("/leaderboard", routes.GetLeaderboardRouteHandler)
		auth.POST("/debate/result", routes.UpdateEloAfterDebateRouteHandler)
		routes.SetupDebateVsBotRoutes(auth)

		// WebSocket signaling endpoint
		auth.GET("/ws", websocket.WebsocketHandler)

		routes.SetupTranscriptRoutes(auth)
		auth.GET("/coach/strengthen-argument/weak-statement", routes.GetWeakStatement)
		auth.POST("/coach/strengthen-argument/evaluate", routes.EvaluateStrengthenedArgument)

		// Add Room routes.
		auth.GET("/rooms", routes.GetRoomsHandler)
		auth.POST("/rooms", routes.CreateRoomHandler)
		auth.POST("/rooms/:id/join", routes.JoinRoomHandler)

		auth.GET("/chat/:roomId", websocket.RoomChatHandler)

		auth.GET("/coach/pros-cons/topic", routes.GetProsConsTopic)
		auth.POST("/coach/pros-cons/submit", routes.SubmitProsCons)
	}

	return router
}
