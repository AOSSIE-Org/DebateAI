package controllers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func UploadAvatar(c *gin.Context) {
	// Enforce max file size: 5MB
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 5<<20)

	file, err := c.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to retrieve the file or file too large. Max 5MB allowed."})
		return
	}

	// Validate file types: .jpg, .jpeg, .png
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Only JPG, JPEG, and PNG are allowed."})
		return
	}

	// Ensure upload directory exists
	uploadDir := "./uploads/avatars"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Generate a unique filename and save file
	newFilename := uuid.New().String() + ext
	savePath := filepath.Join(uploadDir, newFilename)

	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Return public URL
	baseURL := "http://localhost:1313"
	publicURL := fmt.Sprintf("%s/uploads/avatars/%s", baseURL, newFilename)

	c.JSON(http.StatusOK, gin.H{"avatarUrl": publicURL})
}
