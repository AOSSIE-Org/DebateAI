package controllers

import (
	"arguehub/db"
	"arguehub/models"
	"context"
	"crypto/rand"
	"errors"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)


func getUserIDFromContext(c *gin.Context) (primitive.ObjectID, error) {
	userIDRaw, exists := c.Get("userID")
	if !exists {
		return primitive.NilObjectID, mongo.ErrNoDocuments
	}
	userObjID, ok := userIDRaw.(primitive.ObjectID)
	if !ok {
		return primitive.NilObjectID, mongo.ErrNoDocuments
	}
	return userObjID, nil
}



func JoinPublicTournament(c *gin.Context) {
	tournamentID := c.Param("id")

	objID, err := primitive.ObjectIDFromHex(tournamentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	userObjID, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var tournament models.Tournament
	err = db.TournamentCollection.FindOne(
		context.Background(),
		bson.M{"_id": objID},
	).Decode(&tournament)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tournament"})
		return
	}

	if tournament.Visibility != "public" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This is a private tournament. Please use invite code."})
		return
	}

	displayName, _ := c.Get("displayName")
	name, _ := displayName.(string)

	newParticipant := models.TournamentParticipant{
		UserID: userObjID,
		Name:   name,
		Stance: "",
	}

	
	result, err := db.TournamentCollection.UpdateOne(
		context.Background(),
		bson.M{
			"_id":                 objID,
			"participants.userId": bson.M{"$ne": userObjID},
			"$expr": bson.M{
				"$lt": []interface{}{
					bson.M{"$size": "$participants"},
					"$maxParticipants",
				},
			},
		},
		bson.M{"$push": bson.M{"participants": newParticipant}},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join tournament"})
		return
	}

	if result.MatchedCount == 0 {
		if len(tournament.Participants) >= tournament.MaxParticipants {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tournament is full"})
			return
		}
		for _, p := range tournament.Participants {
			if p.UserID.Hex() == userObjID.Hex() {
				c.JSON(http.StatusBadRequest, gin.H{"error": "You are already in this tournament"})
				return
			}
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unable to join tournament"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Joined successfully",
		"tournamentId": tournamentID,
		"userId":       userObjID.Hex(),
	})
}



