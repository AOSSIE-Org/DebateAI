package websocket

// import (
// 	"encoding/json"
// 	"fmt"
// 	"log"
// 	"net/http"
// 	"sync"
// 	"time"
// 	"os"
// 	"bytes"
// 	"arguehub/structs"

// 	"github.com/gin-gonic/gin"
// 	"github.com/gorilla/websocket"
// )

// // Constants for message types
// const (
// 	MessageTypeDebateStart          = "DEBATE_START"
// 	MessageTypeDebateEnd            = "DEBATE_END"
// 	MessageTypeSectionStart         = "SECTION_START"
// 	MessageTypeSectionEnd           = "SECTION_END"
// 	MessageTypeTurnStart            = "TURN_START"
// 	MessageTypeTurnEnd              = "TURN_END"
// 	MessageTypeGeneratingTranscript = "GENERATING_TRANSCRIPT"
// 	MessageTypeChatMessage          = "CHAT_MESSAGE"
// 	PingMessage                     = "PING"

// 	ReadBufferSize  = 131022
// 	WriteBufferSize = 131022
// )

// // Global room storage
// var (
// 	rooms  = make(map[string]*structs.Room)
// 	roomMu sync.Mutex
// )

// // JSON helper function
// func toJSON(data interface{}) (string, error) {
// 	bytes, err := json.Marshal(data)
// 	if err != nil {
// 		return "", err
// 	}
// 	return string(bytes), nil
// }

// // Send a WebSocket message
// func sendMessage(conn *websocket.Conn, messageType string, data interface{}) error {
// 	content, err := toJSON(data)
// 	if err != nil {
// 		return fmt.Errorf("error marshaling data: %w", err)
// 	}

// 	message := structs.Message{
// 		Type:    messageType,
// 		Content: content,
// 	}
// 	if err := conn.WriteJSON(message); err != nil {
// 		return fmt.Errorf("error sending %s message: %w", messageType, err)
// 	}
// 	return nil
// }

// // Broadcast a message to all users in the room
// func broadcastMessage(room *structs.Room, messageType string, data interface{}) {
// 	room.Mutex.Lock()
// 	defer room.Mutex.Unlock()
// 	for userID, conn := range room.Users {
// 		if err := sendMessage(conn, messageType, data); err != nil {
// 			log.Printf("Error broadcasting to user %s: %v", userID, err)
// 			conn.Close()
// 			delete(room.Users, userID)
// 		}
// 	}
// }

// // Create or join a room
// func createOrJoinRoom(userID string, conn *websocket.Conn) (*structs.Room, error) {
// 	roomMu.Lock()
// 	defer roomMu.Unlock()

// 	for _, room := range rooms {
// 		room.Mutex.Lock()
// 		if existingConn, exists := room.Users[userID]; exists {
// 			existingConn.Close()
// 			room.Users[userID] = conn
// 			room.Mutex.Unlock()
// 			return room, nil
// 		}
// 		if len(room.Users) < 2 {
// 			room.Users[userID] = conn
// 			room.Mutex.Unlock()
// 			return room, nil
// 		}
// 		room.Mutex.Unlock()
// 	}

// 	// Initialize the room with TurnActive map
// 	newRoom := &structs.Room{
// 		Users:      map[string]*websocket.Conn{userID: conn},
// 		DebateFmt:  getDebateFormat(),
// 		TurnActive: make(map[string]bool), // Initialize TurnActive for each user
// 	}
// 	roomID := generateRoomID()
// 	rooms[roomID] = newRoom

// 	// Verify connections for this new room
// 	go verifyConnections(newRoom)

// 	return newRoom, nil
// }

// // Verify active connections
// func verifyConnections(room *structs.Room) {
// 	time.Sleep(2 * time.Second)
// 	room.Mutex.Lock()
// 	defer room.Mutex.Unlock()

// 	for userID, conn := range room.Users {
// 		if err := sendMessage(conn, PingMessage, nil); err != nil {
// 			log.Printf("Connection lost for user %s, removing from room", userID)
// 			conn.Close()
// 			delete(room.Users, userID)
// 		}
// 	}
// }

