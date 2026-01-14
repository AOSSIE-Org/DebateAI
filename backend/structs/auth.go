package structs

type SignUpRequest struct {
	Email string `json:"email" binding:"required,email"`
	// NIST SP 800-63B requires minimum 8 characters; enforcing 15 as stricter policy
	Password string `json:"password" binding:"required,min=15"`
}

type VerifyEmailRequest struct {
	Email            string `json:"email" binding:"required,email"`
	ConfirmationCode string `json:"confirmationCode" binding:"required"`
}

type LoginRequest struct {
	Email string `json:"email" binding:"required,email"`
	// No minimum length on login to allow existing users with shorter passwords
	Password string `json:"password" binding:"required"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type VerifyForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required"`
	// NIST SP 800-63B requires minimum 8 characters; enforcing 15 as stricter policy
	NewPassword string `json:"newPassword" binding:"required,min=15"`
}
