package models

// WeakStatement represents a weak opening statement stored in MongoDB
type WeakStatement struct {
	ID     string `json:"id"`
	Topic  string `json:"topic"`
	Stance string `json:"stance"`
	Text   string `json:"text"`
}

// EvaluateArgumentRequest is the payload sent by the frontend to evaluate an argument
type EvaluateArgumentRequest struct {
	WeakStatementID string `json:"weakStatementId" binding:"required"`
	UserResponse    string `json:"userResponse" binding:"required"`
}

// Evaluation is the response from the Gemini API
type Evaluation struct {
	Score    int    `json:"score"`
	Feedback string `json:"feedback"`
}
