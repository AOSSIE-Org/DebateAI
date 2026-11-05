# Proposed Fix for Issue #568

### Root Cause & Approach
Iterating over `room.Clients` while a new client is joining is performed without holding `room.Mutex`, leading to a concurrent map read/write data race and a potential fatal server crash. The fix ensures `room.Mutex.Lock()` is held during the iteration or that map operations are properly protected/copied under lock before sending network messages.

### Proposed Code Fix

Update `backend/websocket/websocket.go` around line 340–355 to acquire and release `room.Mutex` correctly around the client iteration, or safely copy/isolate map access. 

```go
room.Clients[conn] = client
room.Mutex.Unlock()

participantsMsg := buildParticipantsMessage(room)
client.SafeWriteJSON(participantsMsg)

room.Mutex.Lock()
for connRef, existing := range room.Clients {
    if connRef != conn {
        existing.SafeWriteJSON(participantsMsg)
    }
}
room.Mutex.Unlock()
```
*(Note: Ensure that network writes like `SafeWriteJSON` are ideally performed outside the mutex lock if they block for too long, or capture a snapshot of clients under lock before iterating and writing).*

Alternative snapshot approach (recommended to avoid holding the mutex during network I/O):
```go
room.Mutex.Lock()
room.Clients[conn] = client
// Snapshot clients under lock
clientsSnapshot := make([]*Client, 0, len(room.Clients))
for _, c := range room.Clients {
    clientsSnapshot = append(clientsSnapshot, c)
}
room.Mutex.Unlock()

participantsMsg := buildParticipantsMessage(room)
for _, existing := range clientsSnapshot {
    existing.SafeWriteJSON(participantsMsg)
}
```

### Verification
1. Run the backend tests or server using the Go race detector:
   ```bash
   cd backend && go run -race cmd/server/main.go
   ```
2. Simulate concurrent client connections joining the same debate room simultaneously (e.g., via multiple WebSocket clients or automated integration tests).
3. Confirm that no `WARNING: DATA RACE` messages appear and the server does not crash with `fatal error: concurrent map iteration and map write`.

---
*Formulated by @SarthakSoni31 via CodeSphere AI*