package debate

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimiter handles rate limiting for spectator actions
type RateLimiter struct {
	rdb *redis.Client
	ctx context.Context
}

// NewRateLimiter creates a new RateLimiter instance
func NewRateLimiter() *RateLimiter {
	return NewRateLimiterWithClient(GetRedisClient())
}

// NewRateLimiterWithClient creates a RateLimiter that uses the given client.
func NewRateLimiterWithClient(rdb *redis.Client) *RateLimiter {
	return &RateLimiter{
		rdb: rdb,
		ctx: GetContext(),
	}
}

// RateLimitConfig defines rate limit rules
type RateLimitConfig struct {
	MaxVotes       int           // per poll
	MaxQuestions   int           // per duration
	MaxReactions   int           // per duration
	QuestionWindow time.Duration // time window for questions
	ReactionWindow time.Duration // time window for reactions
}

// DefaultRateLimitConfig returns default rate limit configuration
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		MaxVotes:       1,
		MaxQuestions:   1,
		MaxReactions:   5,
		QuestionWindow: 15 * time.Second,
		ReactionWindow: 10 * time.Second,
	}
}

// allowOnce increments the counter and sets its expiry in one atomic step, so
// two concurrent callers cannot both pass the limit check before recording.
var allowOnce = redis.NewScript(`
local count = redis.call("INCR", KEYS[1])
if count == 1 then
	redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return count
`)

// CheckVoteRateLimit checks if spectator can vote (1 vote per poll)
func (rl *RateLimiter) CheckVoteRateLimit(debateID, pollID, spectatorHash string) (bool, error) {
	// This is handled by the voter SET in poll_store.go
	// Return true if not already voted
	store := NewPollStore()
	hasVoted, err := store.HasVoted(debateID, pollID, spectatorHash)
	if err != nil {
		return false, err
	}
	return !hasVoted, nil
}

// AllowQuestion records a question and reports whether it is within the limit.
func (rl *RateLimiter) AllowQuestion(debateID, spectatorHash string, config RateLimitConfig) (bool, error) {
	key := fmt.Sprintf("rate:question:%s:%s", debateID, spectatorHash)
	return rl.allow(key, config.MaxQuestions, config.QuestionWindow)
}

// AllowReaction records a reaction and reports whether it is within the limit.
func (rl *RateLimiter) AllowReaction(debateID, spectatorHash string, config RateLimitConfig) (bool, error) {
	key := fmt.Sprintf("rate:reaction:%s:%s", debateID, spectatorHash)
	return rl.allow(key, config.MaxReactions, config.ReactionWindow)
}

func (rl *RateLimiter) allow(key string, max int, window time.Duration) (bool, error) {
	if rl == nil || rl.rdb == nil {
		return false, fmt.Errorf("Redis client not available")
	}

	count, err := allowOnce.Run(rl.ctx, rl.rdb, []string{key}, window.Milliseconds()).Int64()
	if err != nil {
		return false, err
	}

	return count <= int64(max), nil
}
