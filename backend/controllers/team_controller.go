package controllers

import (
	"context"
	cryptoRand "crypto/rand"
	"math/big"
	"net/http"
	"strings"
	"time"

	"arguehub/db"
	"arguehub/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// generateTeamCode generates a unique 6-character team code
func generateTeamCode() string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 6)
	for i := range b {
		n, err := cryptoRand.Int(cryptoRand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			// Fallback to time-based selection if cryptographic random fails
			idx := (time.Now().UnixNano() + int64(i)) % int64(len(charset))
			b[i] = charset[int(idx)]
			continue
		}
		b[i] = charset[n.Int64()]
	}
	return string(b)
}

// GetTeamByCode retrieves a team by its unique code
func GetTeamByCode(c *gin.Context) {
	code := c.Param("code")

	collection := db.GetCollection("teams")
	var team models.Team
	err := collection.FindOne(context.Background(), bson.M{"code": strings.ToUpper(code)}).Decode(&team)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Team not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve team"})
		return
	}

	c.JSON(http.StatusOK, team)
}

// UpdateTeamName updates the team name (captain only)
func UpdateTeamName(c *gin.Context) {
	teamID := c.Param("teamId")
	objectID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	var updateData struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get team
	collection := db.GetCollection("teams")
	var team models.Team
	err = collection.FindOne(context.Background(), bson.M{"_id": objectID}).Decode(&team)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team not found"})
		return
	}

	// Check if user is captain
	if team.CaptainID != userID.(primitive.ObjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the captain can update the team"})
		return
	}

	// Update team name
	update := bson.M{
		"$set": bson.M{
			"name":      updateData.Name,
			"updatedAt": time.Now(),
		},
	}

	_, err = collection.UpdateOne(context.Background(), bson.M{"_id": objectID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update team name"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team name updated successfully"})
}

// UpdateTeamSize updates the team max size (captain only)
func UpdateTeamSize(c *gin.Context) {
	teamID := c.Param("teamId")
	objectID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	var updateData struct {
		MaxSize int `json:"maxSize" binding:"required"`
	}

	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate maxSize (only 2 or 4 allowed)
	if updateData.MaxSize != 2 && updateData.MaxSize != 4 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Max size must be either 2 or 4"})
		return
	}

	// Get user from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get team
	collection := db.GetCollection("teams")
	var team models.Team
	err = collection.FindOne(context.Background(), bson.M{"_id": objectID}).Decode(&team)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team not found"})
		return
	}

	// Check if user is captain
	if team.CaptainID != userID.(primitive.ObjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the captain can update the team"})
		return
	}

	// Check if current member count is less than or equal to new maxSize
	if len(team.Members) > updateData.MaxSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot reduce team size below current member count. Remove members first."})
		return
	}

	// Update team size
	update := bson.M{
		"$set": bson.M{
			"maxSize":   updateData.MaxSize,
			"updatedAt": time.Now(),
		},
	}

	_, err = collection.UpdateOne(context.Background(), bson.M{"_id": objectID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update team size"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team size updated successfully"})
}

// CreateTeam creates a new team
func CreateTeam(c *gin.Context) {
	var team models.Team
	if err := c.ShouldBindJSON(&team); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userEmail, exists := c.Get("email")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User email not found"})
		return
	}

	// Check if user is already in a team
	collection := db.GetCollection("teams")
	var existingTeam models.Team
	err := collection.FindOne(context.Background(), bson.M{
		"members.userId": userID.(primitive.ObjectID),
	}).Decode(&existingTeam)
	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You are already in a team. Leave your current team before creating a new one."})
		return
	}
	if err != nil && err != mongo.ErrNoDocuments {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify existing team membership"})
		return
	}

	// Set captain information
	team.CaptainID = userID.(primitive.ObjectID)
	team.CaptainEmail = userEmail.(string)
	team.CreatedAt = time.Now()
	team.UpdatedAt = time.Now()

	// Set default maxSize if not provided (only 2 or 4)
	if team.MaxSize == 0 {
		team.MaxSize = 4 // Default to 4 members
	}
	if team.MaxSize != 2 && team.MaxSize != 4 {
		team.MaxSize = 4 // Force to 4 if invalid
	}

	// Add captain as first member
	captainMember := models.TeamMember{
		UserID:      team.CaptainID,
		Email:       team.CaptainEmail,
		DisplayName: c.GetString("displayName"),
		AvatarURL:   c.GetString("avatarUrl"),
		Elo:         c.GetFloat64("rating"),
		JoinedAt:    time.Now(),
	}
	team.Members = []models.TeamMember{captainMember}

	// Calculate average Elo
	team.AverageElo = captainMember.Elo

	// Generate unique team code (6 characters)
	team.Code = generateTeamCode()

	// Insert team into database
	result, err := collection.InsertOne(context.Background(), team)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create team"})
		return
	}

	team.ID = result.InsertedID.(primitive.ObjectID)
	c.JSON(http.StatusCreated, team)
}

