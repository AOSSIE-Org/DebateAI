package websocket

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"arguehub/db"
	"arguehub/models"
	"arguehub/services"
	"arguehub/utils"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"strings"
)

// TeamRoom represents a team debate room with connected team members
type TeamRoom struct {
	Clients     map[*websocket.Conn]*TeamClient
	Team1ID     primitive.ObjectID
	Team2ID     primitive.ObjectID
	DebateID    primitive.ObjectID
	Mutex       sync.Mutex
	TurnManager *services.TeamTurnManager
	TokenBucket *services.TokenBucketService
	// Room state for synchronization
	CurrentTopic string
	CurrentPhase string
	Team1Role    string
	Team2Role    string
	Team1Ready   map[string]bool // userId -> ready status
	Team2Ready   map[string]bool // userId -> ready status
}

// TeamClient represents a connected team member
type TeamClient struct {
	Conn         *websocket.Conn
	writeMu      sync.Mutex
	UserID       primitive.ObjectID
	Username     string
	Email        string
	TeamID       primitive.ObjectID
	IsTyping     bool
	IsSpeaking   bool
	PartialText  string
	LastActivity time.Time
	IsMuted      bool
	Role         string // "for" or "against"
	SpeechText   string
	Tokens       int // Remaining speaking tokens
}

// SafeWriteJSON safely writes JSON data to the team client's WebSocket connection
func (tc *TeamClient) SafeWriteJSON(v any) error {
	tc.writeMu.Lock()
	defer tc.writeMu.Unlock()
	return tc.Conn.WriteJSON(v)
}

// SafeWriteMessage safely writes raw WebSocket messages to the team client's connection
func (tc *TeamClient) SafeWriteMessage(messageType int, data []byte) error {
	tc.writeMu.Lock()
	defer tc.writeMu.Unlock()
	return tc.Conn.WriteMessage(messageType, data)
}

// TeamMessage represents a message in team debate
type TeamMessage struct {
	Type           string          `json:"type"`
	Room           string          `json:"room,omitempty"`
	Username       string          `json:"username,omitempty"`
	UserID         string          `json:"userId,omitempty"`
	Content        string          `json:"content,omitempty"`
	Extra          json.RawMessage `json:"extra,omitempty"`
	IsTyping       bool            `json:"isTyping,omitempty"`
	IsSpeaking     bool            `json:"isSpeaking,omitempty"`
	PartialText    string          `json:"partialText,omitempty"`
	Timestamp      int64           `json:"timestamp,omitempty"`
	Mode           string          `json:"mode,omitempty"`
	Phase          string          `json:"phase,omitempty"`
	Topic          string          `json:"topic,omitempty"`
	Role           string          `json:"role,omitempty"`
	Ready          *bool           `json:"ready,omitempty"`
	IsMuted        bool            `json:"isMuted,omitempty"`
	CurrentTurn    string          `json:"currentTurn,omitempty"`
	SpeechText     string          `json:"speechText,omitempty"`
	LiveTranscript string          `json:"liveTranscript,omitempty"`
	TeamID         string          `json:"teamId,omitempty"`
	Tokens         int             `json:"tokens,omitempty"`
	CanSpeak       bool            `json:"canSpeak,omitempty"`
}

var teamRooms = make(map[string]*TeamRoom)
var teamRoomsMutex sync.Mutex

