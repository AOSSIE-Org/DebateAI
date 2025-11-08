package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func GetLeaderboardRouteHandler(c *gin.Context) {
	controllers.GetLeaderboard(c)
}
