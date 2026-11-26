package services

import (
	"context"
	"fmt"

	"arguehub/db"
	"arguehub/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RefreshTeamDebateMembers uses the current team roster and profile data instead
// of relying on the snapshots captured when the debate was created.
func RefreshTeamDebateMembers(ctx context.Context, debate *models.TeamDebate) error {
	teamCollection := db.MongoDatabase.Collection("teams")
	var team1, team2 models.Team
	if err := teamCollection.FindOne(ctx, bson.M{"_id": debate.Team1ID}).Decode(&team1); err != nil {
		return fmt.Errorf("failed to load debate team 1: %w", err)
	}
	if err := teamCollection.FindOne(ctx, bson.M{"_id": debate.Team2ID}).Decode(&team2); err != nil {
		return fmt.Errorf("failed to load debate team 2: %w", err)
	}

	members := append(append([]models.TeamMember{}, team1.Members...), team2.Members...)
	userIDs := make([]any, 0, len(members))
	for _, member := range members {
		userIDs = append(userIDs, member.UserID)
	}

	type profile struct {
		DisplayName string `bson:"displayName"`
		AvatarURL   string `bson:"avatarUrl"`
	}
	profiles := make(map[string]profile, len(members))
	if len(userIDs) > 0 {
		cursor, err := db.MongoDatabase.Collection("users").Find(ctx, bson.M{"_id": bson.M{"$in": userIDs}})
		if err != nil {
			return fmt.Errorf("failed to load debate member profiles: %w", err)
		}
		defer cursor.Close(ctx)

		var users []struct {
			ID          primitive.ObjectID `bson:"_id"`
			DisplayName string             `bson:"displayName"`
			AvatarURL   string             `bson:"avatarUrl"`
		}
		if err := cursor.All(ctx, &users); err != nil {
			return fmt.Errorf("failed to decode debate member profiles: %w", err)
		}
		for _, user := range users {
			profiles[user.ID.Hex()] = profile{DisplayName: user.DisplayName, AvatarURL: user.AvatarURL}
		}
	}

	refresh := func(roster []models.TeamMember) {
		for i := range roster {
			if current, ok := profiles[roster[i].UserID.Hex()]; ok {
				if current.DisplayName != "" {
					roster[i].DisplayName = current.DisplayName
				}
				roster[i].AvatarURL = current.AvatarURL
			}
		}
	}
	refresh(team1.Members)
	refresh(team2.Members)

	debate.Team1Name = team1.Name
	debate.Team2Name = team2.Name
	debate.Team1Members = team1.Members
	debate.Team2Members = team2.Members
	if debate.CurrentPhase == "" {
		debate.CurrentPhase = "setup"
	}
	if debate.Status == "finished" {
		debate.CurrentPhase = "finished"
	}
	return nil
}
