package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func SetupTranscriptRoutes(router *gin.RouterGroup) {
	// Add a test endpoint to verify routes are working
	router.GET("/transcripts/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "Transcript routes are working!"})
	})

	router.POST("/submit-transcripts", controllers.SubmitTranscripts)
	router.POST("/save-transcript", controllers.SaveDebateTranscriptHandler)
	router.GET("/debates/:id/analytics", controllers.GetDebateAnalytics)
	router.GET("/users/:id/analytics", controllers.GetUserAnalytics)
	router.GET("/debate-stats", controllers.GetDebateStatsHandler)
	router.POST("/create-test-transcript", controllers.CreateTestTranscriptHandler)
	router.POST("/create-test-bot-debate", controllers.CreateTestBotDebateHandler)

	// Transcript CRUD operations
	router.GET("/transcripts", controllers.GetUserTranscriptsHandler)
	router.GET("/transcript/:id", controllers.GetTranscriptByIDHandler)
	router.DELETE("/transcript/:id", controllers.DeleteTranscriptHandler)

	// Utility endpoint to clean up pending transcripts
	router.POST("/update-pending-transcripts", controllers.UpdatePendingTranscriptsHandler)

	// Update specific transcript result
	router.PUT("/transcript/:id/result", controllers.UpdateTranscriptResultHandler)
}
