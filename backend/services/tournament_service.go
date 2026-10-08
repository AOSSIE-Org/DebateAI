package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"time"

	"arguehub/db"
	"arguehub/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func getRoundName(roundNumber, totalRounds int) string {
	remaining := totalRounds - roundNumber + 1
	switch remaining {
	case 1:
		return "Finals"
	case 2:
		return "Semifinals"
	case 3:
		return "Quarterfinals"
	default:
		return fmt.Sprintf("Round %d", roundNumber)
	}
}

func CreateTournament(ctx context.Context, t *models.Tournament) (*models.Tournament, error) {
	if t.Title == "" {
		return nil, errors.New("tournament title is required")
	}
	if t.MaxParticipants < 2 {
		t.MaxParticipants = 8
	}
	if t.Format == "" {
		t.Format = models.FormatSingleElimination
	}

	t.ID = primitive.NewObjectID()
	t.Status = models.TournamentStatusRegistration
	t.CurrentRound = 0
	t.Participants = make([]models.TournamentParticipant, 0)
	t.Rounds = make([]models.TournamentRound, 0)
	t.CreatedAt = time.Now().UTC()
	t.UpdatedAt = time.Now().UTC()

	coll := db.GetCollection("tournaments")
	_, err := coll.InsertOne(ctx, t)
	if err != nil {
		return nil, fmt.Errorf("failed to insert tournament: %w", err)
	}

	return t, nil
}

func GetTournament(ctx context.Context, id primitive.ObjectID) (*models.Tournament, error) {
	coll := db.GetCollection("tournaments")
	var t models.Tournament
	err := coll.FindOne(ctx, bson.M{"_id": id}).Decode(&t)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func ListTournaments(ctx context.Context, status models.TournamentStatus) ([]models.Tournament, error) {
	coll := db.GetCollection("tournaments")
	filter := bson.M{}
	if status != "" {
		filter["status"] = status
	}

	opts := options.Find().SetSort(bson.M{"created_at": -1})
	cursor, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []models.Tournament
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = make([]models.Tournament, 0)
	}
	return list, nil
}

func RegisterParticipant(ctx context.Context, tournamentID primitive.ObjectID, p models.TournamentParticipant) error {
	coll := db.GetCollection("tournaments")
	var t models.Tournament
	if err := coll.FindOne(ctx, bson.M{"_id": tournamentID}).Decode(&t); err != nil {
		return errors.New("tournament not found")
	}

	if t.Status != models.TournamentStatusRegistration {
		return errors.New("registration is closed for this tournament")
	}

	if len(t.Participants) >= t.MaxParticipants {
		return errors.New("tournament participant limit reached")
	}

	for _, existing := range t.Participants {
		if existing.UserID == p.UserID {
			return errors.New("user is already registered in this tournament")
		}
	}

	p.Seed = len(t.Participants) + 1
	p.RegisteredAt = time.Now().UTC()
	p.Eliminated = false
	p.Score = 0

	update := bson.M{
		"$push": bson.M{"participants": p},
		"$set":  bson.M{"updated_at": time.Now().UTC()},
	}

	_, err := coll.UpdateOne(ctx, bson.M{"_id": tournamentID}, update)
	return err
}

func StartTournament(ctx context.Context, tournamentID primitive.ObjectID) (*models.Tournament, error) {
	coll := db.GetCollection("tournaments")
	var t models.Tournament
	if err := coll.FindOne(ctx, bson.M{"_id": tournamentID}).Decode(&t); err != nil {
		return nil, errors.New("tournament not found")
	}

	if t.Status != models.TournamentStatusRegistration {
		return nil, errors.New("tournament cannot be started in its current state")
	}

	n := len(t.Participants)
	if n < 2 {
		return nil, errors.New("at least 2 participants are required to start the tournament")
	}

	// Calculate total rounds needed for single elimination: ceil(log2(N))
	totalRounds := int(math.Ceil(math.Log2(float64(n))))
	t.TotalRounds = totalRounds
	t.CurrentRound = 1
	t.Status = models.TournamentStatusInProgress

	// Seed ordering
	sort.Slice(t.Participants, func(i, j int) bool {
		return t.Participants[i].Seed < t.Participants[j].Seed
	})

	bracketSize := int(math.Pow(2, float64(totalRounds)))
	rounds := make([]models.TournamentRound, totalRounds)

	for r := 1; r <= totalRounds; r++ {
		roundMatchesCount := bracketSize / int(math.Pow(2, float64(r)))
		roundStatus := "Pending"
		if r == 1 {
			roundStatus = "Active"
		}

		matches := make([]models.TournamentMatch, roundMatchesCount)
		for m := 0; m < roundMatchesCount; m++ {
			matches[m] = models.TournamentMatch{
				MatchID:     fmt.Sprintf("r%d_m%d", r, m+1),
				RoundNumber: r,
				MatchNumber: m + 1,
				Status:      models.MatchStatusScheduled,
				Topic:       t.Topic,
			}
		}

		rounds[r-1] = models.TournamentRound{
			RoundNumber: r,
			Name:        getRoundName(r, totalRounds),
			Status:      roundStatus,
			Matches:     matches,
		}
	}

	// Pair Round 1 using standard tournament seeding
	// 1 vs bracketSize, 2 vs bracketSize-1, etc.
	r1Matches := rounds[0].Matches
	for m := 0; m < len(r1Matches); m++ {
		p1Idx := m
		p2Idx := bracketSize - 1 - m

		if p1Idx < len(t.Participants) {
			p1 := t.Participants[p1Idx]
			r1Matches[m].Debater1 = &p1
		}
		if p2Idx < len(t.Participants) {
			p2 := t.Participants[p2Idx]
			r1Matches[m].Debater2 = &p2
		}

		// Handle Byes: If debater2 is nil, debater1 gets an automatic Bye to Round 2
		if r1Matches[m].Debater1 != nil && r1Matches[m].Debater2 == nil {
			r1Matches[m].Status = models.MatchStatusBye
			r1Matches[m].WinnerID = &r1Matches[m].Debater1.UserID
			now := time.Now().UTC()
			r1Matches[m].CompletedAt = &now

			// Place winner into Round 2 match
			if totalRounds > 1 {
				r2MatchIdx := m / 2
				if m%2 == 0 {
					rounds[1].Matches[r2MatchIdx].Debater1 = r1Matches[m].Debater1
				} else {
					rounds[1].Matches[r2MatchIdx].Debater2 = r1Matches[m].Debater1
				}
			}
		}
	}
	rounds[0].Matches = r1Matches
	t.Rounds = rounds
	t.UpdatedAt = time.Now().UTC()

	update := bson.M{
		"$set": bson.M{
			"status":        t.Status,
			"current_round": t.CurrentRound,
			"total_rounds":  t.TotalRounds,
			"rounds":        t.Rounds,
			"updated_at":    t.UpdatedAt,
		},
	}

	_, err := coll.UpdateOne(ctx, bson.M{"_id": tournamentID}, update)
	if err != nil {
		return nil, fmt.Errorf("failed to start tournament: %w", err)
	}

	return &t, nil
}

