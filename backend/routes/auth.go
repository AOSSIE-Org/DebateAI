package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func SignUpRouteHandler(c *gin.Context) {
	controllers.SignUp(c)
}

func VerifyEmailRouteHandler(c *gin.Context) {
	controllers.VerifyEmail(c)
}

func LoginRouteHandler(c *gin.Context) {
	controllers.Login(c)
}

func ForgotPasswordRouteHandler(c *gin.Context) {
	controllers.ForgotPassword(c)
}

func VerifyForgotPasswordRouteHandler(c *gin.Context) {
	controllers.VerifyForgotPassword(c)
}

func VerifyTokenRouteHandler(c *gin.Context) {
	controllers.VerifyToken(c)
}
