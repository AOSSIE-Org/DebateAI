package controllers

import (
    "context"
    "log"
    "net/http"
    "time"

    "arguehub/models"
    "arguehub/services"
    "arguehub/db"

    "github.com/gin-gonic/gin"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
    "go.mongodb.org/mongo-driver/mongo"
)

// POST /debate/:id/judge
func JudgeDebateHandler(c *gin.Context) {
    idParam := c.Param("id")
    debateID, err := primitive.ObjectIDFromHex(idParam)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid debate id"})
        return
    }

    // Use a short request context to bound DB operations
    ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Minute)
    defer cancel()

    coll := db.MongoDatabase.Collection("debate_judgements")

    // Quick check: if a judgement already exists, reject.
    var existing models.DebateJudgement
    if err := coll.FindOne(ctx, bson.M{"debateId": debateID}).Decode(&existing); err == nil {
        c.JSON(http.StatusConflict, gin.H{"error": "debate already judged"})
        return
    }
    if err != nil && err != mongo.ErrNoDocuments {
        // Log the DB error and return a 500 — it's safer than proceeding
        log.Printf("error checking existing judgement for %s: %v", debateID.Hex(), err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify existing judgement"})
        return
    }

    // Build transcript (if this fails, we should not try to call the AI)
    transcript, err := services.GetDebateTranscript(debateID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "failed to build transcript: " + err.Error()})
        return
    }

    // Call AI judge with bounded context
    aiCtx, aiCancel := context.WithTimeout(ctx, 90*time.Second)
    defer aiCancel()
    result, err := services.JudgeDebateAI(aiCtx, transcript)
    if err != nil {
        // Log the AI failure for later investigation, but don't crash the server.
        log.Printf("AI judge failed for debate %s: %v", debateID.Hex(), err)
        // Return a 202 Accepted to indicate processing failed but debate flow continues.
        c.JSON(http.StatusAccepted, gin.H{"message": "AI judging failed; debate completed without AI score"})
        return
    }

    // Validate the AI result again before saving (defensive)
    if result == nil || (result.Winner != "Side A" && result.Winner != "Side B") {
        log.Printf("invalid AI result for debate %s: %+v", debateID.Hex(), result)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid AI result"})
        return
    }

    // Build a storage-friendly scores structure: save detailed per-side scores.
    scoresMap := map[string]any{
        "logic": map[string]int{"sideA": result.Scores.Logic.SideA, "sideB": result.Scores.Logic.SideB},
        "evidence": map[string]int{"sideA": result.Scores.Evidence.SideA, "sideB": result.Scores.Evidence.SideB},
        "persuasion": map[string]int{"sideA": result.Scores.Persuasion.SideA, "sideB": result.Scores.Persuasion.SideB},
        "rebuttal": map[string]int{"sideA": result.Scores.Rebuttal.SideA, "sideB": result.Scores.Rebuttal.SideB},
    }

    doc := models.DebateJudgement{
        ID:        primitive.NewObjectID(),
        DebateID:  debateID,
        Winner:    result.Winner,
        Scores:    map[string]float64{}, // keep legacy field for compatibility
        Summary:   result.Summary,
        CreatedAt: time.Now(),
    }
    // Also store the detailed per-side scores in a separate field via raw BSON insert
    insertDoc := bson.M{
        "_id":       doc.ID,
        "debateId":  doc.DebateID,
        "winner":    doc.Winner,
        "scores":    scoresMap,
        "summary":   doc.Summary,
        "createdAt": doc.CreatedAt,
    }

    // Try to insert; respect unique index on debateId to prevent races/double inserts.
    if _, err := coll.InsertOne(ctx, insertDoc); err != nil {
        // If duplicate key, someone else already judged concurrently — handle gracefully.
        if mongo.IsDuplicateKeyError(err) {
            log.Printf("duplicate judgement insert detected for debate %s", debateID.Hex())
            c.JSON(http.StatusConflict, gin.H{"error": "debate already judged"})
            return
        }
        log.Printf("failed to save judgement for debate %s: %v", debateID.Hex(), err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save judgement"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "judgement saved", "result": result})
}

// GET /debate/:id/judge
func GetDebateJudgementHandler(c *gin.Context) {
    idParam := c.Param("id")
    debateID, err := primitive.ObjectIDFromHex(idParam)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid debate id"})
        return
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
    defer cancel()

    coll := db.MongoDatabase.Collection("debate_judgements")

    var doc bson.M
    if err := coll.FindOne(ctx, bson.M{"debateId": debateID}).Decode(&doc); err != nil {
        if err == mongo.ErrNoDocuments {
            c.JSON(http.StatusNotFound, gin.H{"error": "judgement not found"})
            return
        }
        log.Printf("failed to fetch judgement for %s: %v", debateID.Hex(), err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch judgement"})
        return
    }

    c.JSON(http.StatusOK, doc)
}
