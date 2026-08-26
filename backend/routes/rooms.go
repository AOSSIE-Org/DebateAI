package routes

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"math"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Room represents a debate room.
type Room struct {
	ID              string        `json:"id" bson:"_id"`
	Type            string        `json:"type" bson:"type"`
	OwnerID         string        `json:"ownerId" bson:"ownerId"`
	Participants    []Participant `json:"participants" bson:"participants"`
	InviteToken     string        `json:"inviteToken,omitempty" bson:"inviteToken,omitempty"`
	Topic           string        `json:"topic,omitempty" bson:"topic,omitempty"`
	InvitedUsername string        `json:"invitedUsername,omitempty" bson:"invitedUsername,omitempty"`
	RematchOfRoomID string        `json:"rematchOfRoomId,omitempty" bson:"rematchOfRoomId,omitempty"`
}

// Participant represents a user in a room.
type Participant struct {
	ID        string `json:"id" bson:"id"`
	Username  string `json:"username" bson:"username"`
	Elo       int    `json:"elo" bson:"elo"`
	AvatarURL string `json:"avatarUrl" bson:"avatarUrl,omitempty"`
	Email     string `json:"email" bson:"email,omitempty"`
}

// generateRoomID creates a random six-digit room ID as a string.
func generateRoomID() string {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return strconv.FormatInt(time.Now().UnixNano()%900000+100000, 10)
	}
	return strconv.Itoa(int(n.Int64()) + 100000)
}

func generateInviteToken() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return hex.EncodeToString(b)
}

type roomUser struct {
	ID          primitive.ObjectID `bson:"_id"`
	Email       string             `bson:"email"`
	DisplayName string             `bson:"displayName"`
	Rating      float64            `bson:"rating"`
	AvatarURL   string             `bson:"avatarUrl"`
}

func fetchUserByEmail(ctx context.Context, email string) (roomUser, error) {
	userCollection := db.MongoDatabase.Collection("users")
	var user roomUser
	err := userCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	return user, err
}

func userToParticipant(user roomUser) Participant {
	return Participant{
		ID:        user.ID.Hex(),
		Username:  user.DisplayName,
		Elo:       int(math.Round(user.Rating)),
		AvatarURL: user.AvatarURL,
		Email:     user.Email,
	}
}

// CreateRoomHandler handles POST /rooms and creates a new debate room.
// CreateRoomHandler handles POST /rooms and creates a new debate room.
func CreateRoomHandler(c *gin.Context) {
	type CreateRoomInput struct {
		Type string `json:"type"` // public, private, invite
	}

	var input CreateRoomInput
	if err := c.ShouldBindJSON(&input); err != nil || input.Type == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// Get user email from middleware-set context
	email, exists := c.Get("email")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user email not found"})
		return
	}

	// Query user document using email
	userCollection := db.MongoDatabase.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user struct {
		ID          primitive.ObjectID `bson:"_id"`
		Email       string             `bson:"email"`
		DisplayName string             `bson:"displayName"`
		Rating      float64            `bson:"rating"`
		AvatarURL   string             `bson:"avatarUrl"`
	}

	err := userCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Add the room creator as the first participant
	creatorParticipant := Participant{
		ID:        user.ID.Hex(),
		Username:  user.DisplayName,
		Elo:       int(math.Round(user.Rating)),
		AvatarURL: user.AvatarURL,
		Email:     user.Email,
	}

	roomID := generateRoomID()
	newRoom := Room{
		ID:           roomID,
		Type:         input.Type,
		OwnerID:      creatorParticipant.ID,
		Participants: []Participant{creatorParticipant},
	}

	roomCollection := db.MongoDatabase.Collection("rooms")
	_, err = roomCollection.InsertOne(ctx, newRoom)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
		return
	}

	c.JSON(http.StatusOK, newRoom)
}

// GetRoomsHandler handles GET /rooms and returns all rooms.
func GetRoomsHandler(c *gin.Context) {

	collection := db.MongoDatabase.Collection("rooms")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := collection.Find(ctx, bson.M{"type": bson.M{"$ne": "invite"}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching rooms"})
		return
	}

	var rooms []Room
	if err = cursor.All(ctx, &rooms); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error decoding rooms"})
		return
	}

	c.JSON(http.StatusOK, rooms)
}

