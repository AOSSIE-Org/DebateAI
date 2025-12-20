package routes

import (
	"arguehub/controllers"
	"arguehub/middlewares"

	"github.com/gin-gonic/gin"
)

// SetupAdminRoutes sets up admin routes
func SetupAdminRoutes(router *gin.Engine, configPath string) {
	// Public admin routes (login only - signup disabled, admins added manually to DB)
	adminPublic := router.Group("/admin")
	{
		adminPublic.POST("/login", controllers.AdminLogin)
	}

	// Protected admin routes
	admin := router.Group("/admin")
	admin.Use(middlewares.AdminAuthMiddleware(configPath))
	{
		// Analytics
		admin.GET("/analytics", controllers.GetAnalytics)
		admin.GET("/analytics/history", controllers.GetAnalyticsHistory)
		
		// Debates management
		admin.GET("/debates", controllers.GetDebates)
		admin.DELETE("/debates/:id", middlewares.RBACMiddleware("debate", "delete"), controllers.DeleteDebate)
		admin.DELETE("/debates/bulk", middlewares.RBACMiddleware("debate", "delete"), controllers.BulkDeleteDebates)
		
		// Comments management (admin and moderator can delete)
		admin.GET("/comments", controllers.GetComments)
		admin.DELETE("/comments/:id", middlewares.RBACMiddleware("comment", "delete"), controllers.DeleteComment)
		admin.DELETE("/comments/bulk", middlewares.RBACMiddleware("comment", "delete"), controllers.BulkDeleteComments)
		
		// Admin action logs
		admin.GET("/logs", controllers.GetAdminActionLogs)
	}
}

