package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

// SetupDebateVsBotRoutes sets up the debate-related routes for bot debates
func SetupDebateVsBotRoutes(router *gin.RouterGroup) {
	vsbot := router.Group("/vsbot")
	{
		vsbot.POST("/create", controllers.CreateDebate)
		vsbot.POST("/debate", controllers.SendDebateMessage)
		vsbot.POST("/judge", controllers.JudgeDebate)
		vsbot.POST("/concede", controllers.ConcedeDebate)
		vsbot.POST("/debate/:id/vote", controllers.SubmitVote)
		vsbot.GET("/debate/:id/verdicts", controllers.GetVerdicts)
	}
}
