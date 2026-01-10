package controllers

import (
	"net/http"

	"arguehub/services"

	"github.com/gin-gonic/gin"
)

// GeneratePersonalityProfilesHandler handles the generation of personality profiles for a debate
func GeneratePersonalityProfilesHandler(c *gin.Context) {
	debateID := c.Param("id")
	if debateID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "debate ID required"})
		return
	}

	// First, check if profiles already exist
	existingProfiles, err := services.GetPersonalityProfiles(debateID)
	if err == nil && len(existingProfiles) > 0 {
		c.JSON(http.StatusOK, gin.H{
			"message":  "Profiles already exist",
			"profiles": existingProfiles,
		})
		return
	}

	// Generate new profiles
	profiles, err := services.GeneratePersonalityProfiles(debateID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Profiles generated successfully",
		"profiles": profiles,
	})
}

// GetPersonalityProfilesHandler retrieves existing personality profiles for a debate
func GetPersonalityProfilesHandler(c *gin.Context) {
	debateID := c.Param("id")
	if debateID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "debate ID required"})
		return
	}

	profiles, err := services.GetPersonalityProfiles(debateID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve profiles"})
		return
	}

	if len(profiles) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No profiles found for this debate"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"profiles": profiles})
}
