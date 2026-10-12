package services_test

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func tournamentTestStore(t *testing.T) (services.TournamentService, context.Context) {
	t.Helper()
	uri := os.Getenv("TOURNAMENT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("set TOURNAMENT_TEST_MONGO_URI to an isolated local MongoDB")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		cancel()
		t.Fatal(err)
	}
	database := client.Database("debateai_tournament_test_" + primitive.NewObjectID().Hex())
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		_ = database.Drop(cleanup)
		_ = client.Disconnect(cleanup)
		cancel()
	})
	collection := database.Collection("tournaments")
	if err := db.EnsureTournamentIndexes(ctx, collection); err != nil {
		t.Fatal(err)
	}
	return services.TournamentService{Collection: collection}, ctx
}

func tournamentFixture(visibility string) models.Tournament {
	host := primitive.NewObjectID()
	return models.Tournament{ID: primitive.NewObjectID(), HostID: host, Topic: "Test topic", Description: "Test debate", ModeratorName: "Host", Status: models.StatusLive, Visibility: visibility, MinParticipants: 3, MaxParticipants: 3, CreatedAt: time.Now().UTC(), Participants: []models.TournamentParticipant{{UserID: host, Name: "Host", Stance: models.StanceFor}}}
}

func TestTournamentMongoRerequestAndStaleDecision(t *testing.T) {
	s, ctx := tournamentTestStore(t)
	original := tournamentFixture(models.VisibilityPrivate)
	if err := s.Create(ctx, &original); err != nil {
		t.Fatal(err)
	}
	member := models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "First name"}
	first, _, err := s.RequestPrivate(ctx, original.InviteCode, member)
	if err != nil {
		t.Fatal(err)
	}
	oldTime := first.JoinRequests[0].CreatedAt
	if _, _, err := s.DecideRequestAt(ctx, original.ID, original.HostID, member.UserID, models.JoinRequestRejected, &oldTime); err != nil {
		t.Fatal(err)
	}
	member.Name = "Current name"
	var wait sync.WaitGroup
	changes := make(chan bool, 8)
	errorsSeen := make(chan error, 8)
	for index := 0; index < 8; index++ {
		wait.Add(1)
		go func() {
			defer wait.Done()
			_, changed, err := s.RequestPrivate(ctx, original.InviteCode, member)
			changes <- changed
			errorsSeen <- err
		}()
	}
	wait.Wait()
	close(changes)
	close(errorsSeen)
	for err := range errorsSeen {
		if err != nil {
			t.Fatal(err)
		}
	}
	changedCount := 0
	for changed := range changes {
		if changed {
			changedCount++
		}
	}
	var stored models.Tournament
	if err := s.Collection.FindOne(ctx, bson.M{"_id": original.ID}).Decode(&stored); err != nil {
		t.Fatal(err)
	}
	if changedCount != 1 || stored.Revision != 3 || len(stored.JoinRequests) != 1 {
		t.Fatalf("re-request duplicated state: changes=%d revision=%d requests=%d", changedCount, stored.Revision, len(stored.JoinRequests))
	}
	request := stored.JoinRequests[0]
	if request.Status != models.JoinRequestPending || request.Name != member.Name || !request.CreatedAt.After(oldTime) || request.DecidedAt != nil || request.DecidedBy != nil {
		t.Fatalf("re-request retained old decision or identity: %+v", request)
	}
	for _, decision := range []string{models.JoinRequestApproved, models.JoinRequestRejected} {
		if _, changed, err := s.DecideRequestAt(ctx, original.ID, original.HostID, member.UserID, decision, &oldTime); !errors.Is(err, services.ErrTournamentRequestConflict) || changed {
			t.Fatalf("stale decision changed new attempt: %v", err)
		}
	}
	approved, changed, err := s.DecideRequestAt(ctx, original.ID, original.HostID, member.UserID, models.JoinRequestApproved, &request.CreatedAt)
	if err != nil || !changed || approved.Participants[1].Name != member.Name || approved.Participants[1].Stance != "" {
		t.Fatalf("approval did not preserve current name/unset stance: %v", err)
	}
	if _, changed, err := s.RequestPrivate(ctx, original.InviteCode, member); err != nil || changed {
		t.Fatal("approved re-request duplicated membership")
	}
	if _, changed, err := s.DecideRequestAt(ctx, original.ID, original.HostID, member.UserID, models.JoinRequestApproved, &request.CreatedAt); err != nil || changed {
		t.Fatal("approval retry was not idempotent")
	}

	// Reopening an existing user slot does not consume another request-history slot.
	bounded := tournamentFixture(models.VisibilityPrivate)
	bounded.JoinRequests = []models.JoinRequest{{UserID: member.UserID, Name: "Old", Status: models.JoinRequestRejected, CreatedAt: oldTime}}
	for len(bounded.JoinRequests) < 64 {
		bounded.JoinRequests = append(bounded.JoinRequests, models.JoinRequest{UserID: primitive.NewObjectID(), Name: "Other", Status: models.JoinRequestRejected, CreatedAt: oldTime})
	}
	if err := s.Create(ctx, &bounded); err != nil {
		t.Fatal(err)
	}
	if updated, changed, err := s.RequestPrivate(ctx, bounded.InviteCode, member); err != nil || !changed || len(updated.JoinRequests) != 64 {
		t.Fatalf("bounded re-request failed: %v", err)
	}
	if _, _, err := s.RequestPrivate(ctx, bounded.InviteCode, models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "New"}); !errors.Is(err, services.ErrTournamentRequestLimit) {
		t.Fatalf("new request bypassed history bound: %v", err)
	}

	ready := tournamentFixture(models.VisibilityPrivate)
	ready.Participants = append(ready.Participants, models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "Against", Stance: models.StanceAgainst}, models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "For", Stance: models.StanceFor})
	ready.MaxParticipants = 4
	ready.JoinRequests = []models.JoinRequest{{UserID: member.UserID, Name: member.Name, Status: models.JoinRequestRejected, CreatedAt: oldTime}}
	if err := s.Create(ctx, &ready); err != nil {
		t.Fatal(err)
	}
	wait.Add(2)
	var requestErr, startErr error
	go func() { defer wait.Done(); _, _, requestErr = s.RequestPrivate(ctx, ready.InviteCode, member) }()
	go func() {
		defer wait.Done()
		_, _, startErr = (services.TournamentExecutionService{Collection: s.Collection}).Start(ctx, ready.ID, ready.HostID)
	}()
	wait.Wait()
	if startErr != nil || (requestErr != nil && !errors.Is(requestErr, services.ErrTournamentLocked)) {
		t.Fatalf("start/re-request race: start=%v request=%v", startErr, requestErr)
	}
	if err := s.Collection.FindOne(ctx, bson.M{"_id": ready.ID}).Decode(&stored); err != nil {
		t.Fatal(err)
	}
	if stored.Execution == nil || len(stored.Execution.Roster) != 3 || len(stored.Participants) != 3 {
		t.Fatal("re-request changed frozen membership")
	}
	if _, _, err := s.DecideRequest(ctx, ready.ID, ready.HostID, member.UserID, models.JoinRequestApproved); !errors.Is(err, services.ErrTournamentLocked) && !errors.Is(err, services.ErrTournamentRequestConflict) {
		t.Fatalf("locked approval succeeded: %v", err)
	}
	if _, _, err := s.RequestPrivate(ctx, ready.InviteCode, models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "Late"}); !errors.Is(err, services.ErrTournamentLocked) {
		t.Fatalf("late request succeeded: %v", err)
	}
}