func JoinPrivateTournament(c *gin.Context) {
	var req struct {
		InviteCode string `json:"inviteCode" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invite code is required"})
		return
	}

	userObjID, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var tournament models.Tournament
	err = db.TournamentCollection.FindOne(
		context.Background(),
		bson.M{"inviteCode": req.InviteCode, "visibility": "private"},
	).Decode(&tournament)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Invalid invite code"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tournament"})
		return
	}

	if len(tournament.Participants) >= tournament.MaxParticipants {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tournament is full"})
		return
	}

	for _, p := range tournament.Participants {
		if p.UserID.Hex() == userObjID.Hex() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "You are already in this tournament"})
			return
		}
	}


	for _, r := range tournament.JoinRequests {
		if r.UserID.Hex() == userObjID.Hex() {
			if r.Status == "pending" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "You have already requested to join"})
				return
			}
			if r.Status == "approved" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Your request was already approved"})
				return
			}
			
			_, err = db.TournamentCollection.UpdateOne(
				context.Background(),
				bson.M{"_id": tournament.ID},
				bson.M{"$pull": bson.M{
					"joinRequests": bson.M{
						"userId": userObjID,
						"status": "rejected",
					},
				}},
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process request"})
				return
			}
			break
		}
	}

	displayName, _ := c.Get("displayName")
	name, _ := displayName.(string)

	newRequest := models.JoinRequest{
		UserID: userObjID,
		Name:   name,
		Status: "pending",
	}

	
	result, err := db.TournamentCollection.UpdateOne(
		context.Background(),
		bson.M{
			"_id":                 tournament.ID,
			"joinRequests.userId": bson.M{"$ne": userObjID},
		},
		bson.M{"$push": bson.M{"joinRequests": newRequest}},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send join request"})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You have already requested to join"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Request sent to moderator. Please wait for approval.",
		"tournamentId": tournament.ID.Hex(),
	})
}



func GetPendingRequests(c *gin.Context) {
	tournamentID := c.Param("id")

	objID, err := primitive.ObjectIDFromHex(tournamentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	userObjID, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var tournament models.Tournament
	err = db.TournamentCollection.FindOne(
		context.Background(),
		bson.M{"_id": objID, "hostId": userObjID},
	).Decode(&tournament)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusForbidden, gin.H{"error": "You are not the moderator of this tournament"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tournament"})
		return
	}

	var pendingRequests []models.JoinRequest
	for _, r := range tournament.JoinRequests {
		if r.Status == "pending" {
			pendingRequests = append(pendingRequests, r)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"pendingRequests": pendingRequests,
		"count":           len(pendingRequests),
		"tournamentId":    tournamentID,
		"participants":    len(tournament.Participants),
		"maxParticipants": tournament.MaxParticipants,
	})
}



func ChooseStance(c *gin.Context) {
	tournamentID := c.Param("id")

	var req struct {
		Stance string `json:"stance" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stance is required"})
		return
	}

	if req.Stance != "for" && req.Stance != "against" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stance must be 'for' or 'against'"})
		return
	}

	userObjID, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	objID, err := primitive.ObjectIDFromHex(tournamentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	var tournament models.Tournament
	err = db.TournamentCollection.FindOne(
		context.Background(),
		bson.M{"_id": objID},
	).Decode(&tournament)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tournament"})
		return
	}

	isParticipant := false
	for _, p := range tournament.Participants {
		if p.UserID.Hex() == userObjID.Hex() {
			isParticipant = true
			break
		}
	}

	if !isParticipant {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not a participant of this tournament"})
		return
	}

	_, err = db.TournamentCollection.UpdateOne(
		context.Background(),
		bson.M{
			"_id":                 objID,
			"participants.userId": userObjID,
		},
		bson.M{"$set": bson.M{"participants.$.stance": req.Stance}},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stance"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Stance updated successfully",
		"stance":  req.Stance,
	})
}



