package services

import (
	"log"

	"arguehub/config"
	"arguehub/repositories"
)

var (
	authService AuthService
)

// InitAuthService initializes the global AuthService instance
func InitAuthService(cfg *config.Config) {
	userRepo := repositories.NewMongoUserRepository()
	emailSender := NewEmailSender()
	authService = NewAuthService(userRepo, emailSender, cfg)
	log.Println("AuthService initialized")
}

// GetAuthService returns the global AuthService instance
func GetAuthService() AuthService {
	if authService == nil {
		log.Fatal("AuthService not initialized")
	}
	return authService
}
