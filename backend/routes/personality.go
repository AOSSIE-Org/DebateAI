package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

// SetupPersonalityRoutes registers the personality profile routes
func SetupPersonalityRoutes(router *gin.RouterGroup) {
	router.POST("/api/debates/:id/personality", controllers.GeneratePersonalityProfilesHandler)
	router.GET("/api/debates/:id/personality", controllers.GetPersonalityProfilesHandler)
}
