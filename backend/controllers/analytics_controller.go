package controllers

import (
	"arguehub/db"
	"arguehub/models"
	"arguehub/services"
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	analyticsHistoryRequestTimeout = 45 * time.Second
	analyticsHistoryQueryTimeout   = 5 * time.Second
)

func countDocumentsWithTimeout(collection *mongo.Collection, filter interface{}) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), analyticsHistoryQueryTimeout)
	defer cancel()
	return collection.CountDocuments(ctx, filter)
}

// GetAnalytics returns current analytics snapshot
func GetAnalytics(ctx *gin.Context) {
	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	countDocuments := func(collection *mongo.Collection, filter interface{}, metric string) (int64, bool) {
		count, err := collection.CountDocuments(dbCtx, filter)
		if err != nil {
			log.Printf("Failed to count %s: %v", metric, err)
			ctx.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to fetch analytics",
				"message": err.Error(),
				"metric":  metric,
			})
			return 0, false
		}
		return count, true
	}

	now := time.Now()
	thirtyDaysAgo := now.AddDate(0, 0, -30)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// Get total debates
	debatesCollection := db.MongoDatabase.Collection("debates")
	totalDebates, ok := countDocuments(debatesCollection, bson.M{}, "debates")
	if !ok {
		return
	}

	// Get bot debates
	botDebatesCollection := db.MongoDatabase.Collection("debates_vs_bot")
	totalBotDebates, ok := countDocuments(botDebatesCollection, bson.M{}, "bot debates")
	if !ok {
		return
	}
	totalDebates += totalBotDebates

	// Get debates today
	debatesToday, ok := countDocuments(debatesCollection, bson.M{
		"date": bson.M{"$gte": todayStart},
	}, "debates today")
	if !ok {
		return
	}

	// Get active users (users active in last 30 days)
	usersCollection := db.MongoDatabase.Collection("users")
	activeUsers, ok := countDocuments(usersCollection, bson.M{
		"updatedAt": bson.M{"$gte": thirtyDaysAgo},
	}, "active users")
	if !ok {
		return
	}

	// Get total users
	totalUsers, ok := countDocuments(usersCollection, bson.M{}, "users")
	if !ok {
		return
	}

	// Get new users today
	newUsersToday, ok := countDocuments(usersCollection, bson.M{
		"createdAt": bson.M{"$gte": todayStart},
	}, "new users today")
	if !ok {
		return
	}

	// Get total comments (team debate messages + team chat messages)
	teamDebateMessagesCollection := db.MongoDatabase.Collection("team_debate_messages")
	totalTeamDebateMessages, ok := countDocuments(teamDebateMessagesCollection, bson.M{}, "team debate messages")
	if !ok {
		return
	}

	teamChatMessagesCollection := db.MongoDatabase.Collection("team_chat_messages")
	totalTeamChatMessages, ok := countDocuments(teamChatMessagesCollection, bson.M{}, "team chat messages")
	if !ok {
		return
	}

	totalComments := totalTeamDebateMessages + totalTeamChatMessages

	// Get comments today
	commentsToday, ok := countDocuments(teamDebateMessagesCollection, bson.M{
		"timestamp": bson.M{"$gte": todayStart},
	}, "team debate messages today")
	if !ok {
		return
	}
	chatCommentsToday, ok := countDocuments(teamChatMessagesCollection, bson.M{
		"timestamp": bson.M{"$gte": todayStart},
	}, "team chat messages today")
	if !ok {
		return
	}
	commentsToday += chatCommentsToday

	// Create analytics snapshot
	snapshot := models.AnalyticsSnapshot{
		ID:            primitive.NewObjectID(),
		Timestamp:     now,
		TotalDebates:  totalDebates,
		ActiveUsers:   activeUsers,
		TotalComments: totalComments,
		TotalUsers:    totalUsers,
		DebatesToday:  debatesToday,
		CommentsToday: commentsToday,
		NewUsersToday: newUsersToday,
	}

	// Save snapshot to database (optional, for historical tracking)
	snapshotsCollection := db.MongoDatabase.Collection("analytics_snapshots")
	if _, err := snapshotsCollection.InsertOne(dbCtx, snapshot); err != nil {
		log.Printf("Failed to persist analytics snapshot: %v", err)
	}

	ctx.JSON(http.StatusOK, gin.H{
		"totalDebates":  snapshot.TotalDebates,
		"activeUsers":   snapshot.ActiveUsers,
		"totalComments": snapshot.TotalComments,
		"totalUsers":    snapshot.TotalUsers,
		"debatesToday":  snapshot.DebatesToday,
		"commentsToday": snapshot.CommentsToday,
		"newUsersToday": snapshot.NewUsersToday,
		"timestamp":     snapshot.Timestamp.Format(time.RFC3339),
	})
}

