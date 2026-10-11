package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func SetupTournamentRoutes(auth *gin.RouterGroup) {
	auth.POST("/tournaments", controllers.CreateTournamentHandler)
	auth.GET("/tournaments", controllers.GetTournaments)
	auth.PATCH("/tournaments/:id", controllers.UpdateTournamentHandler)
	auth.GET("/tournaments/:id", controllers.GetTournamentByID)
	 auth.DELETE("/tournaments/:id", controllers.DeleteTournamentHandler) 
}
