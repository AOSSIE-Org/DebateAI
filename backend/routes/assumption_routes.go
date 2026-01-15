package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

// SetupAssumptionRoutes sets up routes for debate assumption extraction
func SetupAssumptionRoutes(router *gin.RouterGroup) {
	// Get assumptions for a specific debate
	router.GET("/debates/:debateId/assumptions", controllers.GetDebateAssumptions)
}
