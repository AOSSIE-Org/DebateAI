package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

var ErrDebateNotFound = errors.New("debate not found")
var ErrDebateAlreadySettled = errors.New("debate already settled")

type BotDebateSettlement struct {
	Debate         models.DebateVsBot
	ResultStatus   string
	AlreadySettled bool
}

// SettleBotDebate atomically settles a debate and awards its points.
// outcome should be "win", "loss", or "draw".
// judgment is the validated judgment JSON; pass an empty string for concession.

func SettleBotDebate(
	ctx context.Context,
	debateID primitive.ObjectID,
	email string,
	outcome string,
	judgment string,
) (*BotDebateSettlement, error) {
	if MongoClient == nil || MongoDatabase == nil || DebateVsBotCollection == nil {
		return nil, errors.New("MongoDB is not initialized")
	}

	if outcome != "win" && outcome != "loss" && outcome != "draw" {
		return nil, fmt.Errorf("invalid debate outcome %q", outcome)
	}

	session, err := MongoClient.StartSession()
	if err != nil {
		return nil, fmt.Errorf("start settlement session: %w", err)
	}
	defer session.EndSession(ctx)

	value, err := session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
		var debate models.DebateVsBot
		err := DebateVsBotCollection.FindOne(
			sc,
			bson.M{"_id": debateID, "email": email},
		).Decode(&debate)

		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrDebateNotFound
		}
		if err != nil {
			return nil, err
		}

		isConcession := judgment == ""

		if !debate.SettledAt.IsZero() || debate.Judgment != "" ||
			(debate.Outcome != "" && debate.Outcome != "pending") {
			// Only the same kind of operation is idempotent.
			if isConcession && debate.Outcome == "User conceded" && debate.Judgment == "" {
				return &BotDebateSettlement{
					Debate:         debate,
					ResultStatus:   "loss",
					AlreadySettled: true,
				}, nil
			}

			// A repeated judge request is idempotent only when its outcome
			// matches the outcome recorded by the original judgment.
			if !isConcession && debate.Judgment != "" {
				storedOutcome := outcomeFromStoredDebate(debate)

				if storedOutcome == "" || storedOutcome != outcome {
					return nil, ErrDebateAlreadySettled
				}

				return &BotDebateSettlement{
					Debate:         debate,
					ResultStatus:   storedOutcome,
					AlreadySettled: true,
				}, nil
			}

			return nil, ErrDebateAlreadySettled
		}

		now := time.Now()
		storedOutcome := outcome
		if isConcession {
			storedOutcome = "User conceded"
		}

		filter := bson.M{
			"_id":   debateID,
			"email": email,
			"$or": bson.A{
				bson.M{"outcome": ""},
				bson.M{"outcome": "pending"},
				bson.M{"outcome": bson.M{"$exists": false}},
			},
			"judgment":  bson.M{"$in": bson.A{"", nil}},
			"settledAt": bson.M{"$exists": false},
		}

		updateResult, err := DebateVsBotCollection.UpdateOne(sc, filter, bson.M{
			"$set": bson.M{
				"outcome":   storedOutcome,
				"judgment":  judgment,
				"settledAt": now,
			},
		})
		if err != nil {
			return nil, err
		}
		if updateResult.MatchedCount != 1 {
			return nil, ErrDebateAlreadySettled
		}

		points := 10
		action := "debate_loss"
		switch outcome {
		case "win":
			points, action = 50, "debate_win"
		case "draw":
			points, action = 25, "debate_complete"
		}

		users := MongoDatabase.Collection("users")
		var user models.User
		if err := users.FindOne(sc, bson.M{"email": email}).Decode(&user); err != nil {
			return nil, fmt.Errorf("find debate owner: %w", err)
		}

		userResult, err := users.UpdateOne(sc, bson.M{"_id": user.ID}, bson.M{
			"$inc": bson.M{"score": points},
			"$set": bson.M{"updatedAt": now},
		})
		if err != nil {
			return nil, err
		}
		if userResult.MatchedCount != 1 {
			return nil, errors.New("user not found while settling debate")
		}

		scoreUpdate := models.ScoreUpdate{
			ID:        primitive.NewObjectID(),
			UserID:    user.ID,
			DebateID:  debateID.Hex(),
			Points:    points,
			Action:    action,
			CreatedAt: now,
			Metadata: map[string]interface{}{
				"debateType": "user_vs_bot",
				"topic":      debate.Topic,
				"result":     outcome,
			},
		}

		if _, err := MongoDatabase.Collection("score_updates").InsertOne(sc, scoreUpdate); err != nil {
			return nil, fmt.Errorf("insert debate score update: %w", err)
		}

		debate.Outcome = storedOutcome
		debate.Judgment = judgment
		debate.SettledAt = now

		return &BotDebateSettlement{
			Debate:       debate,
			ResultStatus: outcome,
		}, nil
	})
	if err != nil {
		return nil, err
	}

	settlement, ok := value.(*BotDebateSettlement)
	if !ok || settlement == nil {
		return nil, errors.New("transaction returned an invalid settlement result")
	}
	return settlement, nil
}

func outcomeFromStoredDebate(debate models.DebateVsBot) string {
	if debate.Outcome == "User conceded" {
		return "loss"
	}

	if debate.Judgment != "" {
		var result struct {
			Verdict struct {
				Winner string `json:"winner"`
			} `json:"verdict"`
		}

		if err := json.Unmarshal([]byte(debate.Judgment), &result); err == nil {
			switch strings.ToLower(strings.TrimSpace(result.Verdict.Winner)) {
			case "user":
				return "win"
			case "bot":
				return "loss"
			case "draw":
				return "draw"
			}
		}
	}

	switch strings.ToLower(strings.TrimSpace(debate.Outcome)) {
	case "win", "user wins":
		return "win"
	case "loss", "bot wins":
		return "loss"
	case "draw":
		return "draw"
	default:
		return ""
	}
}
