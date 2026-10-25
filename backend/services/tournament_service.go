package services

import (
	"context"
	"crypto/rand"
	"errors"
	"math/big"
	"strconv"
	"time"

	"arguehub/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	ErrTournamentNotFound        = errors.New("Tournament not found")
	ErrTournamentForbidden       = errors.New("Only the host can perform this action")
	ErrTournamentLocked          = errors.New("Tournament admission is closed")
	ErrTournamentFull            = errors.New("Tournament is full")
	ErrTournamentConflict        = errors.New("Tournament changed; refresh and retry")
	ErrTournamentRequestConflict = errors.New("Request already has a different decision")
	ErrTournamentRequestLimit    = errors.New("Tournament request limit reached")
	ErrTournamentMember          = errors.New("Join the tournament before choosing a stance")
	ErrTournamentUnavailable     = errors.New("Tournament storage is unavailable")
)

type TournamentService struct{ Collection *mongo.Collection }

func TournamentLobbyOpen(t models.Tournament) bool {
	return t.Execution == nil && (t.Status == models.StatusUpcoming || t.Status == models.StatusLive)
}

func TournamentHasMember(t models.Tournament, user primitive.ObjectID) bool {
	for _, participant := range t.Participants {
		if participant.UserID == user {
			return true
		}
	}
	return false
}

func tournamentHostPermission(t models.Tournament, actor primitive.ObjectID) error {
	if t.HostID == actor {
		return nil
	}
	if t.Visibility == models.VisibilityPrivate && !TournamentHasMember(t, actor) {
		return ErrTournamentNotFound
	}
	return ErrTournamentForbidden
}

func GenerateTournamentInviteCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", err
	}
	return strconv.FormatInt(n.Int64()+100000, 10), nil
}

func (s TournamentService) Create(ctx context.Context, t *models.Tournament) error {
	if s.Collection == nil {
		return ErrTournamentUnavailable
	}
	t.SchemaVersion = 1
	for attempt := 0; attempt < 10; attempt++ {
		if t.Visibility == models.VisibilityPrivate {
			code, err := GenerateTournamentInviteCode()
			if err != nil {
				return err
			}
			t.InviteCode = code
		}
		_, err := s.Collection.InsertOne(ctx, t)
		if err == nil {
			return nil
		}
		if !mongo.IsDuplicateKeyError(err) || t.Visibility != models.VisibilityPrivate {
			return err
		}
	}
	return ErrTournamentConflict
}

func tournamentRevisionFilter(t models.Tournament) bson.M {
	filter := bson.M{"_id": t.ID, "execution": nil, "status": bson.M{"$in": bson.A{models.StatusUpcoming, models.StatusLive}}}
	if t.Revision == 0 {
		filter["$or"] = bson.A{bson.M{"revision": 0}, bson.M{"revision": bson.M{"$exists": false}}}
	} else {
		filter["revision"] = t.Revision
	}
	return filter
}

// Every lobby write compares the same revision, including legacy records without it.
func (s TournamentService) mutate(ctx context.Context, id primitive.ObjectID, change func(*models.Tournament) (bson.M, error)) (models.Tournament, bool, error) {
	if s.Collection == nil {
		return models.Tournament{}, false, ErrTournamentUnavailable
	}
	for attempt := 0; attempt < 32; attempt++ {
		var t models.Tournament
		if err := s.Collection.FindOne(ctx, bson.M{"_id": id}).Decode(&t); err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				err = ErrTournamentNotFound
			}
			return t, false, err
		}
		updates, err := change(&t)
		if err != nil {
			return t, false, err
		}
		if len(updates) == 0 {
			return t, false, nil
		}
		if !TournamentLobbyOpen(t) {
			return t, false, ErrTournamentLocked
		}
		if _, supplied := updates["schemaVersion"]; !supplied {
			updates["schemaVersion"] = 1
		}
		var updated models.Tournament
		err = s.Collection.FindOneAndUpdate(ctx, tournamentRevisionFilter(t), bson.M{"$set": updates, "$inc": bson.M{"revision": 1}}, options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&updated)
		if errors.Is(err, mongo.ErrNoDocuments) {
			continue
		}
		if mongo.IsDuplicateKeyError(err) {
			continue
		}
		if err != nil {
			return t, false, err
		}
		return updated, true, nil
	}
	return models.Tournament{}, false, ErrTournamentConflict
}

