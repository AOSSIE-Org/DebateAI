package websocket

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strings"
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
)

// TeamRoom represents a team debate room with connected team members
type TeamRoom struct {
	Clients      map[*websocket.Conn]*TeamClient
	Team1ID      primitive.ObjectID
	Team2ID      primitive.ObjectID
	DebateID     primitive.ObjectID
	Mutex        sync.Mutex
	TurnManager  *services.TeamTurnManager
	TokenBucket  *services.TokenBucketService
	CurrentTopic string
	CurrentPhase string
	Team1Role    string
	Team2Role    string
	Team1Ready   map[string]bool
	Team2Ready   map[string]bool
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
	Role         string
	SpeechText   string
	Tokens       int
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
	FromUserID     string          `json:"fromUserId,omitempty"`
	TargetUserID   string          `json:"targetUserId,omitempty"`
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
	Offer          map[string]any  `json:"offer,omitempty"`
	Answer         map[string]any  `json:"answer,omitempty"`
	Candidate      map[string]any  `json:"candidate,omitempty"`
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
		log.Println("Team WebSocket connection failed: missing token")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
		return
	}

	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "./config/config.yml"
	}
	valid, email, err := utils.ValidateTokenAndFetchEmail(configPath, token, c)
	if err != nil || !valid || email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	debateID := c.Query("debateId")
	if debateID == "" {
		log.Println("Team WebSocket connection failed: missing debateId parameter")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing debateId parameter"})
		return
	}

	userID, username, _, _, err := getUserDetails(email)
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

	debateCollection := db.MongoDatabase.Collection("team_debates")
	var debate models.TeamDebate
	err = debateCollection.FindOne(context.Background(), bson.M{"_id": debateObjectID}).Decode(&debate)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Team debate not found"})
		return
	}

	teamCollection := db.MongoDatabase.Collection("teams")
	var userTeamID primitive.ObjectID

	var team1 models.Team
	err = teamCollection.FindOne(context.Background(), bson.M{
		"_id":            debate.Team1ID,
		"members.userId": userObjectID,
	}).Decode(&team1)
	if err == nil {
		userTeamID = debate.Team1ID
	} else {
		var team2 models.Team
		err = teamCollection.FindOne(context.Background(), bson.M{
			"_id":            debate.Team2ID,
			"members.userId": userObjectID,
		}).Decode(&team2)
		if err == nil {
			userTeamID = debate.Team2ID
		} else {
			c.JSON(http.StatusForbidden, gin.H{"error": "User is not part of either team"})
			return
		}
	}

	roomKey := debateID
	turnManager := services.NewTeamTurnManager()
	tokenBucket := services.NewTokenBucketService()

	turnErr1 := turnManager.InitializeTeamTurns(debate.Team1ID)
	turnErr2 := turnManager.InitializeTeamTurns(debate.Team2ID)
	bucketErr1 := tokenBucket.InitializeTeamBuckets(debate.Team1ID)
	bucketErr2 := tokenBucket.InitializeTeamBuckets(debate.Team2ID)

	if turnErr1 != nil || turnErr2 != nil || bucketErr1 != nil || bucketErr2 != nil {
		log.Printf("error initializing room resources: %v %v %v %v", turnErr1, turnErr2, bucketErr1, bucketErr2)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize room resources"})
		return
	}

	preparedRoom := &TeamRoom{
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

	teamRoomsMutex.Lock()
	room, exists := teamRooms[roomKey]
	if !exists {
		teamRooms[roomKey] = preparedRoom
		room = preparedRoom
	}
	teamRoomsMutex.Unlock()

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("Team WebSocket upgrade error:", err)
		return
	}

	userTeamIDHex := userTeamID.Hex()
	team1IDHex := debate.Team1ID.Hex()
	team2IDHex := debate.Team2ID.Hex()

	if userTeamIDHex != team1IDHex && userTeamIDHex != team2IDHex {
		log.Printf("[TeamWebsocketHandler] ❌ ERROR: UserTeamID %s doesn't match Team1ID %s or Team2ID %s", userTeamIDHex, team1IDHex, team2IDHex)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Team assignment error"})
		conn.Close()
		return
	}

	log.Printf("[TeamWebsocketHandler] ✓ User %s belongs to team %s (Team1=%s, Team2=%s)", userObjectID.Hex(), userTeamIDHex, team1IDHex, team2IDHex)

	client := &TeamClient{
		Conn:         conn,
		UserID:       userObjectID,
		Username:     username,
		Email:        email,
		TeamID:       userTeamID,
		IsTyping:     false,
		IsSpeaking:   false,
		PartialText:  "",
		LastActivity: time.Now(),
		IsMuted:      false,
		Role:         "",
		SpeechText:   "",
		Tokens:       10,
	}

	room.Mutex.Lock()
	room.Clients[conn] = client
	room.Mutex.Unlock()

	// ✅ FIX: Broadcast memberJoined to all OTHER clients already in the room.
	// When Member 2 connects, Member 1's frontend receives this event and can
	// update the member count immediately without waiting for an HTTP poll cycle.
	room.Mutex.Lock()
	membersCount := len(room.Clients)
	room.Mutex.Unlock()

	broadcastExcept(room, conn, map[string]any{
		"type":         "memberJoined",
		"userId":       userObjectID.Hex(),
		"username":     username,
		"teamId":       userTeamID.Hex(),
		"membersCount": membersCount,
	})

	// Send initial team status to the newly connected client
	teamStatus, statusErr := room.TokenBucket.GetTeamSpeakingStatus(userTeamID, room.TurnManager)
	if statusErr != nil {
		log.Printf("failed to load team status for team %s: %v", userTeamID.Hex(), statusErr)
		teamStatus = map[string]interface{}{}
	}
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

	team1ReadyCount := 0
	team1ReadyStatus := make(map[string]bool)
	for uID, ready := range room.Team1Ready {
		if ready {
			team1ReadyCount++
		}
		team1ReadyStatus[uID] = ready
	}

	team2ReadyCount := 0
	team2ReadyStatus := make(map[string]bool)
	for uID, ready := range room.Team2Ready {
		if ready {
			team2ReadyCount++
		}
		team2ReadyStatus[uID] = ready
	}
	room.Mutex.Unlock()

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
		"team1ReadyStatus":  team1ReadyStatus,
		"team2ReadyStatus":  team2ReadyStatus,
		"team1Name":         debate.Team1Name,
		"team2Name":         debate.Team2Name,
	})

	client.SafeWriteJSON(map[string]interface{}{
		"type":         "teamMembers",
		"team1Members": debate.Team1Members,
		"team2Members": debate.Team2Members,
	})

	// Message loop
	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			leaveUserID := client.UserID.Hex()
			room.Mutex.Lock()
			delete(room.Clients, conn)
			if len(room.Clients) == 0 {
				teamRoomsMutex.Lock()
				delete(teamRooms, roomKey)
				teamRoomsMutex.Unlock()
			}
			room.Mutex.Unlock()

			broadcastExcept(room, conn, map[string]any{
				"type":   "leave",
				"userId": leaveUserID,
			})
			break
		}

		var message TeamMessage
		if err := json.Unmarshal(msg, &message); err != nil {
			continue
		}

		message.FromUserID = client.UserID.Hex()
		message.UserID = client.UserID.Hex()
		if message.TeamID == "" {
			message.TeamID = client.TeamID.Hex()
		}

		room.Mutex.Lock()
		if c, exists := room.Clients[conn]; exists {
			c.LastActivity = time.Now()
		}
		room.Mutex.Unlock()

		switch message.Type {
		case "join":
			handleTeamJoin(room, message, client, roomKey)
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
			handleTeamPhaseChange(room, message, roomKey)
		case "topicChange":
			handleTeamTopicChange(room, message, roomKey)
		case "roleSelection":
			handleTeamRoleSelection(room, conn, message, roomKey)
		case "ready":
			handleTeamReadyStatus(room, conn, message, roomKey)
		case "checkStart":
			handleCheckStart(room, roomKey)
		case "requestTurn":
			handleTeamTurnRequest(room, message, client, roomKey)
		case "endTurn":
			handleTeamTurnEnd(room, message, client, roomKey)
		case "offer":
			handleTeamWebRTCOffer(room, client, message)
		case "answer":
			handleTeamWebRTCAnswer(room, client, message)
		case "candidate":
			handleTeamWebRTCCandidate(room, client, message)
		case "leave":
			handleTeamLeave(room, client, roomKey)
		default:
			for _, r := range snapshotTeamRecipients(room, conn) {
				if err := r.SafeWriteMessage(messageType, msg); err != nil {
					log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
				}
			}
		}
	}
}

