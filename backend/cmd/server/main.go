package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

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

func main() {
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "./config/config.prod.yml"
	}

	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		panic("Failed to load config: " + err.Error())
	}

	services.InitDebateVsBotService(cfg)
	services.InitCoachService()
	services.InitRatingService(cfg)

	if err := db.ConnectMongoDB(cfg.Database.URI); err != nil {
		panic("Failed to connect to MongoDB: " + err.Error())
	}
	log.Println("Connected to MongoDB")

	if err := db.EnsureIndexes(); err != nil {
		log.Fatalf("Failed to ensure indexes: %v", err)
	}

	if err := middlewares.InitCasbin(configPath); err != nil {
		log.Fatalf("Failed to initialize Casbin: %v", err)
	}
	log.Println("Casbin RBAC initialized")

	if cfg.Redis.Addr != "" {
		redisURL := cfg.Redis.Addr
		if err := debate.InitRedis(redisURL, cfg.Redis.Password, cfg.Redis.DB); err != nil {
			log.Printf("Warning: Failed to initialize Redis: %v", err)
			log.Printf("Some realtime features will be unavailable until Redis is reachable")
		} else {
			log.Println("Connected to Redis")
		}
	} else {
		log.Println("Redis Addr not configured; continuing without Redis-backed features")
	}

	go websocket.WatchForNewRooms()

	utils.SetJWTSecret(cfg.JWT.Secret)
	if os.Getenv("SEED_DEMO_DATA") == "true" {
		utils.SeedDebateData()
		utils.PopulateTestUsers()
	}

	if err := os.MkdirAll("uploads", os.ModePerm); err != nil {
		log.Fatalf("Failed to create uploads directory: %v", err)
	}

	router := setupRouter(cfg, configPath)
	port := strconv.Itoa(cfg.Server.Port)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	var workers sync.WaitGroup
	judge, err := services.TournamentJudgeFromEnvironment(cfg.Gemini.ApiKey)
	if err != nil {
		log.Fatal("Tournament evaluation configuration is invalid")
	}
	if judge != nil {
		workers.Add(1)
		go func() {
			defer workers.Done()
			services.TournamentEvaluationService{Collection: db.MongoDatabase.Collection("tournaments"), Provider: judge}.Run(ctx)
		}()
	} else {
		log.Print("Tournament evaluation disabled; pending inputs are retained")
	}
	workers.Add(1)
	go func() {
		defer workers.Done()
		services.TournamentExecutionService{Collection: db.MongoDatabase.Collection("tournaments")}.RunRecovery(ctx)
	}()
	server := &http.Server{Addr: ":" + port, Handler: router, ReadHeaderTimeout: 10 * time.Second}
	failures := make(chan error, 1)
	go func() { failures <- server.ListenAndServe() }()
	var serverError error
	select {
	case <-ctx.Done():
	case err := <-failures:
		if !errors.Is(err, http.ErrServerClosed) {
			serverError = err
		}
	}
	stop()
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdown); err != nil {
		log.Printf("Server shutdown: %v", err)
	}
	workers.Wait()
	if serverError != nil {
		log.Fatalf("Server stopped: %v", serverError)
	}
}

func setupRouter(cfg *config.Config, configPath string) *gin.Engine {
	router := gin.Default()

	router.SetTrustedProxies([]string{"127.0.0.1", "localhost"})

	allowedOrigins := []string{"http://localhost:5173"}
	if value := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS")); value != "" {
		allowedOrigins = strings.Split(value, ",")
		for i := range allowedOrigins {
			allowedOrigins[i] = strings.TrimSpace(allowedOrigins[i])
		}
	}

	router.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	router.OPTIONS("/*path", func(c *gin.Context) {
		c.Status(204)
	})

	router.POST("/signup", routes.SignUpRouteHandler)
	router.POST("/verifyEmail", routes.VerifyEmailRouteHandler)
	router.POST("/login", routes.LoginRouteHandler)
	router.POST("/googleLogin", routes.GoogleLoginRouteHandler)
	router.POST("/forgotPassword", routes.ForgotPasswordRouteHandler)
	router.POST("/confirmForgotPassword", routes.VerifyForgotPasswordRouteHandler)
	router.POST("/verifyToken", routes.VerifyTokenRouteHandler)
	router.POST("/resendVerification", routes.ResendVerificationRouteHandler)

	router.GET("/debug/matchmaking-pool", routes.GetMatchmakingPoolStatusHandler)

	router.GET("/ws/matchmaking", websocket.MatchmakingHandler)
	router.GET("/ws/gamification", websocket.GamificationWebSocketHandler)

	auth := router.Group("/")
	auth.Use(middlewares.AuthMiddleware(configPath))
	{
		auth.GET("/user/fetchprofile", routes.GetProfileRouteHandler)
		auth.PUT("/user/updateprofile", routes.UpdateProfileRouteHandler)
		auth.GET("/user/check-displayname", routes.CheckDisplayNameRouteHandler)
		auth.GET("/leaderboard", routes.GetLeaderboardRouteHandler)

		auth.POST("/api/award-badge", routes.AwardBadgeRouteHandler)
		auth.POST("/api/update-score", routes.UpdateScoreRouteHandler)
		auth.GET("/api/leaderboard", routes.GetGamificationLeaderboardRouteHandler)

		routes.SetupDebateVsBotRoutes(auth)

		router.GET("/ws", websocket.WebsocketHandler)

		routes.SetupTranscriptRoutes(auth)
		routes.SetupCoachRoutes(auth)

		auth.GET("/rooms", routes.GetRoomsHandler)
		auth.POST("/rooms", routes.CreateRoomHandler)
		auth.POST("/rooms/:id/join", routes.JoinRoomHandler)
		auth.GET("/rooms/:id/participants", routes.GetRoomParticipantsHandler)

		routes.SetupTeamRoutes(auth)
		routes.SetupTeamDebateRoutes(auth)
		routes.SetupTeamChatRoutes(auth)
		routes.SetupTeamMatchmakingRoutes(auth)

		log.Println("Team routes registered")

		routes.SetupCommunityRoutes(auth)
		log.Println("Community routes registered")

		routes.SetupTournamentRoutes(auth)
		log.Println("Tournament routes registered")

		auth.GET("/notifications", routes.GetNotificationsRouteHandler)
		auth.PUT("/notifications/:id/read", routes.MarkNotificationAsReadRouteHandler)
		auth.PUT("/notifications/read-all", routes.MarkAllNotificationsAsReadRouteHandler)
		auth.DELETE("/notifications/:id", routes.DeleteNotificationRouteHandler)
	}

	router.GET("/ws/team", websocket.TeamWebsocketHandler)

	routes.SetupAdminRoutes(router, configPath)
	log.Println("Admin routes registered")

	router.GET("/ws/debate/:debateID", websocket.DebateWebsocketHandler)

	return router
}
