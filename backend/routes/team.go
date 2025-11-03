package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

// SetupTeamRoutes sets up team-related routes
func SetupTeamRoutes(router *gin.RouterGroup) {
	teamRoutes := router.Group("/teams")
	{
		// Team management routes
		teamRoutes.POST("/", controllers.CreateTeam)
		teamRoutes.GET("/:id", controllers.GetTeam)
		teamRoutes.POST("/:id/join", controllers.JoinTeam)
		teamRoutes.POST("/:id/leave", controllers.LeaveTeam)
		teamRoutes.DELETE("/:teamId", controllers.DeleteTeam)
		teamRoutes.DELETE("/:teamId/members/:memberId", controllers.RemoveMember)
		teamRoutes.PUT("/:teamId/name", controllers.UpdateTeamName)
		teamRoutes.PUT("/:teamId/size", controllers.UpdateTeamSize)
		teamRoutes.GET("/code/:code", controllers.GetTeamByCode)
		teamRoutes.GET("/members/:memberId", controllers.GetTeamMemberProfile)
		teamRoutes.GET("/user/teams", controllers.GetUserTeams)
		teamRoutes.GET("/available", controllers.GetAvailableTeams)
	}
}

// SetupTeamDebateRoutes sets up team debate-related routes
func SetupTeamDebateRoutes(router *gin.RouterGroup) {
	teamDebateRoutes := router.Group("/team-debates")
	{
		teamDebateRoutes.POST("/", controllers.CreateTeamDebate)
		teamDebateRoutes.GET("/:id", controllers.GetTeamDebate)
		teamDebateRoutes.GET("/team/:teamId/active", controllers.GetActiveTeamDebate)
	}
}

// SetupTeamMatchmakingRoutes sets up team matchmaking routes
func SetupTeamMatchmakingRoutes(router *gin.RouterGroup) {
	matchmakingRoutes := router.Group("/matchmaking")
	{
		matchmakingRoutes.POST("/:teamId/join", controllers.JoinMatchmaking)
		matchmakingRoutes.DELETE("/:teamId/leave", controllers.LeaveMatchmaking)
		matchmakingRoutes.GET("/:teamId/status", controllers.GetMatchmakingStatus)
		matchmakingRoutes.GET("/pool", controllers.GetMatchmakingPool)
	}
}

// SetupTeamChatRoutes sets up team chat-related routes
func SetupTeamChatRoutes(router *gin.RouterGroup) {
	// Team chat functionality can be added later if needed
}