// snapshotTeamRecipients returns a slice of team clients excluding the specified connection
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

// findClientByUserID returns the TeamClient matching the provided user ID
func findClientByUserID(room *TeamRoom, userID string) *TeamClient {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	for _, client := range room.Clients {
		if client.UserID.Hex() == userID {
			return client
		}
	}
	return nil
}

// sendMessageToUser sends a payload as JSON to the specified user if connected
func sendMessageToUser(room *TeamRoom, userID string, payload any) error {
	target := findClientByUserID(room, userID)
	if target == nil {
		return errors.New("target user not connected")
	}
	return target.SafeWriteJSON(payload)
}

// broadcastExcept sends a payload to every client except the provided connection
func broadcastExcept(room *TeamRoom, exclude *websocket.Conn, payload any) {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	for conn, client := range room.Clients {
		if conn == exclude {
			continue
		}
		if err := client.SafeWriteJSON(payload); err != nil {
			log.Printf("Team WebSocket write error: %v", err)
		}
	}
}

// broadcastAll sends identical payload to every connected client
func broadcastAll(room *TeamRoom, payload any) {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	for _, client := range room.Clients {
		if err := client.SafeWriteJSON(payload); err != nil {
			log.Printf("Team WebSocket write error: %v", err)
		}
	}
}