// //ws handler
// func WebsocketHandler(ctx *gin.Context) {
// 	upgrader := websocket.Upgrader{
// 		CheckOrigin:       func(r *http.Request) bool { return true },
// 		ReadBufferSize:    ReadBufferSize,
// 		WriteBufferSize:   WriteBufferSize,
// 		EnableCompression: false,
// 	}

// 	conn, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
// 	if err != nil {
// 		log.Println("Error upgrading WebSocket:", err)
// 		return
// 	}
// 	defer conn.Close()

// 	userID := ctx.Query("userId")
// 	if userID == "" {
// 		log.Println("Missing userId in query parameters")
// 		return
// 	}

// 	log.Printf("WebSocket connection established for userId: %s", userID)

// 	room, err := createOrJoinRoom(userID, conn)
// 	if err != nil {
// 		log.Println("Error joining room:", err)
// 		return
// 	}

// 	log.Println("Waiting for another user to join...")
// 	for {
// 		room.Mutex.Lock()
// 		if len(room.Users) == 2 && !room.DebateStarted {
// 			room.DebateStarted = true
// 			room.Mutex.Unlock()
// 			break
// 		}
// 		room.Mutex.Unlock()
// 		time.Sleep(1 * time.Second)
// 	}

// 	log.Println("Two users connected. Starting debate.")

// 	startDebate(room)

// 	closeConnectionsAndExpireRoom(room)
// }

// func startDebate(room *structs.Room) {
// 	broadcastMessage(room, MessageTypeDebateStart, nil)

// 	for _, section := range room.DebateFmt.Sections {
// 		log.Printf("Section: %s", section.Name)
// 		broadcastMessage(room, MessageTypeSectionStart, structs.CurrentStatus{Section: section.Name})

// 		for userID, conn := range room.Users {
// 			room.Mutex.Lock()
// 			room.CurrentTurn = userID
// 			room.Mutex.Unlock()

// 			turnStatus := structs.CurrentStatus{
// 				CurrentTurn: userID,
// 				Section:     section.Name,
// 				Duration:    int(section.Duration.Seconds()),
// 			}

// 			// Mark the user's turn as active
// 			room.Mutex.Lock()
// 			room.TurnActive[userID] = true
// 			room.Mutex.Unlock()

// 			time.Sleep(time.Second * 2)
// 			broadcastMessage(room, MessageTypeTurnStart, turnStatus)

// 			// Save user media
// 			mediaFileChan := make(chan string)
// 			go saveUserMedia(conn, userID, section.Name, mediaFileChan, room)

// 			time.Sleep(section.Duration)
// 			// End current turn
// 			broadcastMessage(room, MessageTypeTurnEnd, nil)

// 			// Mark the user's turn as inactive
// 			room.Mutex.Lock()
// 			room.TurnActive[userID] = false
// 			room.Mutex.Unlock()

// 			// Wait for media file path
// 			mediaFilePath := <-mediaFileChan
// 			if mediaFilePath != "" {
// 				// Generate transcript
// 				// Notify frontend that transcript is being generated
// 				broadcastMessage(room, MessageTypeGeneratingTranscript, structs.ChatMessage{
// 					Sender:  userID,
// 					Message: "Transcript is being generated...",
// 				})

// 				transcript, err := generateTranscript(mediaFilePath)
// 				if err != nil {
// 					log.Printf("Error generating transcript for user %s: %v", userID, err)
// 					continue
// 				}

// 				// Broadcast transcript as a chat message
// 				broadcastMessage(room, MessageTypeChatMessage, structs.ChatMessage{
// 					Sender:  userID,
// 					Message: transcript,
// 				})
// 			}
// 		}

// 		broadcastMessage(room, MessageTypeSectionEnd, nil)
// 	}

// 	broadcastMessage(room, MessageTypeDebateEnd, nil)

// 	broadcastMessage(room, "GENERATING_RESULTS", nil);

// 	gameResult := structs.GameResult{
// 		WinnerUserId: "1",
// 		Points: 10,
// 		TotalPoints: 100,
// 		EvaluationMessage: "you won the match, for the reasons you don't need to know",
// 	}
// 	broadcastMessage(room, "GAME_RESULT", gameResult);
// }

