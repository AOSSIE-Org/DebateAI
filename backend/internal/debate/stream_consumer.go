package debate

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

// DebateHub interface for broadcasting events
type DebateHub interface {
	BroadcastToDebate(debateID string, event *Event)
}

// StreamConsumer handles Redis Stream consumer group operations
type StreamConsumer struct {
	rdb          *redis.Client
	ctx          context.Context
	consumerName string
	instanceID   string
	hub          DebateHub
}

// NewStreamConsumer creates a new StreamConsumer instance
func NewStreamConsumer(hub DebateHub) *StreamConsumer {
	rdb := GetRedisClient()
	if rdb == nil {
		return nil
	}

	hostname, _ := os.Hostname()
	pid := os.Getpid()
	instanceID := fmt.Sprintf("%s-%d", hostname, pid)
	consumerName := fmt.Sprintf("consumer-%s", instanceID)

	return &StreamConsumer{
		rdb:          rdb,
		ctx:          GetContext(),
		consumerName: consumerName,
		instanceID:   instanceID,
		hub:          hub,
	}
}

// StartConsumerGroup starts consuming from Redis Stream for a debate
func (sc *StreamConsumer) StartConsumerGroup(debateID string) error {
	if sc == nil || sc.rdb == nil {
		return fmt.Errorf("Redis client not available")
	}

	streamKey := fmt.Sprintf("debate:%s:events", debateID)
	groupName := fmt.Sprintf("debate:%s:group", debateID)

	// Create consumer group if it doesn't exist
	err := sc.rdb.XGroupCreateMkStream(sc.ctx, streamKey, groupName, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		// Continue anyway, group might already exist
	}

	// Start consuming in a goroutine
	go sc.consumeLoop(debateID, streamKey, groupName)

	return nil
}

// consumeLoop continuously reads from the stream and forwards to WebSocket clients
func (sc *StreamConsumer) consumeLoop(debateID, streamKey, groupName string) {

	for {
		// Read from stream with consumer group
		streams, err := sc.rdb.XReadGroup(sc.ctx, &redis.XReadGroupArgs{
			Group:    groupName,
			Consumer: sc.consumerName,
			Streams:  []string{streamKey, ">"},
			Count:    100,
			Block:    time.Second,
		}).Result()

		if err != nil {
			if err == redis.Nil {
				// No messages, continue
				continue
			}
			time.Sleep(time.Second)
			continue
		}

		// Process messages
		for _, stream := range streams {
			for _, message := range stream.Messages {
				// Process message
				if err := sc.processMessage(debateID, message); err != nil {
					continue
				}

				// ACK message after successful processing
				if err := sc.rdb.XAck(sc.ctx, streamKey, groupName, message.ID).Err(); err != nil {
				}
			}
		}

		// Handle pending messages (reclaim stalled messages)
		go sc.reclaimPendingMessages(debateID, streamKey, groupName)
	}
}

// processMessage processes a stream message and forwards to WebSocket clients
func (sc *StreamConsumer) processMessage(debateID string, message redis.XMessage) error {
	// Extract event data from message
	eventData, ok := message.Values["data"].(string)
	if !ok {
		return fmt.Errorf("invalid message format: missing data field")
	}

	// Unmarshal event
	event, err := UnmarshalEvent(eventData)
	if err != nil {
		return fmt.Errorf("failed to unmarshal event: %w", err)
	}

	// Forward event to all connected WebSocket clients for this debate
	// The BroadcastToDebate method will format it correctly
	sc.hub.BroadcastToDebate(debateID, event)

	return nil
}

// reclaimPendingMessages reclaims pending messages that haven't been ACKed
func (sc *StreamConsumer) reclaimPendingMessages(debateID, streamKey, groupName string) {
	// Check for pending messages older than 30 seconds
	pending, err := sc.rdb.XPendingExt(sc.ctx, &redis.XPendingExtArgs{
		Stream: streamKey,
		Group:  groupName,
		Start:  "-",
		End:    "+",
		Count:  100,
	}).Result()

	if err != nil {
		return
	}

	for _, p := range pending {
		// If message is pending for more than 30 seconds, claim it
		// p.Idle is already a time.Duration representing idle time
		if p.Idle > 30*time.Second {
			claimed, err := sc.rdb.XClaim(sc.ctx, &redis.XClaimArgs{
				Stream:   streamKey,
				Group:    groupName,
				Consumer: sc.consumerName,
				MinIdle:  30 * time.Second,
				Messages: []string{p.ID},
			}).Result()

			if err == nil && len(claimed) > 0 {
				// Process reclaimed message
				for _, msg := range claimed {
					sc.processMessage(debateID, msg)
					sc.rdb.XAck(sc.ctx, streamKey, groupName, msg.ID)
				}
			}
		}
	}
}

// PublishEvent publishes an event to the Redis Stream
func PublishEvent(debateID string, event *Event) error {
	rdb := GetRedisClient()
	if rdb == nil {
		return fmt.Errorf("Redis client not available")
	}
	ctx := GetContext()

	streamKey := fmt.Sprintf("debate:%s:events", debateID)

	// Marshal event to JSON
	eventData, err := MarshalEvent(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Add to stream with MAXLEN to bound history
	_, err = rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: streamKey,
		Values: map[string]interface{}{
			"data": eventData,
		},
		MaxLen: 10000,
		Approx: true, // Use ~ for approximate trimming
	}).Result()

	if err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}

	return nil
}