func TestTournamentMongoPublicCapacityAndLegacyRevision(t *testing.T) {
	s, ctx := tournamentTestStore(t)
	original := tournamentFixture(models.VisibilityPublic)
	legacy, _ := bson.Marshal(original)
	var document bson.M
	_ = bson.Unmarshal(legacy, &document)
	delete(document, "revision")
	if _, err := s.Collection.InsertOne(ctx, document); err != nil {
		t.Fatal(err)
	}
	var wait sync.WaitGroup
	results := make(chan error, 8)
	for index := 0; index < 8; index++ {
		wait.Add(1)
		go func() {
			defer wait.Done()
			_, _, err := s.JoinPublic(ctx, original.ID, models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "Member", Stance: "against"})
			results <- err
		}()
	}
	wait.Wait()
	close(results)
	accepted := 0
	for err := range results {
		if err == nil {
			accepted++
		} else if !errors.Is(err, services.ErrTournamentFull) {
			t.Fatal(err)
		}
	}
	if accepted != 2 {
		t.Fatalf("accepted %d, want two free seats", accepted)
	}
	var stored models.Tournament
	if err := s.Collection.FindOne(ctx, bson.M{"_id": original.ID}).Decode(&stored); err != nil {
		t.Fatal(err)
	}
	if len(stored.Participants) != 3 || stored.Revision != 2 {
		t.Fatalf("wrong persisted roster/revision: %+v", stored)
	}
	member := stored.Participants[1]
	if member.Stance != "" {
		t.Fatal("server must not trust initial join stance")
	}
	_, changed, err := s.JoinPublic(ctx, original.ID, member)
	if err != nil || changed {
		t.Fatalf("join replay: changed=%v err=%v", changed, err)
	}
	_, _, err = s.ChooseStance(ctx, original.ID, member.UserID, models.StanceAgainst)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Collection.FindOne(ctx, bson.M{"_id": original.ID}).Decode(&stored); err != nil {
		t.Fatal(err)
	}
	if stored.Participants[1].Stance != models.StanceAgainst {
		t.Fatal("stance was not persisted")
	}
}

