package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Tournament Status constants
const (
	StatusUpcoming  = "upcoming"
	StatusLive      = "live"
	StatusCompleted = "completed"
)

// Tournament Visibility constants
const (
	VisibilityPublic  = "public"
	VisibilityPrivate = "private"
)

// Stance constants
const (
	StanceFor     = "for"
	StanceAgainst = "against"
)

// Join Request Status constants
const (
	JoinRequestPending  = "pending"
	JoinRequestApproved = "approved"
	JoinRequestRejected = "rejected"
)

// JoinRequest holds a participant's request to join a private tournament
type JoinRequest struct {
	UserID    primitive.ObjectID  `bson:"userId" json:"userId" validate:"required"`
	Name      string              `bson:"name" json:"name" validate:"required"`
	Status    string              `bson:"status" json:"status" validate:"required,oneof=pending approved rejected"`
	CreatedAt time.Time           `bson:"createdAt" json:"createdAt"`
	DecidedAt *time.Time          `bson:"decidedAt,omitempty" json:"decidedAt,omitempty"`
	DecidedBy *primitive.ObjectID `bson:"decidedBy,omitempty" json:"decidedBy,omitempty"`
}

// Transcript holds a single round submission by a participant
type Transcript struct {
	Round   string `bson:"round" json:"round"`
	Content string `bson:"content" json:"content"`
}

// TournamentParticipant may have an unset stance while in the admission lobby.
type TournamentParticipant struct {
	UserID primitive.ObjectID `bson:"userId" json:"userId" validate:"required"`
	Name   string             `bson:"name" json:"name" validate:"required"`
	Stance string             `bson:"stance" json:"stance" validate:"omitempty,oneof=for against"`
}

const (
	TournamentPhaseSeconds = 180
	ExecutionRunning       = "running"
	ExecutionFinished      = "finished"
	PhaseWaiting           = "waiting"
	PhaseOpen              = "open"
	PhaseClosed            = "closed"
	SlotPending            = "pending"
	SlotSubmitted          = "submitted"
	SlotMissing            = "missing"
)

// Execution and accepted text are exposed only through role-specific DTOs.
type TournamentExecution struct {
	RunID      primitive.ObjectID      `bson:"runId" json:"runId"`
	State      string                  `bson:"state" json:"state"`
	Roster     []TournamentParticipant `bson:"roster" json:"roster"`
	PhaseIndex int                     `bson:"phaseIndex" json:"phaseIndex"`
	Phases     []TournamentPhase       `bson:"phases" json:"phases"`
	StartedAt  time.Time               `bson:"startedAt" json:"startedAt"`
	FinishedAt *time.Time              `bson:"finishedAt,omitempty" json:"finishedAt,omitempty"`
	DeadlineAt *time.Time              `bson:"deadlineAt,omitempty" json:"-"`
}

type TournamentPhase struct {
	Round      string                     `bson:"round" json:"round"`
	Status     string                     `bson:"status" json:"status"`
	OpenedAt   *time.Time                 `bson:"openedAt,omitempty" json:"openedAt,omitempty"`
	DeadlineAt *time.Time                 `bson:"deadlineAt,omitempty" json:"deadlineAt,omitempty"`
	ClosedAt   *time.Time                 `bson:"closedAt,omitempty" json:"closedAt,omitempty"`
	Slots      []TournamentSubmissionSlot `bson:"slots" json:"slots"`
}

type TournamentSubmissionSlot struct {
	UserID      primitive.ObjectID `bson:"userId" json:"userId"`
	Status      string             `bson:"status" json:"status"`
	Content     string             `bson:"content,omitempty" json:"content,omitempty"`
	ContentHash string             `bson:"contentHash,omitempty" json:"contentHash,omitempty"`
	SubmittedAt *time.Time         `bson:"submittedAt,omitempty" json:"submittedAt,omitempty"`
}

// Evaluation is embedded so publication and tournament completion are atomic.
type TournamentEvaluation struct {
	ID            primitive.ObjectID   `bson:"id" json:"id"`
	TournamentID  primitive.ObjectID   `bson:"tournamentId" json:"tournamentId"`
	RunID         primitive.ObjectID   `bson:"runId" json:"runId"`
	State         string               `bson:"state" json:"state"`
	InputHash     string               `bson:"inputHash" json:"inputHash"`
	CreatedAt     time.Time            `bson:"createdAt" json:"createdAt"`
	Attempts      int                  `bson:"attempts" json:"-"`
	NextAttemptAt *time.Time           `bson:"nextAttemptAt,omitempty" json:"-"`
	LeaseToken    string               `bson:"leaseToken,omitempty" json:"-"`
	LeaseUntil    *time.Time           `bson:"leaseUntil,omitempty" json:"-"`
	RubricVersion string               `bson:"rubricVersion,omitempty" json:"rubricVersion,omitempty"`
	Provider      string               `bson:"provider,omitempty" json:"provider,omitempty"`
	Model         string               `bson:"model,omitempty" json:"model,omitempty"`
	LastErrorCode string               `bson:"lastErrorCode,omitempty" json:"-"`
	Result        *EvaluationResult    `bson:"result,omitempty" json:"result,omitempty"`
	Winner        *Winner              `bson:"winner,omitempty" json:"winner,omitempty"`
	Totals        []WinningIndividual  `bson:"totals,omitempty" json:"totals,omitempty"`
	SideMeans     []TournamentSideMean `bson:"sideMeans,omitempty" json:"sideMeans,omitempty"`
	CompletedAt   *time.Time           `bson:"completedAt,omitempty" json:"completedAt,omitempty"`
	FailedAt      *time.Time           `bson:"failedAt,omitempty" json:"-"`
}

// Tournament defines a single tournament record
type Tournament struct {
	SchemaVersion   int                     `bson:"schemaVersion,omitempty" json:"schemaVersion,omitempty"`
	Revision        int64                   `bson:"revision" json:"revision"`
	Execution       *TournamentExecution    `bson:"execution,omitempty" json:"-"`
	Evaluation      *TournamentEvaluation   `bson:"evaluation,omitempty" json:"-"`
	ID              primitive.ObjectID      `bson:"_id,omitempty" json:"id,omitempty"`
	HostID          primitive.ObjectID      `bson:"hostId" json:"hostId" validate:"required"`
	ModeratorName   string                  `bson:"moderatorName" json:"moderatorName" validate:"required"`
	Topic           string                  `bson:"topic" json:"topic" validate:"required"`
	Description     string                  `bson:"description" json:"description" validate:"required"`
	Status          string                  `bson:"status" json:"status" validate:"required,oneof=upcoming live completed"`
	Visibility      string                  `bson:"visibility" json:"visibility" validate:"required,oneof=public private"`
	MinParticipants int                     `bson:"minParticipants" json:"minParticipants" validate:"required,min=3"`
	MaxParticipants int                     `bson:"maxParticipants" json:"maxParticipants" validate:"required"`
	Participants    []TournamentParticipant `bson:"participants" json:"participants"`
	JoinRequests    []JoinRequest           `bson:"joinRequests,omitempty" json:"joinRequests,omitempty"`
	InviteCode      string                  `bson:"inviteCode,omitempty" json:"inviteCode,omitempty"`
	ScheduleAt      *time.Time              `bson:"scheduleAt,omitempty" json:"scheduleAt,omitempty"`
	CreatedAt       time.Time               `bson:"createdAt" json:"createdAt" validate:"required"`
}
