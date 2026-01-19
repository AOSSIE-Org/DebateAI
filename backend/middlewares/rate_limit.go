package middlewares

import (
	"arguehub/db"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// rateLimitScript is a Lua script that increments a key and sets an expiration if it's the first time
const rateLimitScript = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
`

// RateLimit implements a simple fixed-window rate limiter using Redis
func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if db.RedisClient == nil {
			// If Redis is not available, skip rate limiting but log a warning
			log.Printf("WARNING: Redis unavailable, skipping rate limiting for path: %s", c.Request.URL.Path)
			c.Next()
			return
		}

		ip := c.ClientIP()
		// Use path and IP for the key to rate limit per endpoint per IP
		key := fmt.Sprintf("rl:%s:%s", c.Request.URL.Path, ip)

		ctx := c.Request.Context()

		// Run Lua script for atomic INCR and EXPIRE
		result, err := db.RedisClient.Eval(ctx, rateLimitScript, []string{key}, int(window.Seconds())).Result()
		if err != nil {
			// Hub: Log the error and fail open
			log.Printf("ERROR: Redis rate limit evaluation failed for path %s: %v", c.Request.URL.Path, err)
			c.Next()
			return
		}

		count := result.(int64)
		if count > int64(limit) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded. Please try again later.",
			})
			return
		}

		c.Next()
	}
}
