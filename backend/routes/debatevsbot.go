package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

// SetupDebateVsBotRoutes sets up the debate-related routes for bot debates
func SetupDebateVsBotRoutes(router *gin.RouterGroup, llmRateLimit gin.HandlerFunc) {
	vsbot := router.Group("/vsbot")
	{
		vsbot.POST("/create", controllers.CreateDebate)
		vsbot.POST("/debate", llmRateLimit, controllers.SendDebateMessage)
		vsbot.POST("/judge", llmRateLimit, controllers.JudgeDebate)
		vsbot.POST("/concede", controllers.ConcedeDebate)
	}
}
