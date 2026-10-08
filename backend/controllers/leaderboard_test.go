package controllers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"arguehub/db"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/event"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func leaderboardRequest(query string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/leaderboard"+query, nil)
	c.Set("email", "current@example.test")
	return c, w
}

func TestLeaderboardRejectsInvalidPagination(t *testing.T) {
	for _, query := range []string{"?page=0", "?page=-1", "?page=abc", "?page=1.5", "?page=9223372036854775808", "?page=9223372036854775807&limit=100", "?limit=0", "?limit=-1", "?limit=101", "?limit=abc", "?sort=name", "?includeCurrentUser=invalid"} {
		t.Run(query, func(t *testing.T) {
			c, w := leaderboardRequest(query)
			GetLeaderboard(c)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("got status %d, body %s", w.Code, w.Body.String())
			}
		})
	}
}

func TestLeaderboardBoundsQueryAndKeepsGlobalCount(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, tc := range []struct {
		name, query        string
		limit, skip, total int64
		empty              bool
	}{
		{"default", "", 100, 0, 5000, false},
		{"second page", "?page=2&limit=10", 10, 10, 5000, false},
		{"stats request", "?limit=1", 1, 0, 5000, false},
		{"past end", "?page=501&limit=10", 10, 5000, 5000, true},
		{"empty collection", "", 100, 0, 0, true},
	} {
		mt.Run(tc.name, func(mt *mtest.T) {
			previous := db.MongoDatabase
			db.MongoDatabase = mt.DB
			defer func() { db.MongoDatabase = previous }()
			ns := mt.DB.Name() + ".users"
			count := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "n", Value: tc.total}})
			users := []bson.D{}
			if !tc.empty {
				users = append(users, bson.D{{Key: "_id", Value: primitive.NewObjectID()}, {Key: "email", Value: "current@example.test"}, {Key: "displayName", Value: "Current User"}, {Key: "rating", Value: 1500.0}})
			}
			mt.AddMockResponses(count, mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, users...))
			// Other dashboard statistics each perform an independent count.
			for i := 0; i < 7; i++ {
				mt.AddMockResponses(mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "n", Value: int64(0)}}))
			}
			c, w := leaderboardRequest(tc.query)
			GetLeaderboard(c)
			if w.Code != http.StatusOK {
				mt.Fatalf("got status %d, body %s", w.Code, w.Body.String())
			}
			var response LeaderboardData
			if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
				mt.Fatal(err)
			}
			if response.Pagination.Total != tc.total || response.Pagination.Limit != tc.limit {
				mt.Fatalf("incorrect pagination: %+v", response.Pagination)
			}
			if tc.empty {
				if response.Debaters == nil || len(response.Debaters) != 0 {
					mt.Fatalf("empty page should be an empty array: %s", w.Body.String())
				}
			} else if response.Debaters[0].Rank != int(tc.skip)+1 || !response.Debaters[0].CurrentUser {
				mt.Fatalf("incorrect rank/current user: %+v", response.Debaters[0])
			}
			if response.Stats[0].Value != "5000" && tc.total == 5000 {
				mt.Fatalf("global user count lost: %+v", response.Stats)
			}
			var found bool
			for _, event := range mt.GetAllStartedEvents() {
				if event.CommandName != "find" {
					continue
				}
				found = true
				if event.Command.Lookup("limit").Int64() != tc.limit {
					mt.Fatalf("unbounded or wrong limit: %s", event.Command)
				}
				skipValue := event.Command.Lookup("skip")
				if tc.skip > 0 && skipValue.Int64() != tc.skip {
					mt.Fatalf("incorrect page offset: %s", event.Command)
				}
				if event.Command.Lookup("sort").Document().Lookup("_id").Int32() != 1 {
					mt.Fatalf("missing deterministic tie break: %s", event.Command)
				}
				projection := event.Command.Lookup("projection").Document()
				if projection.Lookup("rating").Int32() != 1 || projection.Lookup("password").Type != 0 {
					mt.Fatalf("incorrect projection: %s", projection)
				}
			}
			if !found {
				mt.Fatal("no users query issued")
			}
		})
	}
}

func TestLeaderboardCountFailureDoesNotReturnMisleadingStats(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	mt.Run("count failure", func(mt *mtest.T) {
		previous := db.MongoDatabase
		db.MongoDatabase = mt.DB
		defer func() { db.MongoDatabase = previous }()
		mt.AddMockResponses(mtest.CreateCommandErrorResponse(mtest.CommandError{Code: 2, Message: "count failed"}))
		c, w := leaderboardRequest("")
		GetLeaderboard(c)
		if w.Code != http.StatusInternalServerError {
			mt.Fatalf("got status %d", w.Code)
		}
	})
}