// GetAnalyticsHistory returns analytics data over time
func GetAnalyticsHistory(ctx *gin.Context) {
	days := 7 // default to 7 days
	if daysStr := ctx.Query("days"); daysStr != "" {
		if parsedDays, err := strconv.Atoi(daysStr); err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), analyticsHistoryRequestTimeout)
	defer cancel()

	now := time.Now()
	startDate := now.AddDate(0, 0, -days)

	snapshotsCollection := db.MongoDatabase.Collection("analytics_snapshots")

	opts := options.Find().SetSort(bson.M{"timestamp": 1})
	cursor, err := snapshotsCollection.Find(dbCtx, bson.M{
		"timestamp": bson.M{"$gte": startDate},
	}, opts)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch analytics history", "message": err.Error()})
		return
	}
	defer cursor.Close(dbCtx)

	var existingSnapshots []models.AnalyticsSnapshot
	if err := cursor.All(dbCtx, &existingSnapshots); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode snapshots", "message": err.Error()})
		return
	}

	// Create a map of existing snapshots by day
	snapshotMap := make(map[string]models.AnalyticsSnapshot)
	for _, snapshot := range existingSnapshots {
		dayKey := snapshot.Timestamp.Format("2006-01-02")
		snapshotMap[dayKey] = snapshot
	}

	// Generate snapshots for all days in the requested period
	// Use existing snapshots where available, otherwise generate from actual data
	var snapshots []models.AnalyticsSnapshot
	for i := 0; i < days; i++ {
		date := startDate.AddDate(0, 0, i)
		dateStart := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
		dateEnd := dateStart.AddDate(0, 0, 1)
		dayKey := dateStart.Format("2006-01-02")

		var snapshot models.AnalyticsSnapshot
		if existingSnapshot, exists := snapshotMap[dayKey]; exists {
			// Use existing snapshot
			snapshot = existingSnapshot
		} else {
			debatesCollection := db.MongoDatabase.Collection("debates")
			debatesCount, err := countDocumentsWithTimeout(debatesCollection, bson.M{
				"date": bson.M{"$gte": dateStart, "$lt": dateEnd},
			})
			if err != nil {
				log.Printf("Error counting debates for %s: %v", dayKey, err)
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compute debates history", "message": err.Error()})
				return
			}

			botDebatesCollection := db.MongoDatabase.Collection("debates_vs_bot")
			// Bot debates use createdAt (int64 Unix timestamp) instead of date
			dateStartUnix := dateStart.Unix()
			dateEndUnix := dateEnd.Unix()
			botDebatesCount, err := countDocumentsWithTimeout(botDebatesCollection, bson.M{
				"createdAt": bson.M{"$gte": dateStartUnix, "$lt": dateEndUnix},
			})
			if err != nil {
				log.Printf("Error counting bot debates for %s: %v", dayKey, err)
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compute bot debates history", "message": err.Error()})
				return
			}
			totalDebates := debatesCount + botDebatesCount

			log.Printf("Generated snapshot for %s: %d debates (%d regular + %d bot)", dayKey, totalDebates, debatesCount, botDebatesCount)

			teamDebateMessagesCollection := db.MongoDatabase.Collection("team_debate_messages")
			commentsCount, err := countDocumentsWithTimeout(teamDebateMessagesCollection, bson.M{
				"timestamp": bson.M{"$gte": dateStart, "$lt": dateEnd},
			})
			if err != nil {
				log.Printf("Error counting team debate messages for %s: %v", dayKey, err)
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compute comments history", "message": err.Error()})
				return
			}

			teamChatMessagesCollection := db.MongoDatabase.Collection("team_chat_messages")
			chatCommentsCount, err := countDocumentsWithTimeout(teamChatMessagesCollection, bson.M{
				"timestamp": bson.M{"$gte": dateStart, "$lt": dateEnd},
			})
			if err != nil {
				log.Printf("Error counting team chat messages for %s: %v", dayKey, err)
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compute chat history", "message": err.Error()})
				return
			}
			commentsCount += chatCommentsCount

			// Count new users for this day
			usersCollection := db.MongoDatabase.Collection("users")
			newUsersCount, err := countDocumentsWithTimeout(usersCollection, bson.M{
				"createdAt": bson.M{"$gte": dateStart, "$lt": dateEnd},
			})
			if err != nil {
				log.Printf("Error counting new users for %s: %v", dayKey, err)
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compute user history", "message": err.Error()})
				return
			}

			snapshot = models.AnalyticsSnapshot{
				ID:            primitive.NewObjectID(),
				Timestamp:     dateStart,
				DebatesToday:  totalDebates,
				CommentsToday: commentsCount,
				NewUsersToday: newUsersCount,
			}
		}
		snapshots = append(snapshots, snapshot)
	}

	ctx.JSON(http.StatusOK, gin.H{
		"snapshots": snapshots,
		"days":      days,
	})
}

