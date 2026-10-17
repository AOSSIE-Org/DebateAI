package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func SetupRubricJudgeRoutes(router *gin.RouterGroup) {
	router.POST("/debate/judge/rubric", controllers.JudgeDebateWithRubric)
}
