package utils

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"net/smtp"
	"strings"

	"arguehub/config"
)

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

// SendVerificationEmail sends an email with a verification code using Gmail SMTP
func SendVerificationEmail(email, code string) error {
	cfg, err := config.LoadConfig("./config/config.prod.yml")
	if err != nil {
		return fmt.Errorf("failed to load config: %v", err)
	}

	auth := smtp.PlainAuth("", cfg.SMTP.Username, cfg.SMTP.Password, cfg.SMTP.Host)
	to := []string{email}
	msg := []byte(fmt.Sprintf(
		"To: %s\r\n"+
			"From: %s <%s>\r\n"+
			"Subject: Verify Your ArgueHub Account\r\n"+
			"MIME-Version: 1.0\r\n"+
			"Content-Type: text/html; charset=\"UTF-8\"\r\n"+
			"\r\n"+
			"<h2>Welcome to ArgueHub!</h2>\r\n"+
			"<p>Your verification code is: <strong>%s</strong></p>\r\n"+
			"<p><em>This code will expire in 24 hours.</em></p>\r\n",
		email, cfg.SMTP.SenderName, cfg.SMTP.SenderEmail, code))

	addr := fmt.Sprintf("%s:%d", cfg.SMTP.Host, cfg.SMTP.Port)
	err = smtp.SendMail(addr, auth, cfg.SMTP.SenderEmail, to, msg)
	if err != nil {
		return fmt.Errorf("failed to send verification email: %v", err)
	}
	return nil
}

// SendPasswordResetEmail sends an email with a password reset code using Gmail SMTP
func SendPasswordResetEmail(email, code string) error {
	cfg, err := config.LoadConfig("./config/config.prod.yml")
	if err != nil {
		return fmt.Errorf("failed to load config: %v", err)
	}

	auth := smtp.PlainAuth("", cfg.SMTP.Username, cfg.SMTP.Password, cfg.SMTP.Host)
	to := []string{email}
	msg := []byte(fmt.Sprintf(
		"To: %s\r\n"+
			"From: %s <%s>\r\n"+
			"Subject: ArgueHub Password Reset\r\n"+
			"MIME-Version: 1.0\r\n"+
			"Content-Type: text/html; charset=\"UTF-8\"\r\n"+
			"\r\n"+
			"<p>Your password reset code is: <strong>%s</strong></p>\r\n",
		email, cfg.SMTP.SenderName, cfg.SMTP.SenderEmail, code))

	addr := fmt.Sprintf("%s:%d", cfg.SMTP.Host, cfg.SMTP.Port)
	err = smtp.SendMail(addr, auth, cfg.SMTP.SenderEmail, to, msg)
	if err != nil {
		return fmt.Errorf("failed to send password reset email: %v", err)
	}
	return nil
}
