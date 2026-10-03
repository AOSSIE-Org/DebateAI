package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func GoogleLoginRouteHandler(c *gin.Context) {
	controllers.GoogleLogin(c)
}

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

func GetMatchmakingPoolStatusHandler(c *gin.Context) {
	if c.GetBool("isAdmin") || c.GetBool("debugMode") {
		controllers.GetMatchmakingPoolStatus(c)
		return
	}
	c.JSON(403, gin.H{"error": "forbidden"})
}

func ResendVerificationRouteHandler(c *gin.Context) {
	controllers.ResendVerification(c)
}
