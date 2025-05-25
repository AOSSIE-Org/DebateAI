package routes

import (
	"context"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"arguehub/db"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Room represents a debate room.
type Room struct {
	ID           string        `json:"id" bson:"_id"`
	Type         string        `json:"type" bson:"type"`
	Participants []Participant `json:"participants" bson:"participants"`
}

// Participant represents a user in a room.
type Participant struct {
	ID       string `json:"id" bson:"id"`
	Username string `json:"username" bson:"username"`
	Elo      int    `json:"elo" bson:"elo"`
}

// generateRoomID creates a random six-digit room ID as a string.
func generateRoomID() string {
	rand.Seed(time.Now().UnixNano())
	return strconv.Itoa(rand.Intn(900000) + 100000)
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
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user email not found"})
		return
	}

	// Query user document using email
	userCollection := db.MongoClient.Database("DebateAI").Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user struct {
		ID          string `bson:"_id"`
		Email       string `bson:"email"`
		DisplayName string `bson:"displayName"`
		EloRating   int    `bson:"eloRating"`
	}

	err := userCollection.FindOne(ctx, bson.M{"email": userEmail}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Add the room creator as the first participant
	creatorParticipant := Participant{
		ID:       user.ID,
		Username: user.DisplayName,
		Elo:      user.EloRating,
	}

	roomID := generateRoomID()
	newRoom := Room{
		ID:           roomID,
		Type:         input.Type,
		Participants: []Participant{creatorParticipant},
	}

	roomCollection := db.MongoClient.Database("DebateAI").Collection("rooms")
	_, err = roomCollection.InsertOne(ctx, newRoom)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
		return
	}

	c.JSON(http.StatusOK, newRoom)
}


// GetRoomsHandler handles GET /rooms and returns all rooms.
func GetRoomsHandler(c *gin.Context) {
	log.Println("🔍 GetRoomsHandler called")

	collection := db.MongoClient.Database("DebateAI").Collection("rooms")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := collection.Find(ctx, bson.D{})
	if err != nil {
		log.Printf("❌ Error fetching rooms from DB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching rooms"})
		return
	}

	var rooms []Room
	if err = cursor.All(ctx, &rooms); err != nil {
		log.Printf("❌ Error decoding rooms cursor: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error decoding rooms"})
		return
	}

	log.Printf("✅ Successfully fetched %d rooms", len(rooms))
	c.JSON(http.StatusOK, rooms)
}

// JoinRoomHandler handles POST /rooms/:id/join where a user joins a room.
func JoinRoomHandler(c *gin.Context) {
	roomId := c.Param("id")
	collection := db.MongoClient.Database("DebateAI").Collection("rooms")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Dummy participant (replace this with actual user in production)
	dummyUser := Participant{
		ID:       "dummyUserID",
		Username: "JohnDoe",
		Elo:      1200,
	}

	filter := bson.M{"_id": roomId}
	update := bson.M{
		"$addToSet": bson.M{"participants": dummyUser},
	}
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)

	var updatedRoom Room
	if err := collection.FindOneAndUpdate(ctx, filter, update, opts).Decode(&updatedRoom); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not join room"})
		return
	}
	c.JSON(http.StatusOK, updatedRoom)
}
