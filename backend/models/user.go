package models

import (
	"arguehub/security"
	"fmt"
	"time"

	"github.com/pquerna/otp/totp"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User defines a user entity
type User struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Email             string             `bson:"email" json:"email"`
	DisplayName       string             `bson:"displayName" json:"displayName"`
	Bio               string             `bson:"bio" json:"bio"`
	Rating            float64            `bson:"rating" json:"rating"`
	RD                float64            `bson:"rd" json:"rd"`
	Volatility        float64            `bson:"volatility" json:"volatility"`
	LastRatingUpdate  time.Time          `bson:"lastRatingUpdate" json:"lastRatingUpdate"`
	AvatarURL         string             `bson:"avatarUrl,omitempty" json:"avatarUrl,omitempty"`
	Twitter           string             `bson:"twitter,omitempty" json:"twitter,omitempty"`
	Instagram         string             `bson:"instagram,omitempty" json:"instagram,omitempty"`
	LinkedIn          string             `bson:"linkedin,omitempty" json:"linkedin,omitempty"`
	Password          string             `bson:"password" json:"-"`
	Nickname          string             `bson:"nickname"`
	IsVerified        bool               `bson:"isVerified"`
	VerificationCode  string             `bson:"verificationCode,omitempty"`
	ResetPasswordCode string             `bson:"resetPasswordCode,omitempty"`
	CreatedAt         time.Time          `bson:"createdAt"`
	UpdatedAt         time.Time          `bson:"updatedAt"`
	// Gamification fields
	Score            int       `bson:"score" json:"score"`                                           // Total gamification score
	Badges           []string  `bson:"badges,omitempty" json:"badges,omitempty"`                     // List of badge names earned
	CurrentStreak    int       `bson:"currentStreak" json:"currentStreak"`                           // Current daily streak
	LastActivityDate time.Time `bson:"lastActivityDate,omitempty" json:"lastActivityDate,omitempty"` // Last activity date for streak calculation
	// MFA fields
	MFAEnabled bool   `bson:"mfaEnabled" json:"mfaEnabled"`
	MFAType    string `bson:"mfaType,omitempty" json:"mfaType,omitempty"` // "totp", etc.
	MFASecret  string `bson:"mfaSecret,omitempty" json:"-"`               // Stored encrypted, never in JSON
}

// GenerateMFASecret generates a new TOTP secret for the user
func (u *User) GenerateMFASecret() (string, string, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "DebateAI",
		AccountName: u.Email,
	})
	if err != nil {
		return "", "", err
	}

	secret := key.Secret()
	qrCodeURL := key.URL()

	return secret, qrCodeURL, nil
}

// SetEncryptedMFASecret encrypts and sets the MFA secret
func (u *User) SetEncryptedMFASecret(secret string) error {
	encrypted, err := security.Encrypt(secret)
	if err != nil {
		return fmt.Errorf("failed to encrypt MFA secret: %w", err)
	}
	u.MFASecret = encrypted
	return nil
}

// GetDecryptedMFASecret decrypts and returns the MFA secret
func (u *User) GetDecryptedMFASecret() (string, error) {
	if u.MFASecret == "" {
		return "", fmt.Errorf("no MFA secret set")
	}
	decrypted, err := security.Decrypt(u.MFASecret)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt MFA secret: %w", err)
	}
	return decrypted, nil
}

// VerifyTOTP verifies the provided TOTP code
func (u *User) VerifyTOTP(code string) (bool, error) {
	secret, err := u.GetDecryptedMFASecret()
	if err != nil {
		return false, err
	}

	return totp.Validate(code, secret), nil
}