// TeamWebsocketHandler handles WebSocket connections for team debates
func TeamWebsocketHandler(c *gin.Context) {
	authz := c.GetHeader("Authorization")
	token := strings.TrimPrefix(authz, "Bearer ")
	if token == "" {
		token = c.Query("token")
	}
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
		return
	}

	// Validate token
	valid, email, err := utils.ValidateTokenAndFetchEmail("./config/config.prod.yml", token, c)
	if err != nil || !valid || email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	debateID := c.Query("debateId")
	if debateID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing debateId parameter"})
		return
	}

	// Get user details from database
	userID, username, err := getUserDetails(email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user details"})
		return
	}

	userObjectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	debateObjectID, err := primitive.ObjectIDFromHex(debateID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid debate ID"})
		return
	}

	// Get team debate details
	debateCollection := db.MongoDatabase.Collection("team_debates")
	var debate models.TeamDebate
	err = debateCollection.FindOne(context.Background(), bson.M{"_id": debateObjectID}).Decode(&debate)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team debate not found"})
		return
	}

	// Check if user is part of either team
	teamCollection := db.MongoDatabase.Collection("teams")
	var userTeamID primitive.ObjectID
	// var isTeam1 bool

	// Check team 1
	var team1 models.Team
	err = teamCollection.FindOne(context.Background(), bson.M{
		"_id":            debate.Team1ID,
		"members.userId": userObjectID,
	}).Decode(&team1)
	if err == nil {
		userTeamID = debate.Team1ID
		// isTeam1 = true
	} else {
		// Check team 2
		var team2 models.Team
		err = teamCollection.FindOne(context.Background(), bson.M{
			"_id":            debate.Team2ID,
			"members.userId": userObjectID,
		}).Decode(&team2)
		if err == nil {
			userTeamID = debate.Team2ID
			// isTeam1 = false
		} else {
			c.JSON(http.StatusForbidden, gin.H{"error": "User is not part of either team"})
			return
		}
	}

	// Create or get team room
	teamRoomsMutex.Lock()
	roomKey := debateID
	if _, exists := teamRooms[roomKey]; !exists {
		turnManager := services.NewTeamTurnManager()
		tokenBucket := services.NewTokenBucketService()

		// Initialize turn management for both teams
		turnManager.InitializeTeamTurns(debate.Team1ID)
		turnManager.InitializeTeamTurns(debate.Team2ID)

		// Initialize token buckets for both teams
		tokenBucket.InitializeTeamBuckets(debate.Team1ID)
		tokenBucket.InitializeTeamBuckets(debate.Team2ID)

		teamRooms[roomKey] = &TeamRoom{
			Clients:      make(map[*websocket.Conn]*TeamClient),
			Team1ID:      debate.Team1ID,
			Team2ID:      debate.Team2ID,
			DebateID:     debateObjectID,
			TurnManager:  turnManager,
			TokenBucket:  tokenBucket,
			CurrentTopic: debate.Topic,
			CurrentPhase: "setup",
			Team1Role:    debate.Team1Stance,
			Team2Role:    debate.Team2Stance,
			Team1Ready:   make(map[string]bool),
			Team2Ready:   make(map[string]bool),
		}
	}
	room := teamRooms[roomKey]
	teamRoomsMutex.Unlock()

	// Upgrade the connection
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	// CRITICAL: Validate userTeamID matches one of the debate teams before creating client
	userTeamIDHex := userTeamID.Hex()
	team1IDHex := debate.Team1ID.Hex()
	team2IDHex := debate.Team2ID.Hex()

	if userTeamIDHex != team1IDHex && userTeamIDHex != team2IDHex {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Team assignment error"})
		conn.Close()
		return
	}

	// Create team client instance
	client := &TeamClient{
		Conn:         conn,
		UserID:       userObjectID,
		Username:     username,
		Email:        email,
		TeamID:       userTeamID, // This MUST match either debate.Team1ID or debate.Team2ID
		IsTyping:     false,
		IsSpeaking:   false,
		PartialText:  "",
		LastActivity: time.Now(),
		IsMuted:      false,
		Role:         "",
		SpeechText:   "",
		Tokens:       10, // Initial tokens
	}

	room.Mutex.Lock()
	room.Clients[conn] = client
	room.Mutex.Unlock()

	// Send initial team status
	teamStatus := room.TokenBucket.GetTeamSpeakingStatus(userTeamID, room.TurnManager)
	client.SafeWriteJSON(map[string]interface{}{
		"type":        "teamStatus",
		"teamStatus":  teamStatus,
		"currentTurn": room.TurnManager.GetCurrentTurn(userTeamID).Hex(),
		"tokens":      room.TokenBucket.GetRemainingTokens(userTeamID, userObjectID),
	})

	// Send current room state to new joiner
	room.Mutex.Lock()
	currentTopic := room.CurrentTopic
	currentPhase := room.CurrentPhase
	team1Role := room.Team1Role
	team2Role := room.Team2Role

	// Get ready counts for both teams and individual ready status
	team1ReadyCount := 0
	team1ReadyStatus := make(map[string]bool)
	for userId, ready := range room.Team1Ready {
		if ready {
			team1ReadyCount++
		}
		team1ReadyStatus[userId] = ready
	}

	team2ReadyCount := 0
	team2ReadyStatus := make(map[string]bool)
	for userId, ready := range room.Team2Ready {
		if ready {
			team2ReadyCount++
		}
		team2ReadyStatus[userId] = ready
	}
	room.Mutex.Unlock()

	// Send state sync message with individual ready status and team names
	client.SafeWriteJSON(map[string]interface{}{
		"type":              "stateSync",
		"topic":             currentTopic,
		"phase":             currentPhase,
		"team1Role":         team1Role,
		"team2Role":         team2Role,
		"team1Ready":        team1ReadyCount,
		"team2Ready":        team2ReadyCount,
		"team1MembersCount": len(debate.Team1Members),
		"team2MembersCount": len(debate.Team2Members),
		"team1ReadyStatus":  team1ReadyStatus, // Individual ready status for Team1
		"team2ReadyStatus":  team2ReadyStatus, // Individual ready status for Team2
		"team1Name":         debate.Team1Name, // Team names
		"team2Name":         debate.Team2Name,
	})

	// Send team member lists
	client.SafeWriteJSON(map[string]interface{}{
		"type":         "teamMembers",
		"team1Members": debate.Team1Members,
		"team2Members": debate.Team2Members,
	})

	// Listen for messages
	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			// Remove client from room
			room.Mutex.Lock()
			delete(room.Clients, conn)
			// If room is empty, delete it
			if len(room.Clients) == 0 {
				teamRoomsMutex.Lock()
				delete(teamRooms, roomKey)
				teamRoomsMutex.Unlock()
			}
			room.Mutex.Unlock()
			break
		}

		// Parse the message
		var message TeamMessage
		if err := json.Unmarshal(msg, &message); err != nil {
			continue
		}

		// Update client activity
		room.Mutex.Lock()
		if client, exists := room.Clients[conn]; exists {
			client.LastActivity = time.Now()
		}
		room.Mutex.Unlock()

		// Handle different message types
		switch message.Type {
		case "join":
			handleTeamJoin(room, conn, message, client, roomKey)
		case "message":
			handleTeamChatMessage(room, conn, message, client, roomKey)
		case "debateMessage":
			handleTeamDebateMessage(room, conn, message, client, roomKey)
		case "speaking":
			handleTeamSpeakingIndicator(room, conn, message, client, roomKey)
		case "speechText":
			handleTeamSpeechText(room, conn, message, client, roomKey)
		case "liveTranscript":
			handleTeamLiveTranscript(room, conn, message, client, roomKey)
		case "phaseChange":
			handleTeamPhaseChange(room, conn, message, roomKey)
		case "topicChange":
			handleTeamTopicChange(room, conn, message, roomKey)
		case "roleSelection":
			handleTeamRoleSelection(room, conn, message, roomKey)
		case "ready":
			handleTeamReadyStatus(room, conn, message, roomKey)
		case "checkStart":
			handleCheckStart(room, conn, roomKey)
		case "requestTurn":
			handleTeamTurnRequest(room, conn, message, client, roomKey)
		case "endTurn":
			handleTeamTurnEnd(room, conn, message, client, roomKey)
		default:
			// Broadcast the message to all other clients in the room
			for _, r := range snapshotTeamRecipients(room, conn) {
				if err := r.SafeWriteMessage(messageType, msg); err != nil {
				}
			}
		}
	}
}

