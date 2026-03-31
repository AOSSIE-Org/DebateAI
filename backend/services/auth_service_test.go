package services

import (
	"context"
	"errors"
	"testing"

	"arguehub/config"
	"arguehub/models"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

// MockEmailSender
type MockEmailSender struct {
	mock.Mock
}

func (m *MockEmailSender) SendVerificationEmail(email, code string) error {
	args := m.Called(email, code)
	return args.Error(0)
}

// MockUserRepository is a mock implementation of repositories.UserRepository
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) Create(ctx context.Context, user *models.User) (*models.User, error) {
	args := m.Called(ctx, user)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) UpdateByID(ctx context.Context, id primitive.ObjectID, update interface{}) error {
	args := m.Called(ctx, id, update)
	return args.Error(0)
}

func (m *MockUserRepository) UpdateByEmail(ctx context.Context, email string, update interface{}) error {
	args := m.Called(ctx, email, update)
	return args.Error(0)
}

func TestAuthService_SignUp(t *testing.T) {
	testConfig := &config.Config{}
	testConfig.JWT.Secret = "secret"
	testConfig.JWT.Expiry = 60

	t.Run("Success", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		mockEmail := new(MockEmailSender)
		service := NewAuthService(mockRepo, mockEmail, testConfig)
		ctx := context.Background()
		email := "test@example.com"
		password := "password123"

		// Expect FindByEmail to return error (user doesn't exist)
		mockRepo.On("FindByEmail", ctx, email).Return(nil, errors.New("not found"))

		// Expect Create to succeed
		mockRepo.On("Create", ctx, mock.AnythingOfType("*models.User")).Return(&models.User{Email: email}, nil)

		// Expect SendVerificationEmail
		mockEmail.On("SendVerificationEmail", email, mock.AnythingOfType("string")).Return(nil)

		err := service.SignUp(ctx, email, password)
		assert.NoError(t, err)
	})

	t.Run("UserAlreadyExists", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		mockEmail := new(MockEmailSender)
		service := NewAuthService(mockRepo, mockEmail, testConfig)
		ctx := context.Background()
		email := "existing@example.com"
		password := "password123"

		// Expect FindByEmail to return user
		mockRepo.On("FindByEmail", ctx, email).Return(&models.User{Email: email}, nil)

		err := service.SignUp(ctx, email, password)
		assert.Error(t, err)
		assert.Equal(t, "user already exists", err.Error())
	})
}

func TestAuthService_Login(t *testing.T) {
	testConfig := &config.Config{}
	testConfig.JWT.Secret = "secret"
	testConfig.JWT.Expiry = 60

	t.Run("Success", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		mockEmail := new(MockEmailSender)
		service := NewAuthService(mockRepo, mockEmail, testConfig)
		ctx := context.Background()
		email := "test@example.com"
		password := "password123"

		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		user := &models.User{
			Email:      email,
			Password:   string(hashedPassword),
			IsVerified: true,
		}

		mockRepo.On("FindByEmail", ctx, email).Return(user, nil)

		foundUser, token, err := service.Login(ctx, email, password)
		assert.NoError(t, err)
		assert.NotNil(t, foundUser)
		assert.NotEmpty(t, token)
	})

	t.Run("WrongPassword", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		mockEmail := new(MockEmailSender)
		service := NewAuthService(mockRepo, mockEmail, testConfig)
		ctx := context.Background()
		email := "test@example.com"
		password := "password123"
		wrongPassword := "wrongpass"

		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		user := &models.User{
			Email:      email,
			Password:   string(hashedPassword),
			IsVerified: true,
		}

		mockRepo.On("FindByEmail", ctx, email).Return(user, nil)

		_, _, err := service.Login(ctx, email, wrongPassword)
		assert.Error(t, err)
		assert.Equal(t, "invalid email or password", err.Error())
	})

	t.Run("Unverified", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		mockEmail := new(MockEmailSender)
		service := NewAuthService(mockRepo, mockEmail, testConfig)
		ctx := context.Background()
		email := "test@example.com"
		password := "password123"

		user := &models.User{
			Email:      email,
			IsVerified: false,
		}

		mockRepo.On("FindByEmail", ctx, email).Return(user, nil)

		_, _, err := service.Login(ctx, email, password)
		assert.Error(t, err)
		assert.Equal(t, "email not verified", err.Error())
	})
}
