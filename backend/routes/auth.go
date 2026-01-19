package routes

import (
	"arguehub/controllers"
	"arguehub/middlewares"
	"time"

	"github.com/gin-gonic/gin"
)

func GoogleLoginRouteHandler(c *gin.Context) {
	controllers.GoogleLogin(c)
}

func SignUpRouteHandler(c *gin.Context) {
	// Apply rate limiting: 5 requests per minute
	middlewares.RateLimit(5, time.Minute)(c)
	if c.IsAborted() {
		return
	}
	controllers.SignUp(c)
}

func VerifyEmailRouteHandler(c *gin.Context) {
	controllers.VerifyEmail(c)
}

func LoginRouteHandler(c *gin.Context) {
	// Apply rate limiting: 10 requests per minute
	middlewares.RateLimit(10, time.Minute)(c)
	if c.IsAborted() {
		return
	}
	controllers.Login(c)
}

func ForgotPasswordRouteHandler(c *gin.Context) {
	// Apply rate limiting: 3 requests per minute
	middlewares.RateLimit(3, time.Minute)(c)
	if c.IsAborted() {
		return
	}
	controllers.ForgotPassword(c)
}

func VerifyForgotPasswordRouteHandler(c *gin.Context) {
	controllers.VerifyForgotPassword(c)
}

func EnableMFARouteHandler(c *gin.Context) {
	controllers.EnableMFA(c)
}

func FinalizeEnableMFARouteHandler(c *gin.Context) {
	controllers.FinalizeEnableMFA(c)
}

func VerifyTOTPRouteHandler(c *gin.Context) {
	// Apply rate limiting: 3 requests per minute (stricter than login)
	middlewares.RateLimit(3, time.Minute)(c)
	if c.IsAborted() {
		return
	}
	controllers.VerifyTOTP(c)
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
