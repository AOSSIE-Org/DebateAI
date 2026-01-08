package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func GetNotificationsRouteHandler(c *gin.Context) {
	controllers.GetNotificationsHandler(c)
}

func MarkNotificationAsReadRouteHandler(c *gin.Context) {
	controllers.MarkNotificationAsReadHandler(c)
}

func MarkAllNotificationsAsReadRouteHandler(c *gin.Context) {
	controllers.MarkAllNotificationsAsReadHandler(c)
}

func DeleteNotificationRouteHandler(c *gin.Context) {
	controllers.DeleteNotificationHandler(c)
}
