package websocket

import (
	"encoding/json"
	"log"
	"time"

	"arguehub/db"
	"arguehub/models"

	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type TeamDebateClient struct {
	conn       *websocket.Conn
	send       chan []byte
	debateID   primitive.ObjectID
	teamID     primitive.ObjectID
	userID     primitive.ObjectID
	isTeam1    bool
}

type TeamDebateHub struct {
	debates   map[primitive.ObjectID]*TeamDebateRoom
	register  chan *TeamDebateClient
	unregister chan *TeamDebateClient
	broadcast chan TeamDebateMessage
}

type TeamDebateRoom struct {
	debate    models.TeamDebate
	team1Clients map[*TeamDebateClient]bool
	team2Clients map[*TeamDebateClient]bool
}

type TeamDebateMessage struct {
	Type    string `json:"type"` // "message", "turn", "join", "leave"
	DebateID string `json:"debateId,omitempty"`
	TeamID   string `json:"teamId,omitempty"`
	UserID   string `json:"userId,omitempty"`
	Email    string `json:"email,omitempty"`
	DisplayName string `json:"displayName,omitempty"`
	Message  string `json:"message,omitempty"`
	Data     interface{} `json:"data,omitempty"`
}

var teamDebateHub = &TeamDebateHub{
	debates:      make(map[primitive.ObjectID]*TeamDebateRoom),
	register:     make(chan *TeamDebateClient),
	unregister:   make(chan *TeamDebateClient),
	broadcast:    make(chan TeamDebateMessage, 256),
}

func TeamDebateHubRun() {
	for {
		select {
		case client := <-teamDebateHub.register:
			room := teamDebateHub.debates[client.debateID]
			if room == nil {
				// Load debate from database
				collection := db.GetCollection("team_debates")
				var debate models.TeamDebate
				err := collection.FindOne(nil, bson.M{"_id": client.debateID}).Decode(&debate)
				if err == nil {
					room = &TeamDebateRoom{
						debate: debate,
						team1Clients: make(map[*TeamDebateClient]bool),
						team2Clients: make(map[*TeamDebateClient]bool),
					}
					teamDebateHub.debates[client.debateID] = room
				}
			}

			if room != nil {
				if client.isTeam1 {
					room.team1Clients[client] = true
				} else {
					room.team2Clients[client] = true
				}

				// Send current debate state to new client
				room.broadcastToTeam(client, TeamDebateMessage{
					Type:    "state",
					Data:    room.debate,
				})
			}

		case client := <-teamDebateHub.unregister:
			room := teamDebateHub.debates[client.debateID]
			if room != nil {
				if client.isTeam1 {
					delete(room.team1Clients, client)
				} else {
					delete(room.team2Clients, client)
				}
				close(client.send)

				// Notify others of disconnect
				broadcast := TeamDebateMessage{
					Type:    "leave",
					UserID:  client.userID.Hex(),
				}
				room.broadcast(broadcast)
			}

		case message := <-teamDebateHub.broadcast:
			debateID, _ := primitive.ObjectIDFromHex(message.DebateID)
			room := teamDebateHub.debates[debateID]
			if room != nil {
				room.broadcast(message)
			}
		}
	}
}

func (r *TeamDebateRoom) broadcast(message TeamDebateMessage) {
	r.broadcastToTeam(nil, message)
}

func (r *TeamDebateRoom) broadcastToTeam(exclude *TeamDebateClient, message TeamDebateMessage) {
	data, _ := json.Marshal(message)

	for client := range r.team1Clients {
		if client != exclude {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(r.team1Clients, client)
			}
		}
	}

	for client := range r.team2Clients {
		if client != exclude {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(r.team2Clients, client)
			}
		}
	}
}

func (c *TeamDebateClient) readPump() {
	defer func() {
		teamDebateHub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, messageBytes, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		var message TeamDebateMessage
		if err := json.Unmarshal(messageBytes, &message); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		message.DebateID = c.debateID.Hex()
		message.TeamID = c.teamID.Hex()
		message.UserID = c.userID.Hex()

		// Handle different message types
		switch message.Type {
		case "message":
			// Store message in database
			collection := db.GetCollection("team_debate_messages")
			debateID, _ := primitive.ObjectIDFromHex(message.DebateID)
			teamID, _ := primitive.ObjectIDFromHex(message.TeamID)
			userID, _ := primitive.ObjectIDFromHex(message.UserID)

			msg := models.TeamDebateMessage{
				ID:          primitive.NewObjectID(),
				DebateID:    debateID,
				TeamID:      teamID,
				UserID:      userID,
				Email:       message.Email,
				DisplayName: message.DisplayName,
				Message:     message.Message,
				Type:        "user",
				Timestamp:   time.Now(),
			}

			_, err := collection.InsertOne(nil, msg)
			if err != nil {
				log.Printf("Error storing message: %v", err)
			}

			// Broadcast to all clients in debate
			teamDebateHub.broadcast <- message
		}
	}
}

func (c *TeamDebateClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

