package routes

import (
	"arguehub/controllers"
	"arguehub/middlewares"

	"github.com/gin-gonic/gin"
)

func SetupTournamentRoutes(auth *gin.RouterGroup) {
	auth.POST("/tournaments", controllers.CreateTournamentHandler)
	auth.GET("/tournaments", controllers.GetTournaments)
	auth.PATCH("/tournaments/:id", controllers.UpdateTournamentHandler)
	auth.GET("/tournaments/:id", controllers.GetTournamentByID)
	auth.DELETE("/tournaments/:id", controllers.DeleteTournamentHandler)
	auth.POST("/tournaments/:id/join", controllers.JoinPublicTournament)
	auth.POST("/tournaments/join", middlewares.TournamentInviteRateLimit(), controllers.JoinPrivateTournament)
	auth.GET("/tournaments/:id/request", controllers.GetTournamentRequestHandler)
	auth.GET("/tournaments/:id/requests", controllers.GetPendingRequests)
	auth.PATCH("/tournaments/:id/request/:userId", controllers.ManageJoinRequest)
	auth.PATCH("/tournaments/:id/stance", controllers.ChooseStance)
	auth.POST("/tournaments/:id/start", controllers.StartTournamentHandler)
	auth.GET("/tournaments/:id/execution", controllers.GetTournamentExecutionHandler)
	auth.GET("/tournaments/:id/evaluation", controllers.GetTournamentEvaluationHandler)
	auth.POST("/tournaments/:id/transcript", controllers.SubmitTournamentTranscriptHandler)
}