// snapshotTeamRecipients returns a slice of team clients to send messages to, excluding the specified connection
func snapshotTeamRecipients(room *TeamRoom, exclude *websocket.Conn) []*TeamClient {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	out := make([]*TeamClient, 0, len(room.Clients))
	for cc, cl := range room.Clients {
		if cc != exclude {
			out = append(out, cl)
		}
	}
	return out
}

// handleTeamJoin handles team join messages
func handleTeamJoin(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
	// Send team status to all clients
	teamStatus := room.TokenBucket.GetTeamSpeakingStatus(client.TeamID, room.TurnManager)

	// Broadcast to all clients in the room
	for _, r := range room.Clients {
		response := map[string]interface{}{
			"type":        "teamStatus",
			"teamStatus":  teamStatus,
			"currentTurn": room.TurnManager.GetCurrentTurn(client.TeamID).Hex(),
		}
		if err := r.SafeWriteJSON(response); err != nil {
		}
	}
}

// handleTeamChatMessage handles team chat messages
func handleTeamChatMessage(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
	// Add timestamp if not provided
	if message.Timestamp == 0 {
		message.Timestamp = time.Now().Unix()
	}

	// Reset typing/speaking indicators
	room.Mutex.Lock()
	client.IsTyping = false
	client.IsSpeaking = false
	client.PartialText = ""
	room.Mutex.Unlock()

	// Broadcast to other clients in the same team
	for _, r := range snapshotTeamRecipients(room, conn) {
		if r.TeamID == client.TeamID {
			response := map[string]interface{}{
				"type":      "teamChatMessage",
				"userId":    client.UserID.Hex(),
				"username":  client.Username,
				"content":   message.Content,
				"timestamp": message.Timestamp,
				"teamId":    client.TeamID.Hex(),
			}
			if err := r.SafeWriteJSON(response); err != nil {
			}
		}
	}
}

