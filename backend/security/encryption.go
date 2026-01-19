package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"sync"
)

var (
	encryptionKey []byte
	keyOnce       sync.Once
)

// SetEncryptionKey sets the key used for AES-GCM encryption. It returns an error if the key is empty.
func SetEncryptionKey(key string) error {
	if key == "" {
		return fmt.Errorf("encryption key cannot be empty")
	}

	keyOnce.Do(func() {
		b := []byte(key)
		if len(b) > 32 {
			encryptionKey = b[:32]
		} else if len(b) < 32 {
			padded := make([]byte, 32)
			copy(padded, b)
			encryptionKey = padded
		} else {
			encryptionKey = b
		}
	})

	return nil
}

func getEncryptionKey() ([]byte, error) {
	if encryptionKey == nil {
		return nil, fmt.Errorf("encryption key not set")
	}
	return encryptionKey, nil
}

// Encrypt encrypts plainText using AES-GCM
func Encrypt(plainText string) (string, error) {
	key, err := getEncryptionKey()
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	cipherText := gcm.Seal(nonce, nonce, []byte(plainText), nil)
	return base64.StdEncoding.EncodeToString(cipherText), nil
}

// Decrypt decrypts cipherText using AES-GCM
func Decrypt(encodedCipherText string) (string, error) {
	cipherText, err := base64.StdEncoding.DecodeString(encodedCipherText)
	if err != nil {
		return "", err
	}

	key, err := getEncryptionKey()
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(cipherText) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, actualCipherText := cipherText[:nonceSize], cipherText[nonceSize:]
	plainText, err := gcm.Open(nil, nonce, actualCipherText, nil)
	if err != nil {
		return "", err
	}

	return string(plainText), nil
}