// JoinRoomHandler handles POST /rooms/:id/join where a user joins a room.
func JoinRoomHandler(c *gin.Context) {
	roomId := c.Param("id")

	type JoinRoomInput struct {
		InviteToken string `json:"inviteToken"`
	}
	var input JoinRoomInput
	_ = c.ShouldBindJSON(&input)

	email, exists := c.Get("email")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user email not found"})
		return
	}

	emailStr, ok := email.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid email format"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	user, err := fetchUserByEmail(ctx, emailStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	participant := userToParticipant(user)

	roomCollection := db.MongoDatabase.Collection("rooms")
	var room Room
	if err := roomCollection.FindOne(ctx, bson.M{"_id": roomId}).Decode(&room); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	alreadyIn := false
	for _, p := range room.Participants {
		if p.ID == participant.ID {
			alreadyIn = true
			break
		}
	}

	if room.InviteToken != "" && !alreadyIn {
		if input.InviteToken == "" || input.InviteToken != room.InviteToken {
			c.JSON(http.StatusForbidden, gin.H{"error": "Invalid invite token"})
			return
		}
		if room.InvitedUsername != "" && !strings.EqualFold(strings.TrimSpace(user.DisplayName), room.InvitedUsername) {
			c.JSON(http.StatusForbidden, gin.H{"error": "This challenge was sent to another user"})
			return
		}

		filter := bson.M{
			"_id":         roomId,
			"inviteToken": input.InviteToken,
			"$expr": bson.M{
				"$lt": []interface{}{bson.M{"$size": "$participants"}, 2},
			},
		}
		update := bson.M{
			"$addToSet": bson.M{"participants": participant},
		}
		opts := options.FindOneAndUpdate().SetReturnDocument(options.After)

		var updatedRoom Room
		if err := roomCollection.FindOneAndUpdate(ctx, filter, update, opts).Decode(&updatedRoom); err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusConflict, gin.H{"error": "Room is full"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not join room"})
			return
		}

		matchmakingService := services.GetMatchmakingService()
		matchmakingService.RemoveFromPool(user.ID.Hex())

		c.JSON(http.StatusOK, updatedRoom)
		return
	}

	if alreadyIn {
		c.JSON(http.StatusOK, room)
		return
	}

	filter := bson.M{"_id": roomId}
	update := bson.M{
		"$addToSet": bson.M{"participants": participant},
	}
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)

	var updatedRoom Room
	if err := roomCollection.FindOneAndUpdate(ctx, filter, update, opts).Decode(&updatedRoom); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not join room"})
		return
	}

	matchmakingService := services.GetMatchmakingService()
	matchmakingService.RemoveFromPool(user.ID.Hex())

	c.JSON(http.StatusOK, updatedRoom)
}

// GetRoomParticipantsHandler handles GET /rooms/:id/participants and returns the participants of a room.
func GetRoomParticipantsHandler(c *gin.Context) {
	roomId := c.Param("id")

	// Get user email from middleware-set context
	email, exists := c.Get("email")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user email not found"})
		return
	}

	// Query room document
	roomCollection := db.MongoDatabase.Collection("rooms")
	userCollection := db.MongoDatabase.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var room Room
	err := roomCollection.FindOne(ctx, bson.M{"_id": roomId}).Decode(&room)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	// Get user ID from email
	emailStr, ok := email.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid email format"})
		return
	}

	var user struct {
		ID primitive.ObjectID `bson:"_id"`
	}
	err = userCollection.FindOne(ctx, bson.M{"email": emailStr}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Check if user is a participant in this room
	isParticipant := false
	for _, participant := range room.Participants {
		if participant.ID == user.ID.Hex() {
			isParticipant = true
			break
		}
	}

	if !isParticipant {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not a participant in this room"})
		return
	}

	// Prepare email list for batch lookup
	emailSet := make(map[string]struct{})
	for _, participant := range room.Participants {
		if participant.Email != "" {
			emailSet[participant.Email] = struct{}{}
		}
	}

	emailList := make([]string, 0, len(emailSet))
	for addr := range emailSet {
		emailList = append(emailList, addr)
	}

	type userDetails struct {
		Email       string  `bson:"email"`
		DisplayName string  `bson:"displayName"`
		Rating      float64 `bson:"rating"`
		AvatarURL   string  `bson:"avatarUrl"`
	}
	userMap := make(map[string]userDetails, len(emailList))

	if len(emailList) > 0 {
		cursor, err := userCollection.Find(ctx, bson.M{"email": bson.M{"$in": emailList}})
		if err == nil {
			var users []userDetails
			if err := cursor.All(ctx, &users); err == nil {
				for _, u := range users {
					userMap[u.Email] = u
				}
			}
		}
	}

	// Get full user details for each participant
	var participantsWithDetails []gin.H

	for _, participant := range room.Participants {
		avatarURL := participant.AvatarURL
		if avatarURL == "" {
			avatarURL = "https://api.dicebear.com/9.x/adventurer/svg?seed=" + participant.ID
		}

		displayName := participant.Username
		elo := participant.Elo

		if participant.Email != "" {
			if details, found := userMap[participant.Email]; found {
				if details.DisplayName != "" {
					displayName = details.DisplayName
				}
				if details.AvatarURL != "" {
					avatarURL = details.AvatarURL
				}
				if details.Rating != 0 {
					elo = int(math.Round(details.Rating))
				}
			}
		}

		participantsWithDetails = append(participantsWithDetails, gin.H{
			"id":          participant.ID,
			"username":    displayName,
			"displayName": displayName,
			"elo":         elo,
			"avatarUrl":   avatarURL,
		})
	}

	ownerID := room.OwnerID
	if ownerID == "" && len(room.Participants) > 0 {
		ownerID = room.Participants[0].ID
	}

	c.JSON(http.StatusOK, gin.H{
		"ownerId":      ownerID,
		"participants": participantsWithDetails,
	})
}

