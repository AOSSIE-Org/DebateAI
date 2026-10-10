package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func SetupTournamentRoutes(auth *gin.RouterGroup) {
	auth.POST("/tournaments", controllers.CreateTournamentHandler)
	  auth.DELETE("/tournaments/:id", controllers.DeleteTournamentHandler)
}