func (s TournamentService) JoinPublic(ctx context.Context, id primitive.ObjectID, member models.TournamentParticipant) (models.Tournament, bool, error) {
	return s.mutate(ctx, id, func(t *models.Tournament) (bson.M, error) {
		if t.Visibility != models.VisibilityPublic {
			return nil, ErrTournamentNotFound
		}
		if TournamentHasMember(*t, member.UserID) {
			return nil, nil
		}
		if !TournamentLobbyOpen(*t) {
			return nil, ErrTournamentLocked
		}
		if len(t.Participants) >= t.MaxParticipants {
			return nil, ErrTournamentFull
		}
		member.Stance = ""
		return bson.M{"participants": append(t.Participants, member)}, nil
	})
}

func (s TournamentService) RequestPrivate(ctx context.Context, code string, member models.TournamentParticipant) (models.Tournament, bool, error) {
	if s.Collection == nil {
		return models.Tournament{}, false, ErrTournamentUnavailable
	}
	var found models.Tournament
	if err := s.Collection.FindOne(ctx, bson.M{"inviteCode": code, "visibility": models.VisibilityPrivate}).Decode(&found); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			err = ErrTournamentNotFound
		}
		return found, false, err
	}
	return s.mutate(ctx, found.ID, func(t *models.Tournament) (bson.M, error) {
		if t.Visibility != models.VisibilityPrivate || t.InviteCode != code {
			return nil, ErrTournamentNotFound
		}
		rejectedIndex := -1
		for index, request := range t.JoinRequests {
			if request.UserID == member.UserID {
				if request.Status != models.JoinRequestRejected {
					return nil, nil
				}
				rejectedIndex = index
				break
			}
		}
		if TournamentHasMember(*t, member.UserID) {
			return nil, nil
		}
		if !TournamentLobbyOpen(*t) {
			return nil, ErrTournamentLocked
		}
		if len(t.Participants) >= t.MaxParticipants {
			return nil, ErrTournamentFull
		}
		if rejectedIndex < 0 && len(t.JoinRequests) >= 64 {
			return nil, ErrTournamentRequestLimit
		}
		now := time.Now().UTC().Truncate(time.Millisecond)
		if rejectedIndex >= 0 {
			previous := t.JoinRequests[rejectedIndex].CreatedAt
			if !now.After(previous) {
				now = previous.Add(time.Millisecond)
			}
			t.JoinRequests[rejectedIndex] = models.JoinRequest{UserID: member.UserID, Name: member.Name, Status: models.JoinRequestPending, CreatedAt: now}
			return bson.M{"joinRequests": t.JoinRequests}, nil
		}
		request := models.JoinRequest{UserID: member.UserID, Name: member.Name, Status: models.JoinRequestPending, CreatedAt: now}
		return bson.M{"joinRequests": append(t.JoinRequests, request)}, nil
	})
}

func (s TournamentService) DecideRequest(ctx context.Context, id, actor, requester primitive.ObjectID, decision string) (models.Tournament, bool, error) {
	return s.DecideRequestAt(ctx, id, actor, requester, decision, nil)
}