func ManageJoinRequest(c *gin.Context) {
	tournamentID := c.Param("id")
	requestUserID := c.Param("userId")

	var req struct {
		Action string `json:"action" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Action is required (approve/reject)"})
		return
	}

	if req.Action != "approve" && req.Action != "reject" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Action must be 'approve' or 'reject'"})
		return
	}

	objID, err := primitive.ObjectIDFromHex(tournamentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	requestUserObjID, err := primitive.ObjectIDFromHex(requestUserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	userObjID, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var tournament models.Tournament
	err = db.TournamentCollection.FindOne(
		context.Background(),
		bson.M{"_id": objID},
	).Decode(&tournament)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tournament"})
		return
	}


	if tournament.HostID.Hex() != userObjID.Hex() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only moderator can manage requests"})
		return
	}

	requestFound := false
	for _, r := range tournament.JoinRequests {
		if r.UserID.Hex() == requestUserObjID.Hex() && r.Status == "pending" {
			requestFound = true
			break
		}
	}

	if !requestFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pending request not found"})
		return
	}

	// ========== APPROVE ==========
	if req.Action == "approve" {
		if len(tournament.Participants) >= tournament.MaxParticipants {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Tournament is full. Cannot approve more requests."})
			return
		}

		
		var requestName string
		for _, r := range tournament.JoinRequests {
			if r.UserID.Hex() == requestUserObjID.Hex() {
				requestName = r.Name
				break
			}
		}

		newParticipant := models.TournamentParticipant{
			UserID: requestUserObjID,
			Name:   requestName,
			Stance: "",
		}

		result, err := db.TournamentCollection.UpdateOne(
			context.Background(),
			bson.M{
				"_id": objID,
				"joinRequests": bson.M{
					"$elemMatch": bson.M{"userId": requestUserObjID, "status": "pending"},
				},
				"participants.userId": bson.M{"$ne": requestUserObjID},
				"$expr": bson.M{
					"$lt": []interface{}{
						bson.M{"$size": "$participants"},
						"$maxParticipants",
					},
				},
			},
			bson.M{
				"$push": bson.M{"participants": newParticipant},
				"$set":  bson.M{"joinRequests.$[elem].status": "approved"},
			},
			options.Update().SetArrayFilters(options.ArrayFilters{
				Filters: []interface{}{
					bson.M{"elem.userId": requestUserObjID, "elem.status": "pending"},
				},
			}),
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve request"})
			return
		}

		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pending request not found or tournament is full"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Request approved successfully",
			"userId":  requestUserID,
			"action":  "approve",
		})
		return
	}

	// ========== REJECT ==========
	if req.Action == "reject" {
		result, err := db.TournamentCollection.UpdateOne(
			context.Background(),
			bson.M{
				"_id": objID,
				"joinRequests": bson.M{
					"$elemMatch": bson.M{"userId": requestUserObjID, "status": "pending"},
				},
			},
			bson.M{"$set": bson.M{"joinRequests.$[elem].status": "rejected"}},
			options.Update().SetArrayFilters(options.ArrayFilters{
				Filters: []interface{}{
					bson.M{"elem.userId": requestUserObjID, "elem.status": "pending"},
				},
			}),
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject request"})
			return
		}

		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pending request not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Request rejected successfully",
			"userId":  requestUserID,
			"action":  "reject",
		})
		return
	}
}



const maxTournamentParticipants = 11

// ---------- CREATE ----------

type CreateTournamentInput struct {
	Topic           string `json:"topic" binding:"required,max=100"`
	Description     string `json:"description" binding:"required,max=2000"`
	ModeratorName   string `json:"moderatorName" binding:"required,max=80"`
	Visibility      string `json:"visibility" binding:"required,oneof=public private"`
	Stance          string `json:"stance" binding:"required,oneof=for against"`
	MinParticipants int    `json:"minParticipants" binding:"required,min=3"`
	MaxParticipants int    `json:"maxParticipants" binding:"required"`
	StartType       string `json:"startType" binding:"required,oneof=direct scheduled"`
	ScheduleAt      string `json:"scheduleAt,omitempty"`
}

func generateInviteCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", err
	}
	return strconv.FormatInt(n.Int64()+100000, 10), nil
}

func CreateTournamentHandler(c *gin.Context) {
	var input CreateTournamentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.Topic = strings.TrimSpace(input.Topic)
	input.Description = strings.TrimSpace(input.Description)
	input.ModeratorName = strings.TrimSpace(input.ModeratorName)
	if input.Topic == "" || input.Description == "" || input.ModeratorName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Topic, description, and moderator name cannot be blank"})
		return
	}

	if input.MaxParticipants < input.MinParticipants {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Max must be >= min"})
		return
	}
	if input.MaxParticipants > maxTournamentParticipants {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Max cannot exceed 11"})
		return
	}

	userIDRaw, _ := c.Get("userID")
	displayNameRaw, _ := c.Get("displayName")

	userID, ok := userIDRaw.(primitive.ObjectID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user session"})
		return
	}

	hostName, hostNameOK := displayNameRaw.(string)
	if !hostNameOK || strings.TrimSpace(hostName) == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Please set your display name in your profile before creating a tournament.",
		})
		return
	}

	now := time.Now()
	tournament := models.Tournament{
		ID:              primitive.NewObjectID(),
		HostID:          userID,
		ModeratorName:   input.ModeratorName,
		Topic:           input.Topic,
		Description:     input.Description,
		Visibility:      input.Visibility,
		MinParticipants: input.MinParticipants,
		MaxParticipants: input.MaxParticipants,
		Participants: []models.TournamentParticipant{
			{
				UserID: userID,
				Name:   hostName,
				Stance: input.Stance,
			},
		},
		CreatedAt: now,
	}

	if input.StartType == "scheduled" {
		if input.ScheduleAt == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Schedule date required"})
			return
		}
		scheduledAt, err := time.Parse(time.RFC3339, input.ScheduleAt)
		if err != nil || !scheduledAt.After(now) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule date"})
			return
		}
		tournament.Status = models.StatusUpcoming
		tournament.ScheduleAt = &scheduledAt
	} else {
		tournament.Status = models.StatusLive
	}

	if input.Visibility == models.VisibilityPrivate {
		inviteCode, err := generateInviteCode()
		if err != nil {
			log.Printf("Failed to generate tournament invite code: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tournament invite code"})
			return
		}
		tournament.InviteCode = inviteCode
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	_, err := db.MongoDatabase.Collection("tournaments").InsertOne(ctx, tournament)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tournament"})
		return
	}

	c.JSON(http.StatusCreated, tournament)
}

// ---------- DELETE ----------

func DeleteTournamentHandler(c *gin.Context) {
	id := c.Param("id")
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	userIDRaw, _ := c.Get("userID")
	currentUserID, ok := userIDRaw.(primitive.ObjectID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	collection := db.MongoDatabase.Collection("tournaments")

	var tournament models.Tournament
	err = collection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&tournament)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tournament"})
		}
		return
	}

	if tournament.HostID != currentUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the host can delete this tournament"})
		return
	}

	result, err := collection.DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete tournament"})
		return
	}

	if result.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tournament deleted successfully"})
}

// ---------- RESPONSE HELPERS ----------

type TournamentResponse struct {
	ID              primitive.ObjectID             `json:"id"`
	HostID          primitive.ObjectID             `json:"hostId"`
	ModeratorName   string                         `json:"moderatorName"`
	Topic           string                         `json:"topic"`
	Description     string                         `json:"description"`
	Status          string                         `json:"status"`
	Visibility      string                         `json:"visibility"`
	MinParticipants int                            `json:"minParticipants"`
	MaxParticipants int                            `json:"maxParticipants"`
	Participants    []models.TournamentParticipant `json:"participants"`
	ScheduleAt      *time.Time                     `json:"scheduleAt,omitempty"`
	CreatedAt       time.Time                      `json:"createdAt"`
	InviteCode      string                         `json:"inviteCode,omitempty"`
	JoinRequests    []models.JoinRequest           `json:"joinRequests,omitempty"`
}

func toTournamentResponse(
	tournament models.Tournament,
	isHost bool,
) TournamentResponse {
	response := TournamentResponse{
		ID:              tournament.ID,
		HostID:          tournament.HostID,
		ModeratorName:   tournament.ModeratorName,
		Topic:           tournament.Topic,
		Description:     tournament.Description,
		Status:          tournament.Status,
		Visibility:      tournament.Visibility,
		MinParticipants: tournament.MinParticipants,
		MaxParticipants: tournament.MaxParticipants,
		Participants:    tournament.Participants,
		ScheduleAt:      tournament.ScheduleAt,
		CreatedAt:       tournament.CreatedAt,
	}

	if isHost {
		response.InviteCode = tournament.InviteCode
		response.JoinRequests = tournament.JoinRequests
	}

	return response
}

func getCurrentUserID(c *gin.Context) (primitive.ObjectID, bool) {
	userID, exists := c.Get("userID")
	if !exists {
		return primitive.NilObjectID, false
	}

	id, ok := userID.(primitive.ObjectID)
	return id, ok
}

// ---------- GET LIST ----------

func GetTournaments(c *gin.Context) {
	currentUserID, ok := getCurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	filter := bson.M{
		"$or": []bson.M{
			{"visibility": models.VisibilityPublic},
			{"hostId": currentUserID},
			{"participants.userId": currentUserID},
		},
	}

	if status := c.Query("status"); status != "" {
		switch status {
		case models.StatusLive, models.StatusUpcoming, models.StatusCompleted:
			filter["status"] = status
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament status"})
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	collection := db.MongoDatabase.Collection("tournaments")

	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve tournaments"})
		return
	}
	defer cursor.Close(ctx)

	tournaments := make([]models.Tournament, 0)
	if err := cursor.All(ctx, &tournaments); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve tournaments"})
		return
	}

	responses := make([]TournamentResponse, 0, len(tournaments))
	for _, tournament := range tournaments {
		responses = append(responses, toTournamentResponse(
			tournament,
			tournament.HostID == currentUserID,
		))
	}

	c.JSON(http.StatusOK, responses)
}

// ---------- GET BY ID ----------

func GetTournamentByID(c *gin.Context) {
	currentUserID, ok := getCurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	collection := db.MongoDatabase.Collection("tournaments")

	var tournament models.Tournament
	err = collection.FindOne(ctx, bson.M{"_id": id}).Decode(&tournament)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve tournament"})
		}
		return
	}

	isHost := tournament.HostID == currentUserID
	isParticipant := false

	for _, participant := range tournament.Participants {
		if participant.UserID == currentUserID {
			isParticipant = true
			break
		}
	}

	if tournament.Visibility == models.VisibilityPrivate && !isHost && !isParticipant {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
		return
	}

	c.JSON(http.StatusOK, toTournamentResponse(tournament, isHost))
}

// ---------- UPDATE ----------

type UpdateTournamentInput struct {
	Topic         *string `json:"topic"`
	Description   *string `json:"description"`
	ModeratorName *string `json:"moderatorName"`
	Visibility    *string `json:"visibility"`
	Status        *string `json:"status"`
	ScheduleAt    *string `json:"scheduleAt"`
}

func UpdateTournamentHandler(c *gin.Context) {
	id := c.Param("id")
	tournamentID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
		return
	}

	userIDRaw, exists := c.Get("userID")
	currentUserID, ok := userIDRaw.(primitive.ObjectID)
	if !exists || !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	var input UpdateTournamentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	updates := bson.M{}

	if input.Topic != nil {
		value := strings.TrimSpace(*input.Topic)
		if value == "" || len(value) > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Topic must be between 1 and 100 characters"})
			return
		}
		updates["topic"] = value
	}

	if input.Description != nil {
		value := strings.TrimSpace(*input.Description)
		if value == "" || len(value) > 2000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Description must be between 1 and 2000 characters"})
			return
		}
		updates["description"] = value
	}

	if input.ModeratorName != nil {
		value := strings.TrimSpace(*input.ModeratorName)
		if value == "" || len(value) > 80 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Moderator name must be between 1 and 80 characters"})
			return
		}
		updates["moderatorName"] = value
	}

	if input.Visibility != nil {
		switch *input.Visibility {
		case models.VisibilityPublic, models.VisibilityPrivate:
			updates["visibility"] = *input.Visibility
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament visibility"})
			return
		}
	}

	if input.Status != nil {
		switch *input.Status {
		case models.StatusUpcoming, models.StatusLive, models.StatusCompleted:
			updates["status"] = *input.Status
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament status"})
			return
		}
	}

	if input.ScheduleAt != nil {
		scheduledAt, err := time.Parse(time.RFC3339, *input.ScheduleAt)
		if err != nil || !scheduledAt.After(time.Now()) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Schedule must be a valid future RFC3339 timestamp"})
			return
		}
		updates["scheduleAt"] = scheduledAt
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provide at least one valid field to update"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	collection := db.MongoDatabase.Collection("tournaments")

	var tournament models.Tournament
	err = collection.FindOne(ctx, bson.M{"_id": tournamentID}).Decode(&tournament)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tournament"})
		}
		return
	}

	if tournament.HostID != currentUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the host can update this tournament"})
		return
	}

	result, err := collection.UpdateOne(
		ctx,
		bson.M{
			"_id":    tournamentID,
			"hostId": currentUserID,
		},
		bson.M{"$set": updates},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tournament"})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
		return
	}

	err = collection.FindOne(ctx, bson.M{"_id": tournamentID}).Decode(&tournament)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Tournament updated, but failed to retrieve it"})
		return
	}

	c.JSON(http.StatusOK, tournament)
}