// handleTeamJoin handles team join messages
// conn param removed — not used in this handler
func handleTeamJoin(room *TeamRoom, message TeamMessage, client *TeamClient, roomKey string) {
	teamStatus, statusErr := room.TokenBucket.GetTeamSpeakingStatus(client.TeamID, room.TurnManager)
	if statusErr != nil {
		log.Printf("failed to load team status for team %s: %v", client.TeamID.Hex(), statusErr)
		teamStatus = map[string]interface{}{}
	}

	recipients := snapshotTeamRecipients(room, nil)
	for _, r := range recipients {
		response := map[string]interface{}{
			"type":        "teamStatus",
			"teamStatus":  teamStatus,
			"currentTurn": room.TurnManager.GetCurrentTurn(client.TeamID).Hex(),
		}
		if err := r.SafeWriteJSON(response); err != nil {
			log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
		}
	}
}

// handleTeamChatMessage handles team chat messages
func handleTeamChatMessage(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
	if message.Timestamp == 0 {
		message.Timestamp = time.Now().Unix()
	}

	room.Mutex.Lock()
	client.IsTyping = false
	client.IsSpeaking = false
	client.PartialText = ""
	room.Mutex.Unlock()

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
				log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
			}
		}
	}
}

// handleTeamDebateMessage handles debate messages
func handleTeamDebateMessage(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
	if message.Timestamp == 0 {
		message.Timestamp = time.Now().Unix()
	}

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
			log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
		}
	}
}

// handleTeamSpeakingIndicator handles speaking indicators
func handleTeamSpeakingIndicator(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
	room.Mutex.Lock()
	client.IsSpeaking = message.IsSpeaking
	room.Mutex.Unlock()

	for _, r := range snapshotTeamRecipients(room, conn) {
		response := map[string]interface{}{
			"type":       "speakingIndicator",
			"userId":     client.UserID.Hex(),
			"username":   client.Username,
			"isSpeaking": message.IsSpeaking,
			"teamId":     client.TeamID.Hex(),
		}
		if err := r.SafeWriteJSON(response); err != nil {
			log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
		}
	}
}

// handleTeamSpeechText handles speech-to-text conversion
func handleTeamSpeechText(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
	room.Mutex.Lock()
	client.SpeechText = message.SpeechText
	room.Mutex.Unlock()

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
			log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
		}
	}
}

// handleTeamLiveTranscript handles live/interim transcript updates
func handleTeamLiveTranscript(room *TeamRoom, conn *websocket.Conn, message TeamMessage, client *TeamClient, roomKey string) {
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
			log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
		}
	}
}

