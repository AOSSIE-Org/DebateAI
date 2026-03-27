package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server struct {
		Port int `yaml:"port"`
	} `yaml:"server"`

	Cognito struct {
		AppClientId     string `yaml:"appClientId"`
		AppClientSecret string `yaml:"appClientSecret"`
		UserPoolId      string `yaml:"userPoolId"`
		Region          string `yaml:"region"`
	} `yaml:"cognito"`

	Openai struct {
		GptApiKey string `yaml:"gptApiKey"`
	} `yaml:"openai"`

	Gemini struct {
		ApiKey string `yaml:"apiKey"`
	} `yaml:"gemini"`

	Database struct {
		URI string `yaml:"uri"`
	} `yaml:"database"`

	Redis struct {
		Addr     string `yaml:"addr"`
		Password string `yaml:"password"`
		DB       int    `yaml:"db"`
	} `yaml:"redis"`

	JWT struct {
		Secret string `yaml:"secret"`
		Expiry int    `yaml:"expiry"`
	} `yaml:"jwt"`

	SMTP struct {
		Host        string `yaml:"host"`
		Port        int    `yaml:"port"`
		Username    string `yaml:"username"`
		Password    string `yaml:"password"`
		SenderEmail string `yaml:"senderEmail"`
		SenderName  string `yaml:"senderName"`
	} `yaml:"smtp"`

	GoogleOAuth struct {
		ClientID string `yaml:"clientID"`
	} `yaml:"googleOAuth"`
}

// LoadConfig reads the configuration file
func LoadConfig(path string) (*Config, error) {

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal yaml: %w", err)
	}

	if envPort := os.Getenv("PORT"); envPort != "" {
		fmt.Sscanf(envPort, "%d", &cfg.Server.Port)
	}

	if envDB := os.Getenv("DATABASE_URI"); envDB != "" {
		cfg.Database.URI = envDB
	}
	if envGemini := os.Getenv("GEMINI_API_KEY"); envGemini != "" {
		cfg.Gemini.ApiKey = envGemini
	}
	if envJWT := os.Getenv("JWT_SECRET"); envJWT != "" {
		cfg.JWT.Secret = envJWT
	}
	if envGoogleClient := os.Getenv("GOOGLE_CLIENT_ID"); envGoogleClient != "" {
		cfg.GoogleOAuth.ClientID = envGoogleClient
	}

	if err := validateConfig(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func validateConfig(cfg *Config) error {

	if cfg.Server.Port == 0 {
		return fmt.Errorf("server.port is required")
	}
	if cfg.Database.URI == "" {
		return fmt.Errorf("database.uri is required")
	}
	if cfg.JWT.Secret == "" {
		return fmt.Errorf("jwt.secret is required")
	}
	if cfg.Gemini.ApiKey == "" {
		return fmt.Errorf("gemini.apiKey is required")
	}
	if cfg.GoogleOAuth.ClientID == "" {
		return fmt.Errorf("googleOAuth.clientID is required")
	}

	return nil
}
