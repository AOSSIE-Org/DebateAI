package main

import (
	"fmt"
	"log"
	"strconv"

	"arguehub/config"
	"arguehub/routes"
	"arguehub/websocket"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.LoadConfig("./config/config.prod.yml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	fmt.Printf("Loaded Config:\nClient ID: %s\n",
		cfg.Cognito.AppClientId,
	)

	router := setupRouter(cfg)

	port := strconv.Itoa(cfg.Server.Port)
	log.Printf("Server starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func setupRouter(cfg *config.Config) *gin.Engine {
	// gin.SetMode(gin.ReleaseMode) // Uncomment this line for production

	router := gin.Default()
	router.SetTrustedProxies([]string{"127.0.0.1", "localhost"})

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	router.OPTIONS("/*path", func(c *gin.Context) {
		c.Status(204)
	})
	router.GET("/", func(c *gin.Context) {
		log.Println("Root route hit")
		c.JSON(200, gin.H{"message": "Welcome to ArgueHub API!"})
	})

	router.POST("/signup", routes.SignUpRouteHandler)
	router.POST("/verifyEmail", routes.VerifyEmailRouteHandler)
	router.POST("/login", routes.LoginRouteHandler)
	router.POST("/forgotPassword", routes.ForgotPasswordRouteHandler)
	router.POST("/confirmForgotPassword", routes.VerifyForgotPasswordRouteHandler)
	router.POST("/verifyToken", routes.VerifyTokenRouteHandler)

	router.GET("/ws", websocket.WebsocketHandler)

	return router
}