// handleTeamPhaseChange handles phase changes
// conn param removed — not used in this handler
func handleTeamPhaseChange(room *TeamRoom, message TeamMessage, roomKey string) {
	room.Mutex.Lock()
	oldPhase := room.CurrentPhase
	if message.Phase != "" {
		room.CurrentPhase = message.Phase
		log.Printf("[handleTeamPhaseChange] Phase changed from %s to %s", oldPhase, room.CurrentPhase)
	} else {
		log.Printf("[handleTeamPhaseChange] Received phase change message but Phase is empty")
	}
	currentPhase := room.CurrentPhase
	room.Mutex.Unlock()

	phaseMessage := TeamMessage{
		Type:  "phaseChange",
		Phase: currentPhase,
	}
	for _, r := range snapshotTeamRecipients(room, nil) {
		if err := r.SafeWriteJSON(phaseMessage); err != nil {
			log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
		} else {
			log.Printf("[handleTeamPhaseChange] ✓ Phase change broadcasted: %s", currentPhase)
		}
	}
}

// handleTeamTopicChange handles topic changes
// conn param removed — not used in this handler
func handleTeamTopicChange(room *TeamRoom, message TeamMessage, roomKey string) {
	room.Mutex.Lock()
	if message.Topic != "" {
		room.CurrentTopic = message.Topic
	}
	room.Mutex.Unlock()

	for _, r := range snapshotTeamRecipients(room, nil) {
		if err := r.SafeWriteJSON(message); err != nil {
			log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
		}
	}
}

// handleTeamRoleSelection handles role selection
func handleTeamRoleSelection(room *TeamRoom, conn *websocket.Conn, message TeamMessage, roomKey string) {
	room.Mutex.Lock()
	if client, exists := room.Clients[conn]; exists {
		client.Role = message.Role

		clientTeamIDHex := client.TeamID.Hex()
		team1IDHex := room.Team1ID.Hex()
		team2IDHex := room.Team2ID.Hex()

		// Tagged switch eliminates if/else if chain
		switch clientTeamIDHex {
		case team1IDHex:
			room.Team1Role = message.Role
			log.Printf("[handleTeamRoleSelection] Team1 role set to: %s by user %s", message.Role, client.UserID.Hex())
		case team2IDHex:
			room.Team2Role = message.Role
			log.Printf("[handleTeamRoleSelection] Team2 role set to: %s by user %s", message.Role, client.UserID.Hex())
		default:
			log.Printf("[handleTeamRoleSelection] ERROR: Client TeamID %s doesn't match Team1ID %s or Team2ID %s", clientTeamIDHex, team1IDHex, team2IDHex)
		}

		roleMessage := map[string]interface{}{
			"type":   "roleSelection",
			"role":   message.Role,
			"userId": client.UserID.Hex(),
			"teamId": client.TeamID.Hex(),
		}
		room.Mutex.Unlock()

		for _, r := range snapshotTeamRecipients(room, nil) {
			if err := r.SafeWriteJSON(roleMessage); err != nil {
				log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
			}
		}
	} else {
		room.Mutex.Unlock()
	}
}