// handleTeamDebateMessage handles debate messages
func handleTeamDebateMessage(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
	// Add timestamp if not provided
	if message.Timestamp == 0 {
		message.Timestamp = time.Now().Unix()
	}

	// Broadcast to all clients in the room
	for _, r := range snapshotTeamRecipients(room, conn) {
		response := map[string]interface{}{
			"type":      "debateMessage",
			"userId":    client.UserID.Hex(),
			"username":  client.Username,
			"content":   message.Content,
			"timestamp": message.Timestamp,
			"teamId":    client.TeamID.Hex(),
			"phase":     message.Phase,
		}
		if err := r.SafeWriteJSON(response); err != nil {
		}
	}
}

// handleTeamSpeakingIndicator handles speaking indicators
func handleTeamSpeakingIndicator(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
	room.Mutex.Lock()
	client.IsSpeaking = message.IsSpeaking
	room.Mutex.Unlock()

	// Broadcast speaking indicator to all clients
	for _, r := range snapshotTeamRecipients(room, conn) {
		response := map[string]interface{}{
			"type":       "speakingIndicator",
			"userId":     client.UserID.Hex(),
			"username":   client.Username,
			"isSpeaking": message.IsSpeaking,
			"teamId":     client.TeamID.Hex(),
		}
		if err := r.SafeWriteJSON(response); err != nil {
		}
	}
}

// handleTeamSpeechText handles speech-to-text conversion
func handleTeamSpeechText(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
	room.Mutex.Lock()
	client.SpeechText = message.SpeechText
	room.Mutex.Unlock()

	// Broadcast speech text to all clients
	for _, r := range snapshotTeamRecipients(room, conn) {
		response := map[string]interface{}{
			"type":       "speechText",
			"userId":     client.UserID.Hex(),
			"username":   client.Username,
			"speechText": client.SpeechText,
			"phase":      message.Phase,
			"teamId":     client.TeamID.Hex(),
		}
		if err := r.SafeWriteJSON(response); err != nil {
		}
	}
}

// handleTeamLiveTranscript handles live/interim transcript updates
func handleTeamLiveTranscript(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
	// Broadcast live transcript to all clients
	for _, r := range snapshotTeamRecipients(room, conn) {
		response := map[string]interface{}{
			"type":           "liveTranscript",
			"userId":         client.UserID.Hex(),
			"username":       client.Username,
			"liveTranscript": message.LiveTranscript,
			"phase":          message.Phase,
			"teamId":         client.TeamID.Hex(),
		}
		if err := r.SafeWriteJSON(response); err != nil {
		}
	}
}

