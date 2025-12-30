package models

import (
    "time"

    "go.mongodb.org/mongo-driver/bson/primitive"
)

// DebateJudgement stores the AI or judge's evaluation for a debate
type DebateJudgement struct {
    ID        primitive.ObjectID     `bson:"_id,omitempty" json:"id,omitempty"`
    DebateID  primitive.ObjectID     `bson:"debateId" json:"debateId"`
    Winner    string                 `bson:"winner" json:"winner"` // "Side A" or "Side B"
    Scores    map[string]float64     `bson:"scores" json:"scores"` // keys: logic, evidence, persuasion, rebuttal
    Summary   string                 `bson:"summary" json:"summary"`
    CreatedAt time.Time              `bson:"createdAt" json:"createdAt"`
}