func ReportMatchResult(ctx context.Context, tournamentID primitive.ObjectID, matchID string, winnerID primitive.ObjectID, score1, score2 float64) (*models.Tournament, error) {
	coll := db.GetCollection("tournaments")
	var t models.Tournament
	if err := coll.FindOne(ctx, bson.M{"_id": tournamentID}).Decode(&t); err != nil {
		return nil, errors.New("tournament not found")
	}

	if t.Status != models.TournamentStatusInProgress {
		return nil, errors.New("tournament is not currently in progress")
	}

	currRoundIdx := t.CurrentRound - 1
	if currRoundIdx < 0 || currRoundIdx >= len(t.Rounds) {
		return nil, errors.New("invalid tournament round state")
	}

	var targetMatch *models.TournamentMatch
	var matchIdx int
	for idx, m := range t.Rounds[currRoundIdx].Matches {
		if m.MatchID == matchID {
			targetMatch = &t.Rounds[currRoundIdx].Matches[idx]
			matchIdx = idx
			break
		}
	}

	if targetMatch == nil {
		return nil, fmt.Errorf("match %s not found in active round %d", matchID, t.CurrentRound)
	}

	if targetMatch.Status == models.MatchStatusCompleted {
		return nil, errors.New("match has already been completed")
	}

	if targetMatch.Debater1 == nil || targetMatch.Debater2 == nil {
		return nil, errors.New("both debaters must be present to report match score")
	}

	if winnerID != targetMatch.Debater1.UserID && winnerID != targetMatch.Debater2.UserID {
		return nil, errors.New("winnerID does not match any debater in this match")
	}

	now := time.Now().UTC()
	targetMatch.WinnerID = &winnerID
	targetMatch.Score1 = score1
	targetMatch.Score2 = score2
	targetMatch.Status = models.MatchStatusCompleted
	targetMatch.CompletedAt = &now

	// Check if this winner advances to next round
	var winningDebater *models.TournamentParticipant
	var losingDebater *models.TournamentParticipant
	if winnerID == targetMatch.Debater1.UserID {
		winningDebater = targetMatch.Debater1
		losingDebater = targetMatch.Debater2
	} else {
		winningDebater = targetMatch.Debater2
		losingDebater = targetMatch.Debater1
	}

	// Mark loser eliminated in participants list
	for pIdx, p := range t.Participants {
		if p.UserID == losingDebater.UserID {
			t.Participants[pIdx].Eliminated = true
			break
		}
	}

	nextRoundIdx := currRoundIdx + 1
	if nextRoundIdx < len(t.Rounds) {
		nextMatchIdx := matchIdx / 2
		if matchIdx%2 == 0 {
			t.Rounds[nextRoundIdx].Matches[nextMatchIdx].Debater1 = winningDebater
		} else {
			t.Rounds[nextRoundIdx].Matches[nextMatchIdx].Debater2 = winningDebater
		}
	}

	// Check if all matches in current round are completed
	roundCompleted := true
	for _, m := range t.Rounds[currRoundIdx].Matches {
		if m.Status != models.MatchStatusCompleted && m.Status != models.MatchStatusBye {
			roundCompleted = false
			break
		}
	}

	if roundCompleted {
		t.Rounds[currRoundIdx].Status = "Completed"
		if nextRoundIdx < len(t.Rounds) {
			t.CurrentRound++
			t.Rounds[nextRoundIdx].Status = "Active"
		} else {
			// Tournament Complete!
			t.Status = models.TournamentStatusCompleted
			t.Winner = winningDebater
		}
	}

	t.UpdatedAt = time.Now().UTC()
	update := bson.M{
		"$set": bson.M{
			"status":        t.Status,
			"current_round": t.CurrentRound,
			"rounds":        t.Rounds,
			"participants":  t.Participants,
			"winner":        t.Winner,
			"updated_at":    t.UpdatedAt,
		},
	}

	_, err := coll.UpdateOne(ctx, bson.M{"_id": tournamentID}, update)
	if err != nil {
		return nil, fmt.Errorf("failed to update tournament: %w", err)
	}

	return &t, nil
}
