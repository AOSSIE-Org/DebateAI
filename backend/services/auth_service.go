package services

import (
	"context"
	"errors"
	"time"

	"arguehub/config"
	"arguehub/models"
	"arguehub/repositories"
	"arguehub/utils"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// AuthService defined authentication interface
type AuthService interface {
	SignUp(ctx context.Context, email, password string) error
	Login(ctx context.Context, email, password string) (*models.User, string, error)
	VerifyEmail(ctx context.Context, email, code string) (*models.User, string, error)
}

// authServiceImpl implements AuthService
type authServiceImpl struct {
	userRepo    repositories.UserRepository
	emailSender EmailSender
	config      *config.Config
}

// NewAuthService creates a new AuthService
func NewAuthService(userRepo repositories.UserRepository, emailSender EmailSender, cfg *config.Config) AuthService {
	return &authServiceImpl{
		userRepo:    userRepo,
		emailSender: emailSender,
		config:      cfg,
	}
}

func (s *authServiceImpl) SignUp(ctx context.Context, email, password string) error {
	// Check if user exists
	_, err := s.userRepo.FindByEmail(ctx, email)
	if err == nil {
		return errors.New("user already exists")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	verificationCode := utils.GenerateRandomCode(6)
	now := time.Now()

	user := &models.User{
		Email:            email,
		DisplayName:      utils.ExtractNameFromEmail(email),
		Nickname:         utils.ExtractNameFromEmail(email),
		Password:         string(hashedPassword),
		VerificationCode: verificationCode,
		IsVerified:       false,
		Score:            0,
		Rating:           1200.0,
		RD:               350.0,
		Volatility:       0.06,
		CreatedAt:        now,
		UpdatedAt:        now,
		Badges:           []string{},
	}

	_, err = s.userRepo.Create(ctx, user)
	if err != nil {
		return err
	}

	return s.emailSender.SendVerificationEmail(email, verificationCode)
}

func (s *authServiceImpl) Login(ctx context.Context, email, password string) (*models.User, string, error) {
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return nil, "", errors.New("invalid email or password")
	}

	if !user.IsVerified {
		return nil, "", errors.New("email not verified")
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, "", errors.New("invalid email or password")
	}

	token, err := GenerateJWT(user.Email, s.config.JWT.Secret, s.config.JWT.Expiry)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}

func (s *authServiceImpl) VerifyEmail(ctx context.Context, email, code string) (*models.User, string, error) {
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return nil, "", errors.New("invalid email or code")
	}

	if user.VerificationCode != code {
		return nil, "", errors.New("invalid email or code")
	}

	if time.Since(user.CreatedAt) > 24*time.Hour {
		return nil, "", errors.New("verification code expired")
	}

	update := map[string]interface{}{
		"$set": map[string]interface{}{
			"isVerified":       true,
			"verificationCode": "",
			"updatedAt":        time.Now(),
		},
	}
	
	err = s.userRepo.UpdateByEmail(ctx, email, update)
	if err != nil {
		return nil, "", err
	}

	user.IsVerified = true // Update local object
	token, err := GenerateJWT(user.Email, s.config.JWT.Secret, s.config.JWT.Expiry)
	
	return user, token, err
}

// GenerateJWT generates a new JWT token
// Exported this as it was a private helper in controller
func GenerateJWT(email, secret string, expiryMinutes int) (string, error) {
	now := time.Now()
	expirationTime := now.Add(time.Minute * time.Duration(expiryMinutes))

	claims := jwt.MapClaims{
		"sub": email,
		"exp": expirationTime.Unix(),
		"iat": now.Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
