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
)

func main() {
	// Load the configuration from the specified YAML file
	cfg, err := config.LoadConfig("./config/config.prod.yml")
	if err != nil {
		panic("Failed to load config: " + err.Error())
	}

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
	// FIX: Changed .URL to .Addr to match config.go definition
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


	// Create uploads directory
	os.MkdirAll("uploads", os.ModePerm)

	// Set up the Gin router and configure routes
	router := routes.SetupRouter(cfg)
	port := strconv.Itoa(cfg.Server.Port)

	if err := router.Run(":" + port); err != nil {
		panic("Failed to start server: " + err.Error())
	}
}
