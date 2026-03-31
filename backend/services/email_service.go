package services

import "arguehub/utils"

// EmailSender defines the interface for sending emails
type EmailSender interface {
	SendVerificationEmail(email, code string) error
}

// emailSenderImpl implements EmailSender
type emailSenderImpl struct{}

// NewEmailSender creates a new EmailSender
func NewEmailSender() EmailSender {
	return &emailSenderImpl{}
}

func (s *emailSenderImpl) SendVerificationEmail(email, code string) error {
	// Delegate to the existing utility function
	return utils.SendVerificationEmail(email, code)
}
