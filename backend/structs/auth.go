package structs

// SignUpRequest represents the payload for user registration
type SignUpRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

// VerifyEmailRequest represents the payload for email verification
type VerifyEmailRequest struct {
	Email            string `json:"email"`
	ConfirmationCode string `json:"confirmationCode" binding:"required"`
	Token            string `json:"token"`
}

// LoginRequest represents the payload for user login
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

// ForgotPasswordRequest represents the payload for initiating password reset
type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// VerifyForgotPasswordRequest represents the payload for completing password reset
type VerifyForgotPasswordRequest struct {
	Email       string `json:"email" binding:"required,email"`
	Code        string `json:"code" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required,min=8"`
}
