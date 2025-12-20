package debate

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

var (
	rdb *redis.Client
	ctx = context.Background()
)

// InitRedis initializes Redis client
func InitRedis(redisURL string, password string, db int) error {
	opt := &redis.Options{
		Addr:     redisURL,
		Password: password,
		DB:       db,
	}

	rdb = redis.NewClient(opt)

	// Test connection
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return nil
}

// GetRedisClient returns the Redis client instance
func GetRedisClient() *redis.Client {
	return rdb
}

// GetContext returns the default context
func GetContext() context.Context {
	return ctx
}
