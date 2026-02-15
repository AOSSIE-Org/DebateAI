package controllers

import (
	"context"
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"arguehub/db"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
)

const (
	maxAvatarSize    = 5 << 20 // 5 MB
	avatarUploadDir  = "./uploads/avatars"
	avatarURLPrefix  = "/uploads/avatars"
)

// allowedAvatarExtensions maps lowercase extensions to their expected MIME types.
var allowedAvatarExtensions = map[string][]string{
	".jpg":  {"image/jpeg"},
	".jpeg": {"image/jpeg"},
	".png":  {"image/png"},
}

// UploadAvatar handles avatar file uploads for authenticated users.
func UploadAvatar(c *gin.Context) {
	email := c.GetString("email")
	if email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Limit request body size
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAvatarSize+512) // small buffer for multipart overhead

	file, header, err := c.Request.FormFile("avatar")
	if err != nil {
		if err.Error() == "http: request body too large" {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "File too large. Maximum size is 5MB."})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided or invalid upload. Use key 'avatar'."})
		return
	}
	defer file.Close()

	// Validate file size (belt-and-suspenders; MaxBytesReader already limits)
	if header.Size > maxAvatarSize {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "File too large. Maximum size is 5MB."})
		return
	}

	// Validate file extension
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedMIMEs, extAllowed := allowedAvatarExtensions[ext]
	if !extAllowed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Only JPG, JPEG, and PNG files are allowed."})
		return
	}

	// Validate MIME type by reading file header
	if !validateMIMEType(file, allowedMIMEs) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File content does not match allowed image types (JPG/PNG)."})
		return
	}

	// Ensure upload directory exists
	if err := os.MkdirAll(avatarUploadDir, os.ModePerm); err != nil {
		log.Printf("UploadAvatar: Failed to create upload directory: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error. Could not prepare upload directory."})
		return
	}

	// Generate unique filename
	uniqueName := uuid.New().String() + ext
	savePath := filepath.Join(avatarUploadDir, uniqueName)

	// Save the uploaded file
	if err := c.SaveUploadedFile(header, savePath); err != nil {
		log.Printf("UploadAvatar: Failed to save file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save avatar file."})
		return
	}

	// Build the public URL
	avatarURL := fmt.Sprintf("http://localhost:1313%s/%s", avatarURLPrefix, uniqueName)

	// Update user's avatarUrl in database
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := db.MongoDatabase.Collection("users").UpdateOne(
		dbCtx,
		bson.M{"email": email},
		bson.M{"$set": bson.M{
			"avatarUrl": avatarURL,
			"updatedAt": time.Now(),
		}},
	)
	if err != nil {
		log.Printf("UploadAvatar: Failed to update user avatar in DB: %v", err)
		// File was saved but DB failed — still return the URL so the frontend can retry
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Avatar saved but failed to update profile. Please try again."})
		return
	}
	if result.MatchedCount == 0 {
		log.Printf("UploadAvatar: No user found with email: %s", email)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found."})
		return
	}

	log.Printf("UploadAvatar: Successfully uploaded avatar for %s → %s", email, avatarURL)

	c.JSON(http.StatusOK, gin.H{
		"message":    "Avatar uploaded successfully",
		"avatar_url": avatarURL,
	})
}

// validateMIMEType reads the first 512 bytes to detect the real content type.
func validateMIMEType(file multipart.File, allowedMIMEs []string) bool {
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil {
		return false
	}

	// Reset reader position for subsequent reads
	if seeker, ok := file.(interface{ Seek(int64, int) (int64, error) }); ok {
		seeker.Seek(0, 0)
	}

	detectedType := http.DetectContentType(buf[:n])
	for _, mime := range allowedMIMEs {
		if detectedType == mime {
			return true
		}
	}
	return false
}
