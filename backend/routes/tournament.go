package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func SetupTournamentRoutes(router *gin.RouterGroup) {
	
	router.POST("/tournaments", controllers.CreateTournamentHandler)
	router.GET("/tournaments", controllers.GetTournaments)
	router.PATCH("/tournaments/:id", controllers.UpdateTournamentHandler)
	router.GET("/tournaments/:id", controllers.GetTournamentByID)
	router.DELETE("/tournaments/:id", controllers.DeleteTournamentHandler)

	
	// ============================================
	// Public Tournament Join
	router.POST("/tournaments/:id/join", controllers.JoinPublicTournament)

	// Private Tournament Join (Request)
	router.POST("/tournaments/join", controllers.JoinPrivateTournament)

	// CHOOSE STANCE
	router.PATCH("/tournaments/:id/stance", controllers.ChooseStance)

	// MODERATOR: GET PENDING REQUESTS
	router.GET("/tournaments/:id/requests", controllers.GetPendingRequests)

	// MODERATOR: MANAGE REQUEST (APPROVE/REJECT)
	router.PATCH("/tournaments/:id/request/:userId", controllers.ManageJoinRequest)
}
