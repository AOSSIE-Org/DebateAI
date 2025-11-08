package debate

import (
	"context"
	"fmt"
	"strings"

	"github.com/redis/go-redis/v9"
)

// PollStore handles poll state operations in Redis
type PollStore struct {
	rdb *redis.Client
	ctx context.Context
}

// NewPollStore creates a new PollStore instance
func NewPollStore() *PollStore {
	return &PollStore{
		rdb: GetRedisClient(),
		ctx: GetContext(),
	}
}

// Vote handles a vote request and returns whether it was successful
func (ps *PollStore) Vote(debateID, pollID, option, spectatorHash string) (bool, error) {
	if ps == nil || ps.rdb == nil {
		return false, fmt.Errorf("Redis client not available")
	}

	votersKey := fmt.Sprintf("debate:%s:poll:%s:voters", debateID, pollID)
	countsKey := fmt.Sprintf("debate:%s:poll:%s:counts", debateID, pollID)

	// Check if spectator already voted (using SET)
	added, err := ps.rdb.SAdd(ps.ctx, votersKey, spectatorHash).Result()
	if err != nil {
		return false, fmt.Errorf("failed to add voter: %w", err)
	}

	if added == 0 {
		// Duplicate vote
		return false, nil
	}

	// Increment poll count atomically
	if err := ps.rdb.HIncrBy(ps.ctx, countsKey, option, 1).Err(); err != nil {
		// Rollback voter add
		ps.rdb.SRem(ps.ctx, votersKey, spectatorHash)
		return false, fmt.Errorf("failed to increment count: %w", err)
	}

	return true, nil
}

// GetPollState returns the current poll state for all polls in a debate
func (ps *PollStore) GetPollState(debateID string) (map[string]map[string]int64, map[string]int64, error) {
	if ps == nil || ps.rdb == nil {
		return nil, nil, fmt.Errorf("Redis client not available")
	}

	// Get all poll keys for this debate
	pattern := fmt.Sprintf("debate:%s:poll:*:counts", debateID)
	keys, err := ps.rdb.Keys(ps.ctx, pattern).Result()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get poll keys: %w", err)
	}

	pollState := make(map[string]map[string]int64)
	votersCount := make(map[string]int64)

	for _, countsKey := range keys {
		// Extract pollID from key: debate:{debateID}:poll:{pollID}:counts
		// Key format: debate:{debateID}:poll:{pollID}:counts
		prefix := fmt.Sprintf("debate:%s:poll:", debateID)
		suffix := ":counts"
		if !strings.HasPrefix(countsKey, prefix) || !strings.HasSuffix(countsKey, suffix) {
			continue
		}
		// Extract pollID: remove prefix and suffix
		pollID := countsKey[len(prefix) : len(countsKey)-len(suffix)]
		if pollID == "" {
			continue
		}

		// Get counts
		counts, err := ps.rdb.HGetAll(ps.ctx, countsKey).Result()
		if err != nil {
			continue
		}

		pollState[pollID] = make(map[string]int64)
		for option, countStr := range counts {
			var count int64
			if _, err := fmt.Sscanf(countStr, "%d", &count); err == nil {
				pollState[pollID][option] = count
			}
		}

		// Get voter count
		votersKey := fmt.Sprintf("debate:%s:poll:%s:voters", debateID, pollID)
		voterCount, _ := ps.rdb.SCard(ps.ctx, votersKey).Result()
		votersCount[pollID] = voterCount
	}

	return pollState, votersCount, nil
}

// HasVoted checks if a spectator has already voted
func (ps *PollStore) HasVoted(debateID, pollID, spectatorHash string) (bool, error) {
	if ps == nil || ps.rdb == nil {
		return false, fmt.Errorf("Redis client not available")
	}

	votersKey := fmt.Sprintf("debate:%s:poll:%s:voters", debateID, pollID)
	exists, err := ps.rdb.SIsMember(ps.ctx, votersKey, spectatorHash).Result()
	if err != nil {
		return false, err
	}
	return exists, nil
}