// type TranscriptionResponse struct {
// 	Transcription string `json:"transcription"`
// 	Error         string `json:"error"`
// }
// func generateTranscript(mediaFilePath string) (string, error) {
// 	serverURL := "http://localhost:8000/transcribe/batch"

// 	payload := map[string]string{"file_path": mediaFilePath}
// 	payloadBytes, err := json.Marshal(payload)
// 	if err != nil {
// 		return "", fmt.Errorf("failed to marshal JSON payload: %v", err)
// 	}

// 	resp, err := http.Post(serverURL, "application/json", bytes.NewReader(payloadBytes))
// 	if err != nil {
// 		return "", fmt.Errorf("failed to send POST request: %v", err)
// 	}
// 	defer resp.Body.Close()

// 	var result TranscriptionResponse
// 	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
// 		return "", fmt.Errorf("failed to decode response: %v", err)
// 	}

// 	if result.Error != "" {
// 		return "", fmt.Errorf("server error: %s", result.Error)
// 	}

// 	return result.Transcription, nil
// }

// // Generate a unique room ID
// func generateRoomID() string {
// 	return fmt.Sprintf("%d", time.Now().UnixNano())
// }

// // Initialize debate format
// func getDebateFormat() structs.DebateFormat {
// 	return structs.DebateFormat{
// 		Sections: []structs.Section{
// 			{Name: "Opening", Duration: 2 * time.Second},
// 			// {Name: "Rebuttal", Duration: 3 * time.Second},
// 			// {Name: "Closing", Duration: 3 * time.Second},
// 		},
// 	}
// }

// func closeConnectionsAndExpireRoom(room *structs.Room) {
// 	room.Mutex.Lock()
// 	defer room.Mutex.Unlock()

// 	for userID, conn := range room.Users {
// 		log.Printf("Closing connection for user: %s", userID)
// 		conn.Close()
// 		delete(room.Users, userID)
// 	}

// 	roomMu.Lock()
// 	defer roomMu.Unlock()
// 	for roomID, r := range rooms {
// 		if r == room {
// 			delete(rooms, roomID)
// 			log.Printf("Room %s expired and removed", roomID)
// 			break
// 		}
// 	}
// }

// // TranscriptionResult represents the JSON response from the Python script
// type TranscriptionResult struct {
// 	Transcription string `json:"transcription"`
// }

// func saveUserMedia(conn *websocket.Conn, userID, sectionName string, mediaFileChan chan<- string, room *structs.Room) {
// 	defer close(mediaFileChan)

// 	tempFilename := fmt.Sprintf("temp_media_%s_%s.webm", userID, sectionName)
// 	finalFilename := fmt.Sprintf("media_%s_%s.webm", userID, sectionName)

// 	file, err := os.Create(tempFilename)
// 	if err != nil {
// 		log.Printf("Error creating file for user %s: %v", userID, err)
// 		mediaFileChan <- ""
// 		return
// 	}
// 	defer func() {
// 		file.Close()
// 		err = os.Rename(tempFilename, finalFilename)
// 		if err != nil {
// 			log.Printf("Error renaming file for user %s: %v", userID, err)
// 			mediaFileChan <- ""
// 		} else {
// 			log.Printf("Media saved for user %s in section %s", userID, sectionName)
// 			mediaFileChan <- finalFilename
// 		}
// 	}()

// 	for {
// 		room.Mutex.Lock()
// 		active := room.TurnActive[userID]
// 		room.Mutex.Unlock()

// 		if !active {
// 			log.Printf("Turn ended for user %s. Stopping media collection.", userID)
// 			break
// 		}

// 		messageType, data, err := conn.ReadMessage()
// 		if err != nil {
// 			if websocket.IsCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
// 				log.Printf("Connection closed for user %s", userID)
// 			} else {
// 				log.Printf("Error reading chunk for user %s: %v", userID, err)
// 			}
// 			break
// 		}

// 		if messageType == websocket.BinaryMessage {
// 			_, err = file.Write(data)
// 			if err != nil {
// 				log.Printf("Error writing chunk for user %s: %v", userID, err)
// 				break
// 			}
// 		}
// 	}

// 	err = file.Sync()
// 	if err != nil {
// 		log.Printf("Error syncing file for user %s: %v", userID, err)
// 		mediaFileChan <- ""
// 	}
// }
