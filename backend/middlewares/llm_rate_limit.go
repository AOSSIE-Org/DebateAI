package middlewares

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"arguehub/internal/debate"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const llmRateLimitScript = `
local redisTime = redis.call("TIME")
local now = (tonumber(redisTime[1]) * 1000) + math.floor(tonumber(redisTime[2]) / 1000)
local window = tonumber(ARGV[1])
local max = tonumber(ARGV[2])
local member = ARGV[3]
local cutoff = now - window

redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", cutoff)
local count = redis.call("ZCARD", KEYS[1])

if count >= max then
    local oldest = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
    local retryAfter = math.ceil((tonumber(oldest[2]) + window - now) / 1000)
    if retryAfter < 1 then
        retryAfter = 1
    end
    return {0, retryAfter}
end

redis.call("ZADD", KEYS[1], now, member)
redis.call("EXPIRE", KEYS[1], math.ceil(window / 1000))
return {1, 0}
`

// LLMRateLimit returns middleware that limits expensive AI requests per user.
// It must be registered after AuthMiddleware so userID is available in Gin's context.
func LLMRateLimit(maxRequests int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if maxRequests <= 0 || window <= 0 {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "LLM rate limit is misconfigured"})
			c.Abort()
			return
		}

		client := debate.GetRedisClient()
		if client == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI request protection is unavailable"})
			c.Abort()
			return
		}

		key := llmRateLimitKey(c)
		result, err := client.Eval(
			c.Request.Context(),
			llmRateLimitScript,
			[]string{key},
			window.Milliseconds(),
			maxRequests,
			fmt.Sprintf("%d-%s", time.Now().UnixNano(), uuid.NewString()),
		).Result()
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI request protection is unavailable"})
			c.Abort()
			return
		}

		allowed, retryAfter, ok := parseLLMRateLimitResult(result)
		if !ok {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI request protection returned an invalid result"})
			c.Abort()
			return
		}
		if !allowed {
			c.Header("Retry-After", strconv.FormatInt(retryAfter, 10))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":             "Too many AI requests",
				"retryAfterSeconds": retryAfter,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func llmRateLimitKey(c *gin.Context) string {
	if userID, exists := c.Get("userID"); exists {
		if userID != nil {
			userIDString := fmt.Sprint(userID)
			if userIDString != "" && userIDString != "<nil>" {
				return "rate:llm:user:" + userIDString
			}
		}
	}

	return "rate:llm:ip:" + c.ClientIP()
}

func parseLLMRateLimitResult(result interface{}) (bool, int64, bool) {
	values, ok := result.([]interface{})
	if !ok || len(values) != 2 {
		return false, 0, false
	}

	allowed, ok := redisResultInt(values[0])
	if !ok {
		return false, 0, false
	}
	retryAfter, ok := redisResultInt(values[1])
	if !ok {
		return false, 0, false
	}

	return allowed == 1, retryAfter, true
}

func redisResultInt(value interface{}) (int64, bool) {
	switch number := value.(type) {
	case int64:
		return number, true
	case int:
		return int64(number), true
	case float64:
		return int64(number), true
	case []byte:
		parsed, err := strconv.ParseInt(string(number), 10, 64)
		return parsed, err == nil
	case string:
		parsed, err := strconv.ParseInt(number, 10, 64)
		return parsed, err == nil
	default:
		return 0, false
	}
}
