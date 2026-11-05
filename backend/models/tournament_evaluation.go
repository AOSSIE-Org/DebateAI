package models

import "go.mongodb.org/mongo-driver/bson/primitive"

const (
	EvaluationPending   = "pending"
	EvaluationRunning   = "running"
	EvaluationCompleted = "completed"
	EvaluationFailed    = "failed"
)

type CriteriaScore struct {
	Reasoning  int `bson:"reasoning" json:"reasoning"`
	Relevance  int `bson:"relevance" json:"relevance"`
	PhaseSkill int `bson:"phaseSkill" json:"phaseSkill"`
	Clarity    int `bson:"clarity" json:"clarity"`
}

type ParticipantScore struct {
	UserID           primitive.ObjectID `bson:"userId" json:"userId"`
	Score            int                `bson:"score" json:"score"`
	Criteria         CriteriaScore      `bson:"criteria" json:"criteria"`
	Explanation      string             `bson:"explanation" json:"explanation"`
	SubmissionStatus string             `bson:"submissionStatus" json:"submissionStatus"`
}

type RoundResult struct {
	Scores []ParticipantScore `bson:"scores" json:"scores"`
}

type EvaluationResult struct {
	OpeningStatementFor             RoundResult `bson:"opening_statement_for" json:"opening_statement_for"`
	OpeningStatementAgainst         RoundResult `bson:"opening_statement_against" json:"opening_statement_against"`
	CrossExaminationQuestionFor     RoundResult `bson:"cross_examination_question_for" json:"cross_examination_question_for"`
	CrossExaminationAnswerAgainst   RoundResult `bson:"cross_examination_answer_against" json:"cross_examination_answer_against"`
	CrossExaminationQuestionAgainst RoundResult `bson:"cross_examination_question_against" json:"cross_examination_question_against"`
	CrossExaminationAnswerFor       RoundResult `bson:"cross_examination_answer_for" json:"cross_examination_answer_for"`
	ClosingStatementFor             RoundResult `bson:"closing_statement_for" json:"closing_statement_for"`
	ClosingStatementAgainst         RoundResult `bson:"closing_statement_against" json:"closing_statement_against"`
}

func (r *EvaluationResult) Rounds() []*RoundResult {
	return []*RoundResult{&r.OpeningStatementFor, &r.OpeningStatementAgainst, &r.CrossExaminationQuestionFor, &r.CrossExaminationAnswerAgainst, &r.CrossExaminationQuestionAgainst, &r.CrossExaminationAnswerFor, &r.ClosingStatementFor, &r.ClosingStatementAgainst}
}

type WinningIndividual struct {
	UserID     primitive.ObjectID `bson:"userId" json:"userId"`
	TotalScore int                `bson:"totalScore" json:"totalScore"`
}

type Winner struct {
	Side            string              `bson:"side" json:"side"`
	Individual      *WinningIndividual  `bson:"individual" json:"individual"`
	TiedIndividuals []WinningIndividual `bson:"tiedIndividuals" json:"tiedIndividuals"`
}

// Exact numerator/denominator are authoritative; mean is for display only.
type TournamentSideMean struct {
	Side             string  `bson:"side" json:"side"`
	TotalScore       int     `bson:"totalScore" json:"totalScore"`
	ParticipantCount int     `bson:"participantCount" json:"participantCount"`
	Mean             float64 `bson:"mean" json:"mean"`
}