// handleTeamReadyStatus handles ready status
func handleTeamReadyStatus(room *TeamRoom, conn *websocket.Conn, message TeamMessage, roomKey string) {
	room.Mutex.Lock()
	client, exists := room.Clients[conn]
	if !exists {
		room.Mutex.Unlock()
		log.Printf("[handleTeamReadyStatus] ERROR: Client not found for connection")
		return
	}

	userID := client.UserID.Hex()
	clientTeamIDHex := client.TeamID.Hex()
	team1IDHex := room.Team1ID.Hex()
	team2IDHex := room.Team2ID.Hex()

	log.Printf("[handleTeamReadyStatus] User %s (TeamID: %s) setting ready=%v", userID, clientTeamIDHex, message.Ready)
	log.Printf("[handleTeamReadyStatus] Room Team1ID: %s, Team2ID: %s", team1IDHex, team2IDHex)

	if message.Ready == nil {
		room.Mutex.Unlock()
		log.Printf("[handleTeamReadyStatus] ERROR: message.Ready is nil")
		return
	}

	// Remove from wrong team first
	if clientTeamIDHex != team1IDHex {
		delete(room.Team1Ready, userID)
	}
	if clientTeamIDHex != team2IDHex {
		delete(room.Team2Ready, userID)
	}

	var assignedToTeam string

	// Tagged switch eliminates if/else if chain
	switch clientTeamIDHex {
	case team1IDHex:
		room.Team1Ready[userID] = *message.Ready
		assignedToTeam = "Team1"
		log.Printf("[handleTeamReadyStatus] ✓✓✓ ASSIGNED TO Team1Ready. User %s ready=%v", userID, *message.Ready)
	case team2IDHex:
		room.Team2Ready[userID] = *message.Ready
		assignedToTeam = "Team2"
		log.Printf("[handleTeamReadyStatus] ✓✓✓ ASSIGNED TO Team2Ready. User %s ready=%v", userID, *message.Ready)
	default:
		log.Printf("[handleTeamReadyStatus] ❌❌❌ CRITICAL ERROR: User %s TeamID %s doesn't match Team1ID %s or Team2ID %s", userID, clientTeamIDHex, team1IDHex, team2IDHex)
		room.Mutex.Unlock()
		return
	}

	client.LastActivity = time.Now()

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

	currentTeam1MembersCount := 0
	currentTeam2MembersCount := 0
	for _, c := range room.Clients {
		switch c.TeamID.Hex() {
		case team1IDHex:
			currentTeam1MembersCount++
		case team2IDHex:
			currentTeam2MembersCount++
		}
	}

	log.Printf("[handleTeamReadyStatus] Counts - Team1Ready=%d/%d, Team2Ready=%d/%d",
		currentTeam1ReadyCount, currentTeam1MembersCount, currentTeam2ReadyCount, currentTeam2MembersCount)

	readyMessage := map[string]interface{}{
		"type":              "ready",
		"ready":             message.Ready,
		"userId":            userID,
		"teamId":            clientTeamIDHex,
		"assignedToTeam":    assignedToTeam,
		"team1Ready":        currentTeam1ReadyCount,
		"team2Ready":        currentTeam2ReadyCount,
		"team1MembersCount": currentTeam1MembersCount,
		"team2MembersCount": currentTeam2MembersCount,
	}

	readyMessageJSON, _ := json.Marshal(readyMessage)
	log.Printf("[handleTeamReadyStatus] Broadcasting: %s", string(readyMessageJSON))

	for _, r := range room.Clients {
		if err := r.SafeWriteJSON(readyMessage); err != nil {
			log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
		}
	}

	allTeam1Ready := currentTeam1ReadyCount == currentTeam1MembersCount && currentTeam1MembersCount > 0
	allTeam2Ready := currentTeam2ReadyCount == currentTeam2MembersCount && currentTeam2MembersCount > 0
	allReady := allTeam1Ready && allTeam2Ready

	shouldStartCountdown := allReady && room.CurrentPhase == "setup"

	if shouldStartCountdown {
		log.Printf("[handleTeamReadyStatus] ✓ All teams ready — starting countdown")

		countdownMessage := map[string]interface{}{
			"type":      "countdownStart",
			"countdown": 3,
		}
		for _, r := range room.Clients {
			if err := r.SafeWriteJSON(countdownMessage); err != nil {
				log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
			}
		}

		room.CurrentPhase = "countdown"

		go func() {
			time.Sleep(3 * time.Second)

			teamRoomsMutex.Lock()
			r, stillExists := teamRooms[roomKey]
			teamRoomsMutex.Unlock()

			if !stillExists {
				log.Printf("[handleTeamReadyStatus] Room %s no longer exists", roomKey)
				return
			}

			r.Mutex.Lock()
			if r.CurrentPhase == "countdown" || r.CurrentPhase == "setup" {
				r.CurrentPhase = "openingFor"
				phaseMessage := TeamMessage{Type: "phaseChange", Phase: "openingFor"}
				for _, rc := range r.Clients {
					if err := rc.SafeWriteJSON(phaseMessage); err != nil {
						log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
					}
				}
				log.Printf("[handleTeamReadyStatus] Phase changed to openingFor for %d clients", len(r.Clients))
			} else {
				log.Printf("[handleTeamReadyStatus] Phase already %s, skipping", r.CurrentPhase)
			}
			r.Mutex.Unlock()
		}()
	} else {
		log.Printf("[handleTeamReadyStatus] Not starting countdown: allReady=%v, phase=%s", allReady, room.CurrentPhase)
	}

	room.Mutex.Unlock()
}