func TestTournamentMongoPrivateDecisions(t *testing.T) {
	s, ctx := tournamentTestStore(t)
	original := tournamentFixture(models.VisibilityPrivate)
	if err := s.Create(ctx, &original); err != nil {
		t.Fatal(err)
	}
	members := []models.TournamentParticipant{{UserID: primitive.NewObjectID(), Name: "First"}, {UserID: primitive.NewObjectID(), Name: "Second"}, {UserID: primitive.NewObjectID(), Name: "Third"}}
	for _, member := range members {
		if _, _, err := s.RequestPrivate(ctx, original.InviteCode, member); err != nil {
			t.Fatal(err)
		}
	}
	if _, _, err := s.DecideRequest(ctx, original.ID, members[0].UserID, members[1].UserID, models.JoinRequestApproved); !errors.Is(err, services.ErrTournamentNotFound) {
		t.Fatalf("non-host decision: %v", err)
	}
	var wait sync.WaitGroup
	results := make(chan error, 3)
	for _, member := range members {
		wait.Add(1)
		go func(user primitive.ObjectID) {
			defer wait.Done()
			_, _, err := s.DecideRequest(ctx, original.ID, original.HostID, user, models.JoinRequestApproved)
			results <- err
		}(member.UserID)
	}
	wait.Wait()
	close(results)
	approved := 0
	for err := range results {
		if err == nil {
			approved++
		} else if !errors.Is(err, services.ErrTournamentFull) {
			t.Fatal(err)
		}
	}
	if approved != 2 {
		t.Fatalf("approved %d, want 2", approved)
	}
	var stored models.Tournament
	if err := s.Collection.FindOne(ctx, bson.M{"_id": original.ID}).Decode(&stored); err != nil {
		t.Fatal(err)
	}
	for _, request := range stored.JoinRequests {
		if request.Status == models.JoinRequestApproved {
			if request.DecidedAt == nil || request.DecidedBy == nil || *request.DecidedBy != original.HostID {
				t.Fatal("decision attribution missing")
			}
			_, changed, err := s.DecideRequest(ctx, original.ID, original.HostID, request.UserID, models.JoinRequestApproved)
			if err != nil || changed {
				t.Fatal("approval replay changed state")
			}
			if _, _, err := s.DecideRequest(ctx, original.ID, original.HostID, request.UserID, models.JoinRequestRejected); !errors.Is(err, services.ErrTournamentRequestConflict) {
				t.Fatalf("conflicting decision: %v", err)
			}
		} else {
			if _, _, err := s.DecideRequest(ctx, original.ID, original.HostID, request.UserID, models.JoinRequestRejected); err != nil {
				t.Fatal(err)
			}
			if _, changed, err := s.RequestPrivate(ctx, original.InviteCode, models.TournamentParticipant{UserID: request.UserID, Name: "Retry"}); !errors.Is(err, services.ErrTournamentFull) || changed {
				t.Fatal("re-request must still enforce full capacity")
			}
		}
	}
	if _, _, err := s.JoinPublic(ctx, original.ID, members[0]); !errors.Is(err, services.ErrTournamentNotFound) {
		t.Fatal("private tournament exposed to direct join")
	}
}

