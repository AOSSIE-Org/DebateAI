package db

import (
	"testing"

	"github.com/redis/go-redis/v9"
)

func TestConnectRedis_InvalidAddress(t *testing.T) {
	// Ensure pre-state is clean
	RedisClient = nil

	// Connecting to an invalid/unreachable address should fail and leave RedisClient nil
	err := ConnectRedis("127.0.0.1:99999", "", 0)
	if err == nil {
		t.Fatal("expected error when connecting to unreachable Redis, got nil")
	}

	if RedisClient != nil {
		t.Errorf("expected RedisClient to be nil after failed connection, got %v", RedisClient)
	}
}

func TestSetAndGetRedisClient(t *testing.T) {
	orig := RedisClient
	defer func() { RedisClient = orig }()

	dummy := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
	SetRedisClient(dummy)

	if GetRedisClient() != dummy {
		t.Errorf("expected GetRedisClient() to return %v, got %v", dummy, GetRedisClient())
	}

	SetRedisClient(nil)
	if GetRedisClient() != nil {
		t.Errorf("expected GetRedisClient() to return nil, got %v", GetRedisClient())
	}
}