// handleTeamPhaseChange handles phase changes
func handleTeamPhaseChange(room *TeamRoom, conn *websocket.Conn, message TeamMessage, roomKey string) {
	// Update room state
	room.Mutex.Lock()
	oldPhase := room.CurrentPhase
	if message.Phase != "" {
		room.CurrentPhase = message.Phase
	} else {
	}
	room.Mutex.Unlock()

	// Broadcast phase change to ALL clients (including sender for sync)
	phaseMessage := TeamMessage{
		Type:  "phaseChange",
		Phase: room.CurrentPhase,
	}
	for _, r := range room.Clients {
		if err := r.SafeWriteJSON(phaseMessage); err != nil {
		} else {
		}
	}
}

// handleTeamTopicChange handles topic changes
func handleTeamTopicChange(room *TeamRoom, conn *websocket.Conn, message TeamMessage, roomKey string) {
	// Update room state
	room.Mutex.Lock()
	if message.Topic != "" {
		room.CurrentTopic = message.Topic
	}
	room.Mutex.Unlock()

	// Broadcast topic change to ALL clients (including sender for sync)
	for _, r := range room.Clients {
		if err := r.SafeWriteJSON(message); err != nil {
		}
	}
}

// handleTeamRoleSelection handles role selection
func handleTeamRoleSelection(room *TeamRoom, conn *websocket.Conn, message TeamMessage, roomKey string) {
	// Store the role in the client and update room state
	room.Mutex.Lock()
	if client, exists := room.Clients[conn]; exists {
		client.Role = message.Role

		// Use Hex() comparison for reliability (same as ready status)
		clientTeamIDHex := client.TeamID.Hex()
		team1IDHex := room.Team1ID.Hex()
		team2IDHex := room.Team2ID.Hex()

		// Update team role based on which team the client belongs to
		if clientTeamIDHex == team1IDHex {
			room.Team1Role = message.Role
		} else if clientTeamIDHex == team2IDHex {
			room.Team2Role = message.Role
		} else {
		}

		// Broadcast role selection to ALL clients (including sender for sync)
		roleMessage := map[string]interface{}{
			"type":   "roleSelection",
			"role":   message.Role,
			"userId": client.UserID.Hex(),
			"teamId": client.TeamID.Hex(),
		}
		room.Mutex.Unlock()

		for _, r := range room.Clients {
			if err := r.SafeWriteJSON(roleMessage); err != nil {
			}
		}
	} else {
		room.Mutex.Unlock()
	}
}