// GetTeam retrieves a team by ID
func GetTeam(c *gin.Context) {
	teamID := c.Param("id")
	objectID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	collection := db.GetCollection("teams")
	var team models.Team
	err = collection.FindOne(context.Background(), bson.M{"_id": objectID}).Decode(&team)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Team not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve team"})
		return
	}

	c.JSON(http.StatusOK, team)
}

// JoinTeam allows a user to join a team
func JoinTeam(c *gin.Context) {
	teamID := c.Param("id")
	objectID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	// Get user from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userEmail, exists := c.Get("email")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User email not found"})
		return
	}

	// Check if user is already in a team
	collection := db.GetCollection("teams")
	var existingTeam models.Team
	err = collection.FindOne(context.Background(), bson.M{
		"members.userId": userID.(primitive.ObjectID),
	}).Decode(&existingTeam)
	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is already in a team"})
		return
	}
	if err != nil && err != mongo.ErrNoDocuments {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify existing team membership"})
		return
	}

	// Get user details
	userCollection := db.GetCollection("users")
	var user models.User
	err = userCollection.FindOne(context.Background(), bson.M{"_id": userID.(primitive.ObjectID)}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user details"})
		return
	}

	// Create new member
	newMember := models.TeamMember{
		UserID:      userID.(primitive.ObjectID),
		Email:       userEmail.(string),
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
		Elo:         user.Rating,
		JoinedAt:    time.Now(),
	}

	// Add member to team and recalculate average Elo
	update := bson.M{
		"$push": bson.M{"members": newMember},
		"$set":  bson.M{"updatedAt": time.Now()},
	}

	// First, get current team to calculate new average
	var team models.Team
	err = collection.FindOne(context.Background(), bson.M{"_id": objectID}).Decode(&team)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team not found"})
		return
	}

	capacity := team.MaxSize
	if capacity <= 0 {
		capacity = 4
	}

	if len(team.Members) >= capacity {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team is already full"})
		return
	}

	// Calculate new average Elo
	totalElo := 0.0
	for _, member := range team.Members {
		totalElo += member.Elo
	}
<<<<<<< HEAD
	if len(team.Members) >= team.MaxSize {
=======
	capacity := team.MaxSize
	if capacity <= 0 {
		capacity = 4
	}
	if len(team.Members) >= capacity {
>>>>>>> main
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team is already full"})
		return
	}
	totalElo += newMember.Elo
	newAverageElo := totalElo / float64(len(team.Members)+1)

	update["$set"].(bson.M)["averageElo"] = newAverageElo

	_, err = collection.UpdateOne(context.Background(), bson.M{"_id": objectID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join team"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully joined team"})
}

// LeaveTeam allows a user to leave a team
func LeaveTeam(c *gin.Context) {
	teamID := c.Param("id")
	objectID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	// Get user from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	collection := db.GetCollection("teams")

	// Check if user is captain
	var team models.Team
	err = collection.FindOne(context.Background(), bson.M{"_id": objectID}).Decode(&team)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team not found"})
		return
	}

	if team.CaptainID == userID.(primitive.ObjectID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Captain cannot leave team. Transfer captaincy first."})
		return
	}

	// Remove member and recalculate average Elo
	update := bson.M{
		"$pull": bson.M{"members": bson.M{"userId": userID.(primitive.ObjectID)}},
		"$set":  bson.M{"updatedAt": time.Now()},
	}

	// Calculate new average Elo
	totalElo := 0.0
	memberCount := 0
	for _, member := range team.Members {
		if member.UserID != userID.(primitive.ObjectID) {
			totalElo += member.Elo
			memberCount++
		}
	}

	if memberCount > 0 {
		newAverageElo := totalElo / float64(memberCount)
		update["$set"].(bson.M)["averageElo"] = newAverageElo
	}

	_, err = collection.UpdateOne(context.Background(), bson.M{"_id": objectID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to leave team"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully left team"})
}

