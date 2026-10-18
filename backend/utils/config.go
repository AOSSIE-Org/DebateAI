package utils

import "os"

// configPath returns the configured path or the default production config path.
func configPath() string {
	path := os.Getenv("CONFIG_PATH")
	if path == "" {
		return "./config/config.prod.yml"
	}
	return path
}