// GetAdminActionLogs returns admin action logs
func GetAdminActionLogs(ctx *gin.Context) {
	page := 1
	limit := 50
	if pageStr := ctx.Query("page"); pageStr != "" {
		if parsed, err := strconv.Atoi(pageStr); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if limitStr := ctx.Query("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			const maxLimit = 200
			if parsed > maxLimit {
				limit = maxLimit
			} else {
				limit = parsed
			}
		}
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	skip := (page - 1) * limit

	logsCollection := db.MongoDatabase.Collection("admin_action_logs")
	opts := options.Find().SetSkip(int64(skip)).SetLimit(int64(limit)).SetSort(bson.M{"timestamp": -1})
	cursor, err := logsCollection.Find(dbCtx, bson.M{}, opts)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs", "message": err.Error()})
		return
	}
	defer cursor.Close(dbCtx)

	var logs []models.AdminActionLog
	if err := cursor.All(dbCtx, &logs); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode logs", "message": err.Error()})
		return
	}

	total, err := logsCollection.CountDocuments(dbCtx, bson.M{})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs", "message": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"logs":  logs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetDebateAnalytics returns analytics for a specific debate (by saved transcript ID or room ID)
func GetDebateAnalytics(ctx *gin.Context) {
	debateId := ctx.Param("id")
	if debateId == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "debate id required"})
		return
	}

	dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	coll := db.MongoDatabase.Collection("saved_debate_transcripts")

	// Try interpret as ObjectID
	if objID, err := primitive.ObjectIDFromHex(debateId); err == nil {
		var saved models.SavedDebateTranscript
		if err := coll.FindOne(dbCtx, bson.M{"_id": objID}).Decode(&saved); err == nil {
			ctx.JSON(http.StatusOK, gin.H{"analytics": saved.Analytics, "transcript": saved})
			return
		}
	}

	// Fallback: treat as roomId and lookup saved transcripts or debate_transcripts
	var saved models.SavedDebateTranscript
	if err := coll.FindOne(dbCtx, bson.M{"roomId": debateId}).Decode(&saved); err == nil {
		ctx.JSON(http.StatusOK, gin.H{"analytics": saved.Analytics, "transcript": saved})
		return
	}

	// No analytics found
	ctx.JSON(http.StatusNotFound, gin.H{"error": "analytics not found for debate"})
}

// GetUserAnalytics returns historical analytics for a user
func GetUserAnalytics(ctx *gin.Context) {
	userId := ctx.Param("id")
	if userId == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "user id required"})
		return
	}
	obj, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	stats, err := services.GetDebateStats(obj)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user analytics", "message": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"analytics": stats})
}
