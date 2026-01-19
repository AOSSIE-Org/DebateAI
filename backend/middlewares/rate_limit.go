package middlewares

import (
	"arguehub/db"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimit implements a simple fixed-window rate limiter using Redis
func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if db.RedisClient == nil {
			// If Redis is not available, skip rate limiting but log a warning
			c.Next()
			return
		}

		ip := c.ClientIP()
		// Use path and IP for the key to rate limit per endpoint per IP
		key := fmt.Sprintf("rl:%s:%s", c.Request.URL.Path, ip)

		ctx := c.Request.Context()
		count, err := db.RedisClient.Incr(ctx, key).Result()
		if err != nil {
			// Fail open if Redis has issues
			c.Next()
			return
		}

		if count == 1 {
			db.RedisClient.Expire(ctx, key, window)
		}

		if count > int64(limit) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded. Please try again later.",
			})
			return
		}

		c.Next()
	}
}
