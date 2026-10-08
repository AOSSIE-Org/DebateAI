package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

// SetupFactCheckRoutes registers real-time fact-checking endpoints
func SetupFactCheckRoutes(router *gin.RouterGroup) {
	router.POST("/debate/fact-check", controllers.FactCheckDebateStatement)
}
