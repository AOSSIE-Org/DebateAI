package main

import (
	"testing"

	"arguehub/config"
)

func TestSetupRouterDoesNotPanic(t *testing.T) {
	// Construct the real router without starting services or connecting to MongoDB.
	setupRouter(&config.Config{})
}
