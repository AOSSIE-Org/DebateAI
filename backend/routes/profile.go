package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func GetProfileRouteHandler(ctx *gin.Context) {
	controllers.GetProfile(ctx)
}

func UpdateProfileRouteHandler(ctx *gin.Context) {
	controllers.UpdateProfile(ctx)
}


func CheckDisplayNameRouteHandler(ctx *gin.Context) {
	controllers.CheckDisplayName(ctx)
}

func UpdateEloAfterDebateRouteHandler(ctx *gin.Context) {
	controllers.UpdateEloAfterDebate(ctx)
}