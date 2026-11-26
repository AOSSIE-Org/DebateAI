package config

import (
	"fmt"
	"os"
	"strconv"

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

func setStringEnv(name string, target *string) {
	if value := os.Getenv(name); value != "" {
		*target = value
	}
}

func setIntEnv(name string, target *int) error {
	value := os.Getenv(name)
	if value == "" {
		return nil
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fmt.Errorf("invalid integer in %s: %w", name, err)
	}

	*target = parsed
	return nil
}

// LoadConfig reads YAML configuration and applies environment overrides.
func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal yaml: %w", err)
	}

	stringOverrides := []struct {
		name   string
		target *string
	}{
		{"COGNITO_APP_CLIENT_ID", &cfg.Cognito.AppClientId},
		{"COGNITO_APP_CLIENT_SECRET", &cfg.Cognito.AppClientSecret},
		{"COGNITO_USER_POOL_ID", &cfg.Cognito.UserPoolId},
		{"COGNITO_REGION", &cfg.Cognito.Region},
		{"OPENAI_API_KEY", &cfg.Openai.GptApiKey},
		{"GEMINI_API_KEY", &cfg.Gemini.ApiKey},
		{"DATABASE_URI", &cfg.Database.URI},
		{"REDIS_ADDR", &cfg.Redis.Addr},
		{"REDIS_PASSWORD", &cfg.Redis.Password},
		{"JWT_SECRET", &cfg.JWT.Secret},
		{"SMTP_HOST", &cfg.SMTP.Host},
		{"SMTP_USERNAME", &cfg.SMTP.Username},
		{"SMTP_PASSWORD", &cfg.SMTP.Password},
		{"SMTP_SENDER_EMAIL", &cfg.SMTP.SenderEmail},
		{"SMTP_SENDER_NAME", &cfg.SMTP.SenderName},
		{"GOOGLE_CLIENT_ID", &cfg.GoogleOAuth.ClientID},
	}

	for _, override := range stringOverrides {
		setStringEnv(override.name, override.target)
	}

	intOverrides := []struct {
		name   string
		target *int
	}{
		{"PORT", &cfg.Server.Port},
		{"REDIS_DB", &cfg.Redis.DB},
		{"JWT_EXPIRY", &cfg.JWT.Expiry},
		{"SMTP_PORT", &cfg.SMTP.Port},
	}

	for _, override := range intOverrides {
		if err := setIntEnv(override.name, override.target); err != nil {
			return nil, err
		}
	}

	return &cfg, nil
}
