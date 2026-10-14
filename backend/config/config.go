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
		Username    string `yaml:"username"`    // Gmail address
		Password    string `yaml:"password"`    // App Password
		SenderEmail string `yaml:"senderEmail"` // Same as Username for Gmail
		SenderName  string `yaml:"senderName"`
	} `yaml:"smtp"`

	GoogleOAuth struct {
		ClientID string `yaml:"clientID"`
	} `yaml:"googleOAuth"`

	LLMRateLimit struct {
		MaxRequests   int `yaml:"maxRequests"`
		WindowSeconds int `yaml:"windowSeconds"`
	} `yaml:"llmRateLimit"`
}

const (
	DefaultLLMRateLimitMaxRequests   = 10
	DefaultLLMRateLimitWindowSeconds = 60
)

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
	if cfg.LLMRateLimit.MaxRequests == 0 {
		cfg.LLMRateLimit.MaxRequests = DefaultLLMRateLimitMaxRequests
	}
	if cfg.LLMRateLimit.WindowSeconds == 0 {
		cfg.LLMRateLimit.WindowSeconds = DefaultLLMRateLimitWindowSeconds
	}

	// Override with environment variables if present
	if envPort := os.Getenv("PORT"); envPort != "" {
		fmt.Sscanf(envPort, "%d", &cfg.Server.Port)
	}

	if envDB := os.Getenv("DATABASE_URI"); envDB != "" {
		cfg.Database.URI = envDB
	}
	if envRedisAddr := os.Getenv("REDIS_ADDR"); envRedisAddr != "" {
		cfg.Redis.Addr = envRedisAddr
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

	if envMax := os.Getenv("LLM_RATE_LIMIT_MAX"); envMax != "" {
		max, err := strconv.Atoi(envMax)
		if err != nil {
			return nil, fmt.Errorf("invalid LLM_RATE_LIMIT_MAX: %w", err)
		}
		cfg.LLMRateLimit.MaxRequests = max
	}
	if envWindow := os.Getenv("LLM_RATE_LIMIT_WINDOW_SECONDS"); envWindow != "" {
		window, err := strconv.Atoi(envWindow)
		if err != nil {
			return nil, fmt.Errorf("invalid LLM_RATE_LIMIT_WINDOW_SECONDS: %w", err)
		}
		cfg.LLMRateLimit.WindowSeconds = window
	}

	return &cfg, nil
}

func (c *Config) ValidateLLMRateLimit() error {
	if c.LLMRateLimit.MaxRequests <= 0 {
		return fmt.Errorf("LLM rate-limit max requests must be greater than zero")
	}
	if c.LLMRateLimit.WindowSeconds <= 0 {
		return fmt.Errorf("LLM rate-limit window seconds must be greater than zero")
	}
	return nil
}
