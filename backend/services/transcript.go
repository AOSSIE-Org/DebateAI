package services

import (
    "context"
    "errors"
    "fmt"
    "strings"
    "time"

    "arguehub/db"
    "arguehub/models"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

const maxTranscriptLength = 5000 // max characters for returned transcript

// GetDebateTranscript builds a full, chronological transcript for a saved debate.
// Each message is prefixed with "Side A:" or "Side B:". System messages are excluded.
func GetDebateTranscript(debateID primitive.ObjectID) (string, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    coll := db.MongoDatabase.Collection("saved_debate_transcripts")

    var saved models.SavedDebateTranscript
    if err := coll.FindOne(ctx, bson.M{"_id": debateID}).Decode(&saved); err != nil {
        return "", fmt.Errorf("failed to find debate transcript: %w", err)
    }

    if len(saved.Messages) == 0 {
        return "", errors.New("no messages found for this debate")
    }

    // Determine participant identifiers for side mapping.
    // Prefer the saved.Email as Side A and saved.Opponent as Side B when available.
    sideA := strings.ToLower(strings.TrimSpace(saved.Email))
    sideB := strings.ToLower(strings.TrimSpace(saved.Opponent))

    var b strings.Builder
    length := 0

    for _, msg := range saved.Messages {
        sender := strings.TrimSpace(msg.Sender)
        if sender == "" {
            continue
        }
        // Exclude system messages
        if strings.EqualFold(sender, "system") {
            continue
        }

        // Map sender to Side A or Side B
        var prefix string
        lowerSender := strings.ToLower(sender)
        switch {
        case sideA != "" && (lowerSender == sideA || strings.Contains(lowerSender, sideA)):
            prefix = "Side A:"
        case sideB != "" && (lowerSender == sideB || strings.Contains(lowerSender, sideB)):
            prefix = "Side B:"
        default:
            // Fallback: assign first non-system sender encountered as Side A,
            // the other as Side B based on which appears first.
            if b.Len() == 0 {
                prefix = "Side A:"
            } else {
                prefix = "Side B:"
            }
        }

        text := strings.TrimSpace(msg.Text)
        if text == "" {
            continue
        }

        line := prefix + " " + text + "\n"

        // Enforce max length; truncate if adding this line would exceed the limit
        if length+len(line) > maxTranscriptLength {
            remaining := maxTranscriptLength - length
            if remaining > 0 {
                b.WriteString(line[:remaining])
                b.WriteString("\n...(truncated)")
            } else {
                b.WriteString("...(truncated)")
            }
            return b.String(), nil
        }

        b.WriteString(line)
        length += len(line)
    }

    result := b.String()
    if strings.TrimSpace(result) == "" {
        return "", errors.New("debate contains no non-system messages")
    }

    return result, nil
}
