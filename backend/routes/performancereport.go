package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

// SetupPerformanceReportRoutes registers routes for debate performance reports
func SetupPerformanceReportRoutes(router *gin.RouterGroup) {
	router.POST("/debate/performance-report", controllers.GeneratePerformanceReportHandler)
	router.GET("/debate/:id/performance-report", controllers.GetPerformanceReportByIDHandler)
}
