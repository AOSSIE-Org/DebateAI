package tests

import (
	"os"
	"testing"

	"arguehub/internal/testkit"

	"github.com/gin-gonic/gin"
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	configPath := testkit.ConfigPath()
	if configPath == "" {
		panic("backend/testdata/config.test.yml was not found")
	}
	if err := os.Setenv("CONFIG_PATH", configPath); err != nil {
		panic(err)
	}
	// Pin the signing key so a developer JWT_SECRET in the environment cannot
	// make token assertions depend on a machine-local secret.
	if err := os.Setenv("JWT_SECRET", testkit.JWTSecret); err != nil {
		panic(err)
	}
	if err := os.Setenv("JWT_EXPIRY", "60"); err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}
