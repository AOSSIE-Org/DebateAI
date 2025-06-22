package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User defines a user entity
type User struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Email             string             `bson:"email" json:"email"`
	DisplayName       string             `bson:"displayName" json:"displayName"`
	Bio               string             `bson:"bio" json:"bio"`
	Rating            float64            `bson:"rating" json:"rating"`
	RD          float64            `bson:"rd" json:"rd"`                     
	Volatility  float64            `bson:"volatility" json:"volatility"`     
	LastRatingUpdate time.Time      `bson:"lastRatingUpdate" json:"lastRatingUpdate"`
	AvatarURL         string             `bson:"avatarUrl,omitempty" json:"avatarUrl,omitempty"`
	Twitter           string             `bson:"twitter,omitempty" json:"twitter,omitempty"`
	Instagram         string             `bson:"instagram,omitempty" json:"instagram,omitempty"`
	LinkedIn          string             `bson:"linkedin,omitempty" json:"linkedin,omitempty"`
	Password          string             `bson:"password"`
	Nickname          string             `bson:"nickname"`
	IsVerified        bool               `bson:"isVerified"`
	VerificationCode  string             `bson:"verificationCode,omitempty"`
	ResetPasswordCode string             `bson:"resetPasswordCode,omitempty"`
	CreatedAt         time.Time          `bson:"createdAt"`
	UpdatedAt         time.Time          `bson:"updatedAt"`
}