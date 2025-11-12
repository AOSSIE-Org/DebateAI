package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func AwardBadgeRouteHandler(c *gin.Context) {
	controllers.AwardBadge(c)
}

func UpdateScoreRouteHandler(c *gin.Context) {
	controllers.UpdateScore(c)
}

func GetGamificationLeaderboardRouteHandler(c *gin.Context) {
	controllers.GetGamificationLeaderboard(c)
}