// CreateChallengeHandler handles POST /rooms/challenge.
func CreateChallengeHandler(c *gin.Context) {
	type CreateChallengeInput struct {
		OpponentUsername string `json:"opponentUsername"`
		Topic            string `json:"topic"`
	}

	var input CreateChallengeInput
	if err := c.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.Topic) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Topic is required"})
		return
	}

	email, exists := c.Get("email")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user email not found"})
		return
	}

	emailStr, ok := email.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid email format"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	user, err := fetchUserByEmail(ctx, emailStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	opponentUsername := strings.TrimSpace(input.OpponentUsername)
	if opponentUsername != "" {
		if strings.EqualFold(opponentUsername, strings.TrimSpace(user.DisplayName)) {
			opponentUsername = ""
		} else {
			userCollection := db.MongoDatabase.Collection("users")
			var opponent roomUser
			if err := userCollection.FindOne(ctx, bson.M{"displayName": opponentUsername}).Decode(&opponent); err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Opponent not found. Leave blank to share link with anyone."})
				return
			}
			if opponent.ID == user.ID {
				opponentUsername = ""
			}
		}
	}

	creatorParticipant := userToParticipant(user)
	inviteToken := generateInviteToken()
	roomID := generateRoomID()

	newRoom := Room{
		ID:              roomID,
		Type:            "invite",
		OwnerID:         creatorParticipant.ID,
		Participants:    []Participant{creatorParticipant},
		InviteToken:     inviteToken,
		Topic:           strings.TrimSpace(input.Topic),
		InvitedUsername: opponentUsername,
	}

	roomCollection := db.MongoDatabase.Collection("rooms")
	if _, err := roomCollection.InsertOne(ctx, newRoom); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create challenge room"})
		return
	}

	c.JSON(http.StatusOK, newRoom)
}

// RematchHandler handles POST /rooms/:id/rematch.
func RematchHandler(c *gin.Context) {
	roomId := c.Param("id")

	email, exists := c.Get("email")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user email not found"})
		return
	}

	emailStr, ok := email.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid email format"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	user, err := fetchUserByEmail(ctx, emailStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	roomCollection := db.MongoDatabase.Collection("rooms")
	var room Room
	if err := roomCollection.FindOne(ctx, bson.M{"_id": roomId}).Decode(&room); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	if room.InviteToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Rematch is only available for challenge rooms"})
		return
	}

	wasParticipant := false
	for _, p := range room.Participants {
		if p.ID == user.ID.Hex() {
			wasParticipant = true
			break
		}
	}
	if !wasParticipant {
		c.JSON(http.StatusForbidden, gin.H{"error": "You were not in this challenge"})
		return
	}

	var existingRematch Room
	if err := roomCollection.FindOne(ctx, bson.M{"rematchOfRoomId": roomId}).Decode(&existingRematch); err == nil {
		c.JSON(http.StatusOK, existingRematch)
		return
	}

	rematchParticipants := make([]Participant, len(room.Participants))
	copy(rematchParticipants, room.Participants)

	newRoom := Room{
		ID:              generateRoomID(),
		Type:            "invite",
		OwnerID:         user.ID.Hex(),
		Participants:    rematchParticipants,
		InviteToken:     generateInviteToken(),
		Topic:           room.Topic,
		RematchOfRoomID: roomId,
	}

	if _, err := roomCollection.InsertOne(ctx, newRoom); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create rematch room"})
		return
	}

	c.JSON(http.StatusOK, newRoom)
}
