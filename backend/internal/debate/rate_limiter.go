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
	return &RateLimiter{
		rdb: GetRedisClient(),
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

// CheckQuestionRateLimit checks if spectator can ask a question
func (rl *RateLimiter) CheckQuestionRateLimit(debateID, spectatorHash string, config RateLimitConfig) (bool, error) {
	if rl == nil || rl.rdb == nil {
		return false, fmt.Errorf("Redis client not available")
	}

	key := fmt.Sprintf("rate:question:%s:%s", debateID, spectatorHash)

	// Check current count
	count, err := rl.rdb.Get(rl.ctx, key).Int()
	if err == redis.Nil {
		// First question, allow it
		return true, nil
	} else if err != nil {
		return false, err
	}

	if count >= config.MaxQuestions {
		return false, nil
	}

	return true, nil
}

// RecordQuestion records a question for rate limiting
func (rl *RateLimiter) RecordQuestion(debateID, spectatorHash string, config RateLimitConfig) error {
	if rl == nil || rl.rdb == nil {
		return fmt.Errorf("Redis client not available")
	}

	key := fmt.Sprintf("rate:question:%s:%s", debateID, spectatorHash)

	// Increment count
	count, err := rl.rdb.Incr(rl.ctx, key).Result()
	if err != nil {
		return err
	}

	// Set expiration if first time
	if count == 1 {
		rl.rdb.Expire(rl.ctx, key, config.QuestionWindow)
	}

	return nil
}

// CheckReactionRateLimit checks if spectator can send a reaction
func (rl *RateLimiter) CheckReactionRateLimit(debateID, spectatorHash string, config RateLimitConfig) (bool, error) {
	if rl == nil || rl.rdb == nil {
		return false, fmt.Errorf("Redis client not available")
	}

	key := fmt.Sprintf("rate:reaction:%s:%s", debateID, spectatorHash)

	// Check current count
	count, err := rl.rdb.Get(rl.ctx, key).Int()
	if err == redis.Nil {
		// First reaction, allow it
		return true, nil
	} else if err != nil {
		return false, err
	}

	if count >= config.MaxReactions {
		return false, nil
	}

	return true, nil
}

// RecordReaction records a reaction for rate limiting
func (rl *RateLimiter) RecordReaction(debateID, spectatorHash string, config RateLimitConfig) error {
	if rl == nil || rl.rdb == nil {
		return fmt.Errorf("Redis client not available")
	}

	key := fmt.Sprintf("rate:reaction:%s:%s", debateID, spectatorHash)

	// Increment count
	count, err := rl.rdb.Incr(rl.ctx, key).Result()
	if err != nil {
		return err
	}

	// Set expiration if first time
	if count == 1 {
		rl.rdb.Expire(rl.ctx, key, config.ReactionWindow)
	}

	return nil
}
