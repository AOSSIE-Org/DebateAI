package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func SetupTournamentRoutes(auth *gin.RouterGroup) {
	auth.GET("/tournaments", controllers.GetTournaments)
	auth.PATCH("/tournaments/:id", controllers.UpdateTournamentHandler)
}