func TestTournamentMongoVisibilityAndLifecycleGuards(t *testing.T) {
	s, ctx := tournamentTestStore(t)
	original := tournamentFixture(models.VisibilityPublic)
	if err := s.Create(ctx, &original); err != nil {
		t.Fatal(err)
	}
	private, _, err := s.UpdateLobby(ctx, original.ID, original.HostID, bson.M{"visibility": models.VisibilityPrivate})
	if err != nil || len(private.InviteCode) != 6 {
		t.Fatalf("private transition: %v", err)
	}
	member := models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "Pending"}
	if _, _, err := s.RequestPrivate(ctx, private.InviteCode, member); err != nil {
		t.Fatal(err)
	}
	public, _, err := s.UpdateLobby(ctx, original.ID, original.HostID, bson.M{"visibility": models.VisibilityPublic})
	if err != nil {
		t.Fatal(err)
	}
	if public.InviteCode != "" || public.JoinRequests[0].Status != models.JoinRequestRejected {
		t.Fatal("visibility change did not revoke invite/pending request")
	}
	if _, _, err := s.RequestPrivate(ctx, private.InviteCode, member); !errors.Is(err, services.ErrTournamentNotFound) {
		t.Fatalf("revoked code: %v", err)
	}
	if _, _, err := s.UpdateLobby(ctx, original.ID, original.HostID, bson.M{"status": models.StatusCompleted}); !errors.Is(err, services.ErrTournamentLocked) {
		t.Fatalf("completion bypass: %v", err)
	}
	if _, err := s.Collection.UpdateOne(ctx, bson.M{"_id": original.ID}, bson.M{"$set": bson.M{"execution": bson.M{"state": "running"}}, "$inc": bson.M{"revision": 1}}); err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.JoinPublic(ctx, original.ID, member); !errors.Is(err, services.ErrTournamentLocked) {
		t.Fatal("running tournament admitted member")
	}
	if _, _, err := s.ChooseStance(ctx, original.ID, original.HostID, "against"); !errors.Is(err, services.ErrTournamentLocked) {
		t.Fatal("running roster was changed")
	}
	if _, _, err := s.UpdateLobby(ctx, original.ID, original.HostID, bson.M{"topic": "Changed"}); !errors.Is(err, services.ErrTournamentLocked) {
		t.Fatal("running topic was changed")
	}
	if err := s.DeleteLobby(ctx, original.ID, original.HostID); !errors.Is(err, services.ErrTournamentLocked) {
		t.Fatal("running tournament was deleted")
	}
}

func TestTournamentMongoInviteIndexAndRequestBound(t *testing.T) {
	s, ctx := tournamentTestStore(t)
	original := tournamentFixture(models.VisibilityPrivate)
	if err := s.Create(ctx, &original); err != nil {
		t.Fatal(err)
	}
	duplicate := original
	duplicate.ID = primitive.NewObjectID()
	if _, err := s.Collection.InsertOne(ctx, duplicate); !mongo.IsDuplicateKeyError(err) {
		t.Fatalf("invite uniqueness: %v", err)
	}
	requests := make([]models.JoinRequest, 64)
	for index := range requests {
		requests[index] = models.JoinRequest{UserID: primitive.NewObjectID(), Name: "Pending", Status: models.JoinRequestPending}
	}
	if _, err := s.Collection.UpdateOne(ctx, bson.M{"_id": original.ID}, bson.M{"$set": bson.M{"joinRequests": requests}}); err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.RequestPrivate(ctx, original.InviteCode, models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "Overflow"}); !errors.Is(err, services.ErrTournamentRequestLimit) {
		t.Fatalf("request bound: %v", err)
	}
}

func TestTournamentLobbyOpen(t *testing.T) {
	for _, status := range []string{models.StatusUpcoming, models.StatusLive} {
		if !services.TournamentLobbyOpen(models.Tournament{Status: status}) {
			t.Fatal("lobby should be open")
		}
	}
	if services.TournamentLobbyOpen(models.Tournament{Status: models.StatusCompleted}) || services.TournamentLobbyOpen(models.Tournament{Status: models.StatusLive, Execution: &models.TournamentExecution{State: "running"}}) {
		t.Fatal("non-lobby state accepted")
	}
}

func TestTournamentMongoConcurrentRequestAndApprovalReplay(t *testing.T) {
	s, ctx := tournamentTestStore(t)
	original := tournamentFixture(models.VisibilityPrivate)
	if err := s.Create(ctx, &original); err != nil {
		t.Fatal(err)
	}
	member := models.TournamentParticipant{UserID: primitive.NewObjectID(), Name: "Replay member"}
	for _, operation := range []func() (models.Tournament, bool, error){
		func() (models.Tournament, bool, error) { return s.RequestPrivate(ctx, original.InviteCode, member) },
		func() (models.Tournament, bool, error) {
			return s.DecideRequest(ctx, original.ID, original.HostID, member.UserID, models.JoinRequestApproved)
		},
	} {
		var wait sync.WaitGroup
		changed := make(chan bool, 8)
		failures := make(chan error, 8)
		for index := 0; index < 8; index++ {
			wait.Add(1)
			go func() { defer wait.Done(); _, wrote, err := operation(); changed <- wrote; failures <- err }()
		}
		wait.Wait()
		close(changed)
		close(failures)
		writes := 0
		for wrote := range changed {
			if wrote {
				writes++
			}
		}
		if writes != 1 {
			t.Fatalf("replays made %d writes, want one", writes)
		}
		for err := range failures {
			if err != nil {
				t.Fatal(err)
			}
		}
	}
	var stored models.Tournament
	if err := s.Collection.FindOne(ctx, bson.M{"_id": original.ID}).Decode(&stored); err != nil {
		t.Fatal(err)
	}
	if len(stored.Participants) != 2 || len(stored.JoinRequests) != 1 || stored.Revision != 2 {
		t.Fatalf("duplicate replay state: %+v", stored)
	}
}