// handleTeamTurnRequest handles turn requests
// conn param removed — not used in this handler
func handleTeamTurnRequest(room *TeamRoom, message TeamMessage, client *TeamClient, roomKey string) {
	canSpeak, remainingTokens := room.TokenBucket.TryConsumeForSpeaking(client.TeamID, client.UserID, room.TurnManager)

	if canSpeak {
		room.Mutex.Lock()
		client.Tokens = remainingTokens
		room.Mutex.Unlock()

		client.SafeWriteJSON(map[string]interface{}{
			"type":     "turnGranted",
			"userId":   client.UserID.Hex(),
			"username": client.Username,
			"tokens":   client.Tokens,
			"canSpeak": true,
		})

		teamStatus, statusErr := room.TokenBucket.GetTeamSpeakingStatus(client.TeamID, room.TurnManager)
		if statusErr != nil {
			log.Printf("failed to load team status for team %s: %v", client.TeamID.Hex(), statusErr)
			teamStatus = map[string]interface{}{}
		}
		currentTurn := room.TurnManager.GetCurrentTurn(client.TeamID).Hex()

		for _, r := range snapshotTeamRecipients(room, nil) {
			if r.TeamID == client.TeamID {
				if err := r.SafeWriteJSON(map[string]interface{}{
					"type":        "teamStatus",
					"teamStatus":  teamStatus,
					"currentTurn": currentTurn,
				}); err != nil {
					log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
				}
			}
		}
	} else {
		client.SafeWriteJSON(map[string]interface{}{
			"type":     "turnDenied",
			"userId":   client.UserID.Hex(),
			"username": client.Username,
			"reason":   "No tokens available or not your turn",
		})
	}
}

// handleTeamTurnEnd handles turn end
// conn param removed — not used in this handler
func handleTeamTurnEnd(room *TeamRoom, message TeamMessage, client *TeamClient, roomKey string) {
	nextUserID := room.TurnManager.NextTurn(client.TeamID)

	teamStatus, statusErr := room.TokenBucket.GetTeamSpeakingStatus(client.TeamID, room.TurnManager)
	if statusErr != nil {
		log.Printf("failed to load team status for team %s: %v", client.TeamID.Hex(), statusErr)
		teamStatus = map[string]interface{}{}
	}

	for _, r := range snapshotTeamRecipients(room, nil) {
		if r.TeamID == client.TeamID {
			if err := r.SafeWriteJSON(map[string]interface{}{
				"type":        "teamStatus",
				"teamStatus":  teamStatus,
				"currentTurn": nextUserID.Hex(),
			}); err != nil {
				log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
			}
		}
	}
}

// handleCheckStart checks if all teams are ready and starts the debate
// conn param removed — not used in this handler
func handleCheckStart(room *TeamRoom, roomKey string) {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()

	if room.CurrentPhase != "setup" {
		log.Printf("[handleCheckStart] Phase is %s, not setup — ignoring", room.CurrentPhase)
		return
	}

	team1IDHex := room.Team1ID.Hex()
	team2IDHex := room.Team2ID.Hex()

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

	team1MembersCount := 0
	team2MembersCount := 0
	for _, c := range room.Clients {
		switch c.TeamID.Hex() {
		case team1IDHex:
			team1MembersCount++
		case team2IDHex:
			team2MembersCount++
		}
	}

	allTeam1Ready := team1ReadyCount == team1MembersCount && team1MembersCount > 0
	allTeam2Ready := team2ReadyCount == team2MembersCount && team2MembersCount > 0
	allReady := allTeam1Ready && allTeam2Ready

	log.Printf("[handleCheckStart] Team1=%d/%d ready=%v, Team2=%d/%d ready=%v, AllReady=%v",
		team1ReadyCount, team1MembersCount, allTeam1Ready,
		team2ReadyCount, team2MembersCount, allTeam2Ready, allReady)

	if !allReady {
		log.Printf("[handleCheckStart] Not all ready: Team1=%d/%d, Team2=%d/%d",
			team1ReadyCount, team1MembersCount, team2ReadyCount, team2MembersCount)
		return
	}

	log.Printf("[handleCheckStart] ✓✓✓ ALL TEAMS READY! Starting countdown...")
	room.CurrentPhase = "countdown"

	for _, r := range room.Clients {
		if err := r.SafeWriteJSON(map[string]interface{}{
			"type":      "countdownStart",
			"countdown": 3,
		}); err != nil {
			log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
		}
	}

	go func() {
		time.Sleep(3 * time.Second)

		teamRoomsMutex.Lock()
		r, stillExists := teamRooms[roomKey]
		teamRoomsMutex.Unlock()

		if !stillExists {
			log.Printf("[handleCheckStart] Room %s no longer exists", roomKey)
			return
		}

		r.Mutex.Lock()
		if r.CurrentPhase == "countdown" || r.CurrentPhase == "setup" {
			r.CurrentPhase = "openingFor"
			phaseMessage := TeamMessage{Type: "phaseChange", Phase: "openingFor"}
			for _, rc := range r.Clients {
				if err := rc.SafeWriteJSON(phaseMessage); err != nil {
					log.Printf("Team WebSocket write error in room %s: %v", roomKey, err)
				} else {
					log.Printf("[handleCheckStart] ✓ Phase change sent")
				}
			}
			log.Printf("[handleCheckStart] Debate started! Phase: openingFor")
		}
		r.Mutex.Unlock()
	}()
}