// handleTeamReadyStatus handles ready status
func handleTeamReadyStatus(room *TeamRoom, conn *websocket.Conn, message TeamMessage, roomKey string) {
	// Update ready status in room state
	room.Mutex.Lock()
	client, exists := room.Clients[conn]
	if !exists {
		room.Mutex.Unlock()
		return
	}

	// Store client info before unlocking
	userID := client.UserID.Hex()
	clientTeamIDHex := client.TeamID.Hex()
	team1IDHex := room.Team1ID.Hex()
	team2IDHex := room.Team2ID.Hex()

	if message.Ready == nil {
		room.Mutex.Unlock()
		return
	}

	// CRITICAL: Assign ready status to the CORRECT team ONLY
	// Remove from wrong team first to prevent double assignment
	var assignedToTeam string

	// Remove user from the OTHER team's ready map first (cleanup)
	if clientTeamIDHex != team1IDHex {
		delete(room.Team1Ready, userID)
	}
	if clientTeamIDHex != team2IDHex {
		delete(room.Team2Ready, userID)
	}

	// Now assign to the CORRECT team
	if clientTeamIDHex == team1IDHex {
		// User belongs to Team 1 - assign ONLY to Team1Ready
		room.Team1Ready[userID] = *message.Ready
		assignedToTeam = "Team1"
	} else if clientTeamIDHex == team2IDHex {
		// User belongs to Team 2 - assign ONLY to Team2Ready
		room.Team2Ready[userID] = *message.Ready
		assignedToTeam = "Team2"
	} else {
		// CRITICAL ERROR: TeamID doesn't match - this should NEVER happen
		room.Mutex.Unlock()
		return
	}

	client.LastActivity = time.Now()

	// Keep mutex locked and calculate all counts accurately
	// Count ready members for each team
	currentTeam1ReadyCount := 0
	for _, ready := range room.Team1Ready {
		if ready {
			currentTeam1ReadyCount++
		}
	}
	currentTeam2ReadyCount := 0
	for _, ready := range room.Team2Ready {
		if ready {
			currentTeam2ReadyCount++
		}
	}

	// Count actual team members connected
	currentTeam1MembersCount := 0
	currentTeam2MembersCount := 0
	for _, c := range room.Clients {
		cTeamIDHex := c.TeamID.Hex()
		if cTeamIDHex == team1IDHex {
			currentTeam1MembersCount++
		} else if cTeamIDHex == team2IDHex {
			currentTeam2MembersCount++
		}
	}

	// Broadcast ready status with accurate counts to ALL clients
	readyMessage := map[string]interface{}{
		"type":              "ready",
		"ready":             message.Ready,
		"userId":            userID,
		"teamId":            clientTeamIDHex,
		"assignedToTeam":    assignedToTeam,
		"team1Ready":        currentTeam1ReadyCount,
		"team2Ready":        currentTeam2ReadyCount,
		"team1MembersCount": currentTeam1MembersCount, // Use accurate counts
		"team2MembersCount": currentTeam2MembersCount, // Use accurate counts
	}

	for _, r := range room.Clients {
		_ = r.SafeWriteJSON(readyMessage)
	}

	// Check if all teams are ready and phase is still setup
	allTeam1Ready := currentTeam1ReadyCount == currentTeam1MembersCount && currentTeam1MembersCount > 0
	allTeam2Ready := currentTeam2ReadyCount == currentTeam2MembersCount && currentTeam2MembersCount > 0
	allReady := allTeam1Ready && allTeam2Ready

	// Check if we should start countdown - use a flag to prevent multiple triggers
	shouldStartCountdown := allReady && room.CurrentPhase == "setup"

	// Check if countdown already started (phase is still setup but we have a flag in room)
	// We'll use a simple check: if phase is setup and all ready, start countdown
	if shouldStartCountdown {

		// Broadcast countdown start to ALL clients immediately
		countdownMessage := map[string]interface{}{
			"type":      "countdownStart",
			"countdown": 3,
		}
		for _, r := range room.Clients {
			_ = r.SafeWriteJSON(countdownMessage)
		}

		// Update phase immediately to prevent multiple triggers
		room.CurrentPhase = "countdown"

		// Start countdown and phase change after 3 seconds in a goroutine
		go func() {
			time.Sleep(3 * time.Second)

			teamRoomsMutex.Lock()
			room, stillExists := teamRooms[roomKey]
			teamRoomsMutex.Unlock()

			if !stillExists {
				return
			}

			room.Mutex.Lock()
			if room.CurrentPhase == "countdown" || room.CurrentPhase == "setup" {
				room.CurrentPhase = "openingFor"

				// Broadcast phase change to ALL clients using proper TeamMessage format
				phaseMessage := TeamMessage{
					Type:  "phaseChange",
					Phase: "openingFor",
				}
				for _, r := range room.Clients {
					if err := r.SafeWriteJSON(phaseMessage); err != nil {
					} else {
					}
				}
			} else {
			}
			room.Mutex.Unlock()
		}()
	} else {
	}

	room.Mutex.Unlock()
}