// A supplied request timestamp fences a host action against a later re-request.
func (s TournamentService) DecideRequestAt(ctx context.Context, id, actor, requester primitive.ObjectID, decision string, requestedAt *time.Time) (models.Tournament, bool, error) {
	if decision != models.JoinRequestApproved && decision != models.JoinRequestRejected {
		return models.Tournament{}, false, ErrTournamentRequestConflict
	}
	return s.mutate(ctx, id, func(t *models.Tournament) (bson.M, error) {
		if err := tournamentHostPermission(*t, actor); err != nil {
			return nil, err
		}
		for index := range t.JoinRequests {
			request := &t.JoinRequests[index]
			if request.UserID != requester {
				continue
			}
			if requestedAt != nil && !request.CreatedAt.Equal(*requestedAt) {
				return nil, ErrTournamentRequestConflict
			}
			if request.Status == decision {
				return nil, nil
			}
			if request.Status != models.JoinRequestPending {
				return nil, ErrTournamentRequestConflict
			}
			if !TournamentLobbyOpen(*t) {
				return nil, ErrTournamentLocked
			}
			if t.Visibility != models.VisibilityPrivate {
				return nil, ErrTournamentRequestConflict
			}
			updates := bson.M{}
			if decision == models.JoinRequestApproved && !TournamentHasMember(*t, requester) {
				if len(t.Participants) >= t.MaxParticipants {
					return nil, ErrTournamentFull
				}
				updates["participants"] = append(t.Participants, models.TournamentParticipant{UserID: requester, Name: request.Name})
			}
			now := time.Now().UTC()
			request.Status = decision
			request.DecidedAt = &now
			request.DecidedBy = &actor
			updates["joinRequests"] = t.JoinRequests
			return updates, nil
		}
		return nil, ErrTournamentNotFound
	})
}

func (s TournamentService) ChooseStance(ctx context.Context, id, actor primitive.ObjectID, stance string) (models.Tournament, bool, error) {
	if stance != models.StanceFor && stance != models.StanceAgainst {
		return models.Tournament{}, false, ErrTournamentConflict
	}
	return s.mutate(ctx, id, func(t *models.Tournament) (bson.M, error) {
		if t.Visibility == models.VisibilityPrivate && !TournamentHasMember(*t, actor) {
			return nil, ErrTournamentNotFound
		}
		if !TournamentLobbyOpen(*t) {
			return nil, ErrTournamentLocked
		}
		for index := range t.Participants {
			if t.Participants[index].UserID == actor {
				if t.Participants[index].Stance == stance {
					return nil, nil
				}
				t.Participants[index].Stance = stance
				return bson.M{"participants": t.Participants}, nil
			}
		}
		return nil, ErrTournamentMember
	})
}

func (s TournamentService) UpdateLobby(ctx context.Context, id, actor primitive.ObjectID, supplied bson.M) (models.Tournament, bool, error) {
	return s.mutate(ctx, id, func(t *models.Tournament) (bson.M, error) {
		if err := tournamentHostPermission(*t, actor); err != nil {
			return nil, err
		}
		if !TournamentLobbyOpen(*t) {
			return nil, ErrTournamentLocked
		}
		updates := bson.M{}
		for key, value := range supplied {
			updates[key] = value
		}
		if status, ok := updates["status"]; ok && status != t.Status {
			return nil, ErrTournamentLocked
		}
		if visibility, ok := updates["visibility"].(string); ok && visibility != t.Visibility {
			if visibility == models.VisibilityPrivate {
				code, err := GenerateTournamentInviteCode()
				if err != nil {
					return nil, err
				}
				updates["inviteCode"] = code
			} else {
				updates["inviteCode"] = ""
				now := time.Now().UTC()
				for index := range t.JoinRequests {
					request := &t.JoinRequests[index]
					if request.Status == models.JoinRequestPending {
						request.Status = models.JoinRequestRejected
						request.DecidedAt = &now
						request.DecidedBy = &actor
					}
				}
				updates["joinRequests"] = t.JoinRequests
			}
		}
		return updates, nil
	})
}

func (s TournamentService) DeleteLobby(ctx context.Context, id, actor primitive.ObjectID) error {
	if s.Collection == nil {
		return ErrTournamentUnavailable
	}
	var t models.Tournament
	if err := s.Collection.FindOne(ctx, bson.M{"_id": id}).Decode(&t); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return ErrTournamentNotFound
		}
		return err
	}
	if err := tournamentHostPermission(t, actor); err != nil {
		return err
	}
	if !TournamentLobbyOpen(t) {
		return ErrTournamentLocked
	}
	filter := tournamentRevisionFilter(t)
	filter["hostId"] = actor
	result, err := s.Collection.DeleteOne(ctx, filter)
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return ErrTournamentConflict
	}
	return nil
}
