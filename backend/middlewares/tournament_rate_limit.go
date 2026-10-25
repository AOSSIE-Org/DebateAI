package middlewares

import (
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"sync"
	"time"
)

type tournamentAttemptWindow struct {
	count int
	until time.Time
}

// Bound invite probing independently of Redis; each server instance has its own window.
func TournamentInviteRateLimit() gin.HandlerFunc {
	var lock sync.Mutex
	windows := make(map[string]tournamentAttemptWindow)
	return func(c *gin.Context) {
		raw, _ := c.Get("userID")
		id, ok := raw.(primitive.ObjectID)
		if !ok || id.IsZero() {
			c.AbortWithStatusJSON(401, gin.H{"error": "Invalid user session"})
			return
		}
		now := time.Now()
		keys := []string{"user:" + id.Hex(), "ip:" + c.ClientIP()}
		limits := []int{10, 30}
		allowed := true
		lock.Lock()
		for key, window := range windows {
			if !now.Before(window.until) {
				delete(windows, key)
			}
		}
		for index, key := range keys {
			window := windows[key]
			if window.count >= limits[index] || (window.count == 0 && len(windows) >= 4096) {
				allowed = false
				break
			}
		}
		if allowed {
			for _, key := range keys {
				window := windows[key]
				if window.count == 0 {
					window.until = now.Add(time.Minute)
				}
				window.count++
				windows[key] = window
			}
		}
		lock.Unlock()
		if !allowed {
			c.Header("Retry-After", "60")
			c.AbortWithStatusJSON(429, gin.H{"error": "Too many invite attempts; retry later", "code": "rate_limited"})
			return
		}
		c.Next()
	}
}
