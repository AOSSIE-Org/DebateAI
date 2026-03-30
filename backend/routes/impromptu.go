package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

// SetupImpromptuDebateRoutes sets up the impromptu debate-related routes
func SetupImpromptuDebateRoutes(router *gin.RouterGroup) {
	impromptu := router.Group("/impromptu")
	{
		impromptu.GET("/topic", controllers.GetRandomTopicHandler)
		impromptu.POST("/evaluate", controllers.EvaluateImpromptuHandler)
	}
}