func TestLeaderboardStatsSurviveExpiredPageDeadline(t *testing.T) {
	pageContextExpired := false
	monitor := &event.CommandMonitor{
		Succeeded: func(ctx context.Context, event *event.CommandSucceededEvent) {
			if event.CommandName == "find" {
				// Simulate the page fetch consuming its entire timeout after the
				// final batch arrives, before the statistics queries start.
				<-ctx.Done()
				pageContextExpired = ctx.Err() == context.DeadlineExceeded
			}
		},
	}
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock).
		ClientOptions(options.Client().SetMonitor(monitor)))
	mt.Run("fresh statistics timeout", func(mt *mtest.T) {
		previous := db.MongoDatabase
		db.MongoDatabase = mt.DB
		defer func() { db.MongoDatabase = previous }()
		ns := mt.DB.Name() + ".users"
		mt.AddMockResponses(
			mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "n", Value: int64(23)}}),
			mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{
				{Key: "_id", Value: primitive.NewObjectID()},
				{Key: "email", Value: "current@example.test"},
			}),
		)
		for _, stat := range []struct {
			collection string
			count      int64
		}{
			{"saved_debate_transcripts", 2}, {"debates_vs_bot", 3},
			{"team_debates", 4}, {"debates", 5},
			{"team_debates", 6}, {"saved_debate_transcripts", 7}, {"users", 8},
		} {
			mt.AddMockResponses(mtest.CreateCursorResponse(0, mt.DB.Name()+"."+stat.collection,
				mtest.FirstBatch, bson.D{{Key: "n", Value: stat.count}}))
		}
		c, w := leaderboardRequest("?page=2&limit=10")
		GetLeaderboard(c)
		if !pageContextExpired || w.Code != http.StatusOK {
			mt.Fatalf("page deadline expired: %v; status %d, body %s", pageContextExpired, w.Code, w.Body.String())
		}
		var response LeaderboardData
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			mt.Fatal(err)
		}
		if response.Pagination.Total != 23 || response.Pagination.Limit != 10 ||
			len(response.Debaters) != 1 || response.Debaters[0].Rank != 11 {
			mt.Fatalf("user count or page changed: %+v", response)
		}
		for i, want := range []string{"23", "14", "13", "8"} {
			if response.Stats[i].Value != want {
				mt.Fatalf("stat %s: got %s, want %s", response.Stats[i].Label, response.Stats[i].Value, want)
			}
		}
	})
}

func TestLeaderboardCurrentUserMetadata(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, tc := range []struct {
		name                                        string
		onPage, missing, lookupFailure, rankFailure bool
	}{
		{name: "out of page"}, {name: "already on page", onPage: true},
		{name: "deleted account", missing: true},
		{name: "lookup failure", lookupFailure: true}, {name: "rank failure", rankFailure: true},
	} {
		mt.Run(tc.name, func(mt *mtest.T) {
			previous := db.MongoDatabase
			db.MongoDatabase = mt.DB
			defer func() { db.MongoDatabase = previous }()
			ns := mt.DB.Name() + ".users"
			id := primitive.NewObjectID()
			user := bson.D{{Key: "_id", Value: id}, {Key: "email", Value: "current@example.test"}, {Key: "score", Value: 12}}
			pageUser := bson.D{{Key: "_id", Value: primitive.NewObjectID()}, {Key: "email", Value: "other@example.test"}, {Key: "score", Value: 50}}
			if tc.onPage {
				pageUser = user
			}
			mt.AddMockResponses(
				mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "n", Value: int64(5000)}}),
				mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, pageUser),
			)
			if !tc.onPage {
				if tc.lookupFailure {
					mt.AddMockResponses(mtest.CreateCommandErrorResponse(mtest.CommandError{Code: 2, Message: "lookup failed"}))
				} else if tc.missing {
					mt.AddMockResponses(mtest.CreateCursorResponse(0, ns, mtest.FirstBatch))
				} else {
					mt.AddMockResponses(mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, user))
					if tc.rankFailure {
						mt.AddMockResponses(mtest.CreateCommandErrorResponse(mtest.CommandError{Code: 2, Message: "rank failed"}))
					} else {
						mt.AddMockResponses(mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "n", Value: int64(4500)}}))
					}
				}
			}
			for i := 0; i < 7; i++ {
				mt.AddMockResponses(mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "n", Value: int64(0)}}))
			}
			c, w := leaderboardRequest("?sort=score&includeCurrentUser=true&limit=1")
			GetLeaderboard(c)
			if tc.lookupFailure || tc.rankFailure {
				if w.Code != http.StatusInternalServerError {
					mt.Fatalf("expected explicit failure: %s", w.Body.String())
				}
				return
			}
			var response LeaderboardData
			if w.Code != http.StatusOK {
				mt.Fatalf("status %d: %s", w.Code, w.Body.String())
			}
			if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
				mt.Fatal(err)
			}
			if len(response.Debaters) != 1 || response.Pagination.Total != 5000 {
				mt.Fatalf("page enlarged or total lost: %+v", response)
			}
			if tc.missing {
				if response.CurrentUser != nil {
					mt.Fatal("missing user should omit metadata")
				}
			} else {
				wantRank := 4501
				if tc.onPage {
					wantRank = 1
				}
				if response.CurrentUser == nil || response.CurrentUser.ID != id.Hex() || response.CurrentUser.Rank != wantRank || !response.CurrentUser.CurrentUser {
					mt.Fatalf("incorrect current user: %+v", response.CurrentUser)
				}
			}
			finds := 0
			for _, e := range mt.GetAllStartedEvents() {
				if e.CommandName != "find" {
					continue
				}
				finds++
				if finds == 1 && e.Command.Lookup("sort").Document().Lookup("score").Int32() != -1 {
					mt.Fatal("score sort not sent to database")
				}
			}
			wantFinds := 2
			if tc.onPage {
				wantFinds = 1
			}
			if finds != wantFinds {
				mt.Fatalf("find queries: got %d, want %d", finds, wantFinds)
			}
		})
	}
}
