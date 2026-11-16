package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User defines a user entity
type User struct {
	ID                      primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Email                   string             `bson:"email" json:"email"`
	DisplayName             string             `bson:"displayName" json:"displayName"`
	Bio                     string             `bson:"bio" json:"bio"`
	Rating                  float64            `bson:"rating" json:"rating"`
	RD                      float64            `bson:"rd" json:"rd"`
	Volatility              float64            `bson:"volatility" json:"volatility"`
	LastRatingUpdate        time.Time          `bson:"lastRatingUpdate" json:"lastRatingUpdate"`
	AvatarURL               string             `bson:"avatarUrl,omitempty" json:"avatarUrl,omitempty"`
	Twitter                 string             `bson:"twitter,omitempty" json:"twitter,omitempty"`
	Instagram               string             `bson:"instagram,omitempty" json:"instagram,omitempty"`
	LinkedIn                string             `bson:"linkedin,omitempty" json:"linkedin,omitempty"`
	Password                string             `bson:"password" json:"-"`
	Nickname                string             `bson:"nickname" json:"nickname"`
	IsVerified              bool               `bson:"isVerified" json:"isVerified"`
	VerificationCode        string             `bson:"verificationCode,omitempty" json:"-"`
	VerificationCodeExpiry  time.Time          `bson:"verificationCodeExpiry,omitempty" json:"-"`
	VerificationCodeSentAt  time.Time          `bson:"verificationCodeSentAt,omitempty" json:"-"`
	ResetPasswordCode       string             `bson:"resetPasswordCode,omitempty" json:"-"`
	ResetPasswordCodeExpiry time.Time          `bson:"resetPasswordCodeExpiry,omitempty" json:"-"`
	CreatedAt               time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt               time.Time          `bson:"updatedAt" json:"updatedAt"`
	Score                   int                `bson:"score" json:"score"`
	Badges                  []string           `bson:"badges,omitempty" json:"badges,omitempty"`
	CurrentStreak           int                `bson:"currentStreak" json:"currentStreak"`
	LastActivityDate        time.Time          `bson:"lastActivityDate,omitempty" json:"lastActivityDate,omitempty"`
}

// PublicUserDTO defines a sanitized public user profile for social endpoints
type PublicUserDTO struct {
	ID               primitive.ObjectID `json:"id,omitempty"`
	DisplayName      string             `json:"displayName"`
	Nickname         string             `json:"nickname,omitempty"`
	Bio              string             `json:"bio,omitempty"`
	Rating           float64            `json:"rating"`
	AvatarURL        string             `json:"avatarUrl,omitempty"`
	Twitter          string             `json:"twitter,omitempty"`
	Instagram        string             `json:"instagram,omitempty"`
	LinkedIn         string             `json:"linkedin,omitempty"`
	Score            int                `json:"score"`
	Badges           []string           `json:"badges,omitempty"`
	CurrentStreak    int                `json:"currentStreak"`
	LastActivityDate time.Time          `json:"lastActivityDate,omitempty"`
}

// ToPublicDTO converts a User model into a sanitized PublicUserDTO
func (u *User) ToPublicDTO() PublicUserDTO {
	return PublicUserDTO{
		ID:               u.ID,
		DisplayName:      u.DisplayName,
		Nickname:         u.Nickname,
		Bio:              u.Bio,
		Rating:           u.Rating,
		AvatarURL:        u.AvatarURL,
		Twitter:          u.Twitter,
		Instagram:        u.Instagram,
		LinkedIn:         u.LinkedIn,
		Score:            u.Score,
		Badges:           u.Badges,
		CurrentStreak:    u.CurrentStreak,
		LastActivityDate: u.LastActivityDate,
	}
}