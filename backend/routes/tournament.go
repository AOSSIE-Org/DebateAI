package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func SetupTournamentRoutes(router *gin.RouterGroup) {
	tGroup := router.Group("/tournaments")
	{
		tGroup.POST("", controllers.CreateTournament)
		tGroup.GET("", controllers.ListTournaments)
		tGroup.GET("/:id", controllers.GetTournament)
		tGroup.POST("/:id/register", controllers.RegisterTournament)
		tGroup.POST("/:id/start", controllers.StartTournament)
		tGroup.POST("/:id/matches/:matchId/report", controllers.ReportTournamentMatch)
	}
}
