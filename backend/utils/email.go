package utils

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"net/smtp"
	"strings"

	"arguehub/config"
)

// ProductName is the public-facing name of the platform. Every user-facing
// email is branded from this constant so the name cannot drift between
// templates (it was previously hard-coded as "ArgueHub" in some subjects).
const ProductName = "DebateAI"

// GenerateRandomCode generates a random numeric code of specified length
func GenerateRandomCode(length int) string {
	const charset = "0123456789"
	code := make([]byte, length)
	for i := 0; i < length; i++ {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			// Fallback to a default code in case of error
			return strings.Repeat("0", length)
		}
		code[i] = charset[num.Int64()]
	}
	return string(code)
}

// buildVerificationEmail renders the account-verification email message.
func buildVerificationEmail(to, senderName, senderEmail, code string) []byte {
	return []byte(fmt.Sprintf(
		"To: %s\r\n"+
			"From: %s <%s>\r\n"+
			"Subject: Verify Your "+ProductName+" Account\r\n"+
			"MIME-Version: 1.0\r\n"+
			"Content-Type: text/html; charset=\"UTF-8\"\r\n"+
			"\r\n"+
			"<h2>Welcome to "+ProductName+"!</h2>\r\n"+
			"<p>Your verification code is: <strong>%s</strong></p>\r\n"+
			"<p><em>This code will expire in 24 hours.</em></p>\r\n",
		to, senderName, senderEmail, code))
}

// buildPasswordResetEmail renders the password-reset email message.
func buildPasswordResetEmail(to, senderName, senderEmail, code string) []byte {
	return []byte(fmt.Sprintf(
		"To: %s\r\n"+
			"From: %s <%s>\r\n"+
			"Subject: "+ProductName+" Password Reset\r\n"+
			"MIME-Version: 1.0\r\n"+
			"Content-Type: text/html; charset=\"UTF-8\"\r\n"+
			"\r\n"+
			"<p>Your password reset code is: <strong>%s</strong></p>\r\n"+
			"<p>This code will expire in 15 minutes.</p>\r\n",
		to, senderName, senderEmail, code))
}

// SendVerificationEmail sends an email with a verification code using Gmail SMTP
func SendVerificationEmail(email, code string) error {
	cfg, err := config.LoadConfig(configPath())
	if err != nil {
		return fmt.Errorf("failed to load config: %v", err)
	}

	auth := smtp.PlainAuth("", cfg.SMTP.Username, cfg.SMTP.Password, cfg.SMTP.Host)
	to := []string{email}
	msg := buildVerificationEmail(email, cfg.SMTP.SenderName, cfg.SMTP.SenderEmail, code)

	addr := fmt.Sprintf("%s:%d", cfg.SMTP.Host, cfg.SMTP.Port)
	err = smtp.SendMail(addr, auth, cfg.SMTP.SenderEmail, to, msg)
	if err != nil {
		return fmt.Errorf("failed to send verification email: %v", err)
	}
	return nil
}

// SendPasswordResetEmail sends an email with a password reset code using Gmail SMTP
func SendPasswordResetEmail(email, code string) error {
	cfg, err := config.LoadConfig(configPath())
	if err != nil {
		return fmt.Errorf("failed to load config: %v", err)
	}

	auth := smtp.PlainAuth("", cfg.SMTP.Username, cfg.SMTP.Password, cfg.SMTP.Host)
	to := []string{email}
	msg := buildPasswordResetEmail(email, cfg.SMTP.SenderName, cfg.SMTP.SenderEmail, code)

	addr := fmt.Sprintf("%s:%d", cfg.SMTP.Host, cfg.SMTP.Port)
	err = smtp.SendMail(addr, auth, cfg.SMTP.SenderEmail, to, msg)
	if err != nil {
		return fmt.Errorf("failed to send password reset email: %v", err)
	}
	return nil
}
