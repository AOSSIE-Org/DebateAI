package services

import (
	"context"
	"sync"
	"time"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// TokenBucketService manages fair speech time distribution using token bucket algorithm
type TokenBucketService struct {
	buckets map[string]*TokenBucket
	mutex   sync.RWMutex
}

// TokenBucket represents a token bucket for a team member
type TokenBucket struct {
	Capacity   int          // Maximum tokens
	Tokens     int          // Current tokens
	RefillRate int          // Tokens per second
	LastRefill time.Time    // Last time tokens were refilled
	Mutex      sync.RWMutex // Mutex for thread safety
}

// NewTokenBucketService creates a new token bucket service
func NewTokenBucketService() *TokenBucketService {
	return &TokenBucketService{
		buckets: make(map[string]*TokenBucket),
	}
}

// InitializeTeamBuckets initializes token buckets for all team members
func (tbs *TokenBucketService) InitializeTeamBuckets(teamID primitive.ObjectID) error {
	// Get team members
	collection := db.GetCollection("teams")
	var team models.Team
	err := collection.FindOne(context.Background(), bson.M{"_id": teamID}).Decode(&team)
	if err != nil {
		return err
	}

	tbs.mutex.Lock()
	defer tbs.mutex.Unlock()

	// Initialize bucket for each team member
	for _, member := range team.Members {
		bucketKey := tbs.getBucketKey(teamID, member.UserID)
		tbs.buckets[bucketKey] = &TokenBucket{
			Capacity:   10, // 10 tokens = 10 seconds of speaking time
			Tokens:     10, // Start with full bucket
			RefillRate: 1,  // 1 token per second
			LastRefill: time.Now(),
		}
	}

	return nil
}

// ConsumeToken attempts to consume a token from a team member's bucket
func (tbs *TokenBucketService) ConsumeToken(teamID, userID primitive.ObjectID) (bool, int) {
	bucketKey := tbs.getBucketKey(teamID, userID)

	tbs.mutex.RLock()
	bucket, exists := tbs.buckets[bucketKey]
	tbs.mutex.RUnlock()

	if !exists {
		return false, 0
	}

	bucket.Mutex.Lock()
	defer bucket.Mutex.Unlock()

	// Refill tokens based on time elapsed
	tbs.refillTokens(bucket)

	if bucket.Tokens > 0 {
		bucket.Tokens--
		return true, bucket.Tokens
	}

	return false, bucket.Tokens
}

// GetRemainingTokens returns the number of remaining tokens for a team member
func (tbs *TokenBucketService) GetRemainingTokens(teamID, userID primitive.ObjectID) int {
	bucketKey := tbs.getBucketKey(teamID, userID)

	tbs.mutex.RLock()
	bucket, exists := tbs.buckets[bucketKey]
	tbs.mutex.RUnlock()

	if !exists {
		return 0
	}

	bucket.Mutex.RLock()
	defer bucket.Mutex.RUnlock()

	// Refill tokens based on time elapsed
	tbs.refillTokens(bucket)

	return bucket.Tokens
}

// RefillTokens refills tokens based on time elapsed
func (tbs *TokenBucketService) refillTokens(bucket *TokenBucket) {
	now := time.Now()
	timeElapsed := now.Sub(bucket.LastRefill)
	tokensToAdd := int(timeElapsed.Seconds()) * bucket.RefillRate

	if tokensToAdd > 0 {
		bucket.Tokens += tokensToAdd
		if bucket.Tokens > bucket.Capacity {
			bucket.Tokens = bucket.Capacity
		}
		bucket.LastRefill = now
	}
}

// GetBucketKey generates a unique key for a team member's bucket
func (tbs *TokenBucketService) getBucketKey(teamID, userID primitive.ObjectID) string {
	return teamID.Hex() + ":" + userID.Hex()
}

// GetTeamTurnManager manages turns within a team
type TeamTurnManager struct {
	currentTurn map[string]primitive.ObjectID   // teamID -> current userID
	turnOrder   map[string][]primitive.ObjectID // teamID -> ordered list of userIDs
	mutex       sync.RWMutex
}

// NewTeamTurnManager creates a new team turn manager
func NewTeamTurnManager() *TeamTurnManager {
	return &TeamTurnManager{
		currentTurn: make(map[string]primitive.ObjectID),
		turnOrder:   make(map[string][]primitive.ObjectID),
	}
}

// InitializeTeamTurns initializes turn order for a team
func (ttm *TeamTurnManager) InitializeTeamTurns(teamID primitive.ObjectID) error {
	// Get team members
	collection := db.GetCollection("teams")
	var team models.Team
	err := collection.FindOne(context.Background(), bson.M{"_id": teamID}).Decode(&team)
	if err != nil {
		return err
	}

	ttm.mutex.Lock()
	defer ttm.mutex.Unlock()

	// Create ordered list of team members
	var userIDs []primitive.ObjectID
	for _, member := range team.Members {
		userIDs = append(userIDs, member.UserID)
	}

	teamIDStr := teamID.Hex()
	ttm.turnOrder[teamIDStr] = userIDs
	ttm.currentTurn[teamIDStr] = userIDs[0] // Start with first member

	return nil
}

// GetCurrentTurn returns the current team member whose turn it is
func (ttm *TeamTurnManager) GetCurrentTurn(teamID primitive.ObjectID) primitive.ObjectID {
	ttm.mutex.RLock()
	defer ttm.mutex.RUnlock()

	teamIDStr := teamID.Hex()
	if currentUserID, exists := ttm.currentTurn[teamIDStr]; exists {
		return currentUserID
	}

	return primitive.NilObjectID
}

// NextTurn advances to the next team member's turn
func (ttm *TeamTurnManager) NextTurn(teamID primitive.ObjectID) primitive.ObjectID {
	ttm.mutex.Lock()
	defer ttm.mutex.Unlock()

	teamIDStr := teamID.Hex()
	turnOrder, exists := ttm.turnOrder[teamIDStr]
	if !exists {
		return primitive.NilObjectID
	}

	currentUserID, exists := ttm.currentTurn[teamIDStr]
	if !exists {
		return primitive.NilObjectID
	}

	// Find current user's index
	currentIndex := -1
	for i, userID := range turnOrder {
		if userID == currentUserID {
			currentIndex = i
			break
		}
	}

	if currentIndex == -1 {
		return primitive.NilObjectID
	}

	// Move to next user (circular)
	nextIndex := (currentIndex + 1) % len(turnOrder)
	nextUserID := turnOrder[nextIndex]

	ttm.currentTurn[teamIDStr] = nextUserID
	return nextUserID
}

// CanUserSpeak checks if a user can speak based on token bucket and turn management
func (tbs *TokenBucketService) CanUserSpeak(teamID, userID primitive.ObjectID, ttm *TeamTurnManager) bool {
	// Check if it's the user's turn
	currentTurn := ttm.GetCurrentTurn(teamID)
	if currentTurn != userID {
		return false
	}

	// Check if user has tokens
	canConsume, _ := tbs.ConsumeToken(teamID, userID)
	return canConsume
}

// GetTeamSpeakingStatus returns the speaking status for all team members
func (tbs *TokenBucketService) GetTeamSpeakingStatus(teamID primitive.ObjectID, ttm *TeamTurnManager) map[string]interface{} {
	// Get team members
	collection := db.GetCollection("teams")
	var team models.Team
	err := collection.FindOne(context.Background(), bson.M{"_id": teamID}).Decode(&team)
	if err != nil {
		return nil
	}

	status := make(map[string]interface{})
	currentTurn := ttm.GetCurrentTurn(teamID)

	for _, member := range team.Members {
		remainingTokens := tbs.GetRemainingTokens(teamID, member.UserID)
		isCurrentTurn := member.UserID == currentTurn

		status[member.UserID.Hex()] = map[string]interface{}{
			"userId":          member.UserID,
			"displayName":     member.DisplayName,
			"remainingTokens": remainingTokens,
			"isCurrentTurn":   isCurrentTurn,
			"canSpeak":        remainingTokens > 0 && isCurrentTurn,
		}
	}

	return status
}