// GetUserTeams retrieves all teams a user is part of
func GetUserTeams(c *gin.Context) {
	// Get user from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	collection := db.GetCollection("teams")
	cursor, err := collection.Find(context.Background(), bson.M{
		"members.userId": userID.(primitive.ObjectID),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve teams"})
		return
	}
	defer cursor.Close(context.Background())

	var teams []models.Team
	if err = cursor.All(context.Background(), &teams); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode teams"})
		return
	}

	c.JSON(http.StatusOK, teams)
}

// RemoveMember removes a member from a team (captain only)
func RemoveMember(c *gin.Context) {
	teamID := c.Param("teamId")
	objectID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	memberID := c.Param("memberId")
	memberObjectID, err := primitive.ObjectIDFromHex(memberID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
		return
	}

	// Get user from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get team
	collection := db.GetCollection("teams")
	var team models.Team
	err = collection.FindOne(context.Background(), bson.M{"_id": objectID}).Decode(&team)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team not found"})
		return
	}

	// Check if user is captain
	if team.CaptainID != userID.(primitive.ObjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the captain can remove members"})
		return
	}

	// Prevent captain from removing themselves
	if memberObjectID == team.CaptainID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Captain cannot remove themselves. Delete the team instead."})
		return
	}

	// Remove member and recalculate average Elo
	update := bson.M{
		"$pull": bson.M{"members": bson.M{"userId": memberObjectID}},
		"$set":  bson.M{"updatedAt": time.Now()},
	}

	// Calculate new average Elo
	totalElo := 0.0
	memberCount := 0
	for _, member := range team.Members {
		if member.UserID != memberObjectID {
			totalElo += member.Elo
			memberCount++
		}
	}

	if memberCount > 0 {
		newAverageElo := totalElo / float64(memberCount)
		update["$set"].(bson.M)["averageElo"] = newAverageElo
	}

	_, err = collection.UpdateOne(context.Background(), bson.M{"_id": objectID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}

// DeleteTeam deletes a team (captain only)
func DeleteTeam(c *gin.Context) {
	teamID := c.Param("teamId")
	objectID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID"})
		return
	}

	// Get user from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get team
	collection := db.GetCollection("teams")
	var team models.Team
	err = collection.FindOne(context.Background(), bson.M{"_id": objectID}).Decode(&team)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team not found"})
		return
	}

	// Check if user is captain
	if team.CaptainID != userID.(primitive.ObjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the captain can delete the team"})
		return
	}

	// Delete team
	_, err = collection.DeleteOne(context.Background(), bson.M{"_id": objectID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete team"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team deleted successfully"})
}

// GetTeamMemberProfile gets a team member's profile details
func GetTeamMemberProfile(c *gin.Context) {
	memberID := c.Param("memberId")
	memberObjectID, err := primitive.ObjectIDFromHex(memberID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
		return
	}

	// Get user from database
	userCollection := db.GetCollection("users")
	var member models.User
	err = userCollection.FindOne(context.Background(), bson.M{"_id": memberObjectID}).Decode(&member)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          member.ID.Hex(),
		"email":       member.Email,
		"displayName": member.DisplayName,
		"avatarUrl":   member.AvatarURL,
		"rating":      member.Rating,
		"rd":          member.RD,
		"bio":         member.Bio,
	})
}

// GetAvailableTeams retrieves teams that are open for joining
func GetAvailableTeams(c *gin.Context) {
	collection := db.GetCollection("teams")
	cursor, err := collection.Find(context.Background(), bson.M{
		"$expr": bson.M{
<<<<<<< HEAD
		"$lt": []interface{}{
			bson.M{"$size": "$members"},
			"$maxSize",
		},
	},
=======
			"$lt": bson.A{
				bson.M{"$size": "$members"},
				"$maxSize",
			},
		},
>>>>>>> main
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve teams"})
		return
	}
	defer cursor.Close(context.Background())

	var teams []models.Team
	if err = cursor.All(context.Background(), &teams); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode teams"})
		return
	}

	c.JSON(http.StatusOK, teams)
}