// handleTeamWebRTCOffer relays an SDP offer to the intended target user
func handleTeamWebRTCOffer(room *TeamRoom, client *TeamClient, message TeamMessage) {
	if message.TargetUserID == "" || message.Offer == nil {
		log.Printf("[handleTeamWebRTCOffer] Missing offer or target for user %s", client.UserID.Hex())
		return
	}
	if err := sendMessageToUser(room, message.TargetUserID, map[string]any{
		"type":         "offer",
		"fromUserId":   client.UserID.Hex(),
		"targetUserId": message.TargetUserID,
		"teamId":       client.TeamID.Hex(),
		"offer":        message.Offer,
	}); err != nil {
		log.Printf("[handleTeamWebRTCOffer] Failed forwarding offer from %s to %s: %v", client.UserID.Hex(), message.TargetUserID, err)
	}
}

// handleTeamWebRTCAnswer relays an SDP answer to the offer initiator
func handleTeamWebRTCAnswer(room *TeamRoom, client *TeamClient, message TeamMessage) {
	if message.TargetUserID == "" || message.Answer == nil {
		log.Printf("[handleTeamWebRTCAnswer] Missing answer or target for user %s", client.UserID.Hex())
		return
	}
	if err := sendMessageToUser(room, message.TargetUserID, map[string]any{
		"type":         "answer",
		"fromUserId":   client.UserID.Hex(),
		"targetUserId": message.TargetUserID,
		"teamId":       client.TeamID.Hex(),
		"answer":       message.Answer,
	}); err != nil {
		log.Printf("[handleTeamWebRTCAnswer] Failed forwarding answer from %s to %s: %v", client.UserID.Hex(), message.TargetUserID, err)
	}
}

// handleTeamWebRTCCandidate relays ICE candidates during WebRTC negotiation
func handleTeamWebRTCCandidate(room *TeamRoom, client *TeamClient, message TeamMessage) {
	if message.TargetUserID == "" || message.Candidate == nil {
		log.Printf("[handleTeamWebRTCCandidate] Missing candidate or target for user %s", client.UserID.Hex())
		return
	}
	if err := sendMessageToUser(room, message.TargetUserID, map[string]any{
		"type":         "candidate",
		"fromUserId":   client.UserID.Hex(),
		"targetUserId": message.TargetUserID,
		"teamId":       client.TeamID.Hex(),
		"candidate":    message.Candidate,
	}); err != nil {
		log.Printf("[handleTeamWebRTCCandidate] Failed forwarding candidate from %s to %s: %v", client.UserID.Hex(), message.TargetUserID, err)
	}
}

// handleTeamLeave notifies all clients that a participant has left voluntarily
func handleTeamLeave(room *TeamRoom, client *TeamClient, roomKey string) {
	broadcastAll(room, map[string]any{
		"type":   "leave",
		"userId": client.UserID.Hex(),
		"teamId": client.TeamID.Hex(),
	})
	log.Printf("[handleTeamLeave] User %s left room %s", client.UserID.Hex(), roomKey)
}