// handleTeamTurnRequest handles turn requests
func handleTeamTurnRequest(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
	// Check if user can speak
	canSpeak := room.TokenBucket.CanUserSpeak(client.TeamID, client.UserID, room.TurnManager)

	if canSpeak {
		// Update client tokens
		room.Mutex.Lock()
		client.Tokens = room.TokenBucket.GetRemainingTokens(client.TeamID, client.UserID)
		room.Mutex.Unlock()

		// Send turn granted response
		response := map[string]interface{}{
			"type":     "turnGranted",
			"userId":   client.UserID.Hex(),
			"username": client.Username,
			"tokens":   client.Tokens,
			"canSpeak": true,
		}
		client.SafeWriteJSON(response)

		// Broadcast turn status to all clients
		teamStatus := room.TokenBucket.GetTeamSpeakingStatus(client.TeamID, room.TurnManager)
		for _, r := range room.Clients {
			if r.TeamID == client.TeamID {
				response := map[string]interface{}{
					"type":        "teamStatus",
					"teamStatus":  teamStatus,
					"currentTurn": room.TurnManager.GetCurrentTurn(client.TeamID).Hex(),
				}
				if err := r.SafeWriteJSON(response); err != nil {
				}
			}
		}
	} else {
		// Send turn denied response
		response := map[string]interface{}{
			"type":     "turnDenied",
			"userId":   client.UserID.Hex(),
			"username": client.Username,
			"reason":   "No tokens available or not your turn",
		}
		client.SafeWriteJSON(response)
	}
}

// handleTeamTurnEnd handles turn end
func handleTeamTurnEnd(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
	// Advance to next turn
	nextUserID := room.TurnManager.NextTurn(client.TeamID)

	// Update team status
	teamStatus := room.TokenBucket.GetTeamSpeakingStatus(client.TeamID, room.TurnManager)

	// Broadcast turn change to all clients in the team
	for _, r := range room.Clients {
		if r.TeamID == client.TeamID {
			response := map[string]interface{}{
				"type":        "teamStatus",
				"teamStatus":  teamStatus,
				"currentTurn": nextUserID.Hex(),
			}
			if err := r.SafeWriteJSON(response); err != nil {
			}
		}
	}
}

// handleCheckStart checks if all teams are ready and starts debate
func handleCheckStart(room *TeamRoom, conn *websocket.Conn, roomKey string) {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()

	if room.CurrentPhase != "setup" {
		return
	}

	// Get team IDs
	team1IDHex := room.Team1ID.Hex()
	team2IDHex := room.Team2ID.Hex()

	// Count ready members for each team
	team1ReadyCount := 0
	for _, ready := range room.Team1Ready {
		if ready {
			team1ReadyCount++
		}
	}
	team2ReadyCount := 0
	for _, ready := range room.Team2Ready {
		if ready {
			team2ReadyCount++
		}
	}

	// Count actual team members connected
	team1MembersCount := 0
	team2MembersCount := 0
	for _, c := range room.Clients {
		cTeamIDHex := c.TeamID.Hex()
		if cTeamIDHex == team1IDHex {
			team1MembersCount++
		} else if cTeamIDHex == team2IDHex {
			team2MembersCount++
		}
	}

	allTeam1Ready := team1ReadyCount == team1MembersCount && team1MembersCount > 0
	allTeam2Ready := team2ReadyCount == team2MembersCount && team2MembersCount > 0
	allReady := allTeam1Ready && allTeam2Ready

	if allReady && room.CurrentPhase == "setup" {

		// Update phase to prevent multiple triggers
		room.CurrentPhase = "countdown"

		// Broadcast countdown start to ALL clients immediately
		countdownMessage := map[string]interface{}{
			"type":      "countdownStart",
			"countdown": 3,
		}
		for _, r := range room.Clients {
			_ = r.SafeWriteJSON(countdownMessage)
		}

		// Start countdown and phase change after 3 seconds
		go func() {
			time.Sleep(3 * time.Second)

			teamRoomsMutex.Lock()
			room, stillExists := teamRooms[roomKey]
			teamRoomsMutex.Unlock()

			if !stillExists {
				return
			}

			room.Mutex.Lock()
			if room.CurrentPhase == "countdown" || room.CurrentPhase == "setup" {
				room.CurrentPhase = "openingFor"

				// Broadcast phase change to ALL clients
				phaseMessage := TeamMessage{
					Type:  "phaseChange",
					Phase: "openingFor",
				}
				for _, r := range room.Clients {
					_ = r.SafeWriteJSON(phaseMessage)
				}
			}
			room.Mutex.Unlock()
		}()
	}
}
