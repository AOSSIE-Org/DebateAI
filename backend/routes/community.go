package routes

import (
	"arguehub/controllers"

	"github.com/gin-gonic/gin"
)

func SetupCommunityRoutes(router *gin.RouterGroup) {
	// Post routes (specific routes must come before parameterized routes)
	router.POST("/posts", controllers.CreatePostHandler)
	router.GET("/posts/feed", controllers.GetFeedHandler)
	router.GET("/posts/top/likes", controllers.GetTopLikedPostsHandler)

	// Like routes (must come before /posts/:id to avoid route conflict)
	router.POST("/posts/:id/like", controllers.ToggleLikeHandler)
	router.GET("/posts/:id/likes", controllers.GetLikesHandler)

	// Post routes with :id (must come after more specific routes)
	router.GET("/posts/:id", controllers.GetPostHandler)
	router.DELETE("/posts/:id", controllers.DeletePostHandler)

	// Comment routes
	router.POST("/comments", controllers.CreateCommentHandler)
	router.GET("/comments/:transcriptId", controllers.GetCommentsHandler)
	router.DELETE("/comments/:id", controllers.DeleteCommentHandler)

	// Follow routes
	router.POST("/users/:userId/follow", controllers.FollowUserHandler)
	router.DELETE("/users/:userId/follow", controllers.UnfollowUserHandler)
	router.GET("/users/:userId/followers", controllers.GetFollowersHandler)
	router.GET("/users/:userId/following", controllers.GetFollowingHandler)
}
