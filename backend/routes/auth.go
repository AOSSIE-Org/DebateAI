package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func SignUpRouteHandler(ctx *gin.Context) {
	controllers.SignUp(ctx)
}

func VerifyEmailRouteHandler(ctx *gin.Context) {
	controllers.VerifyEmail(ctx)
}

func LoginRouteHandler(ctx *gin.Context) {
	controllers.Login(ctx)
}

func ForgotPasswordRouteHandler(ctx *gin.Context) {
	controllers.ForgotPassword(ctx)
}

func VerifyForgotPasswordRouteHandler(ctx *gin.Context) {
	controllers.VerifyForgotPassword(ctx)
}

func VerifyTokenRouteHandler(ctx *gin.Context) {
	controllers.VerifyToken(ctx)
}