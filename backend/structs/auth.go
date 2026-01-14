package structs

type SignUpRequest struct {
	Email string `json:"email" binding:"required,email"`
	// NIST SP 800-63B: minimum 15 characters for password-only authentication
	Password string `json:"password" binding:"required,min=15"`
}

type VerifyEmailRequest struct {
	Email            string `json:"email" binding:"required,email"`
	ConfirmationCode string `json:"confirmationCode" binding:"required"`
}

type LoginRequest struct {
	Email string `json:"email" binding:"required,email"`
	// NIST SP 800-63B: minimum 15 characters for password-only authentication
	Password string `json:"password" binding:"required,min=15"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type VerifyForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required"`
	// NIST SP 800-63B: minimum 15 characters for password-only authentication
	NewPassword string `json:"newPassword" binding:"required,min=15"`
}
