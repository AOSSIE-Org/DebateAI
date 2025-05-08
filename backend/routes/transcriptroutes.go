package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func SetupTranscriptRoutes(router *gin.RouterGroup) {
	router.POST("/api/submit-transcripts", controllers.SubmitTranscripts)
}
