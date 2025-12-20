package config

import (
	"fmt"
	"io/ioutil"

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
	}

	SMTP struct { // Add SMTP configuration
		Host        string
		Port        int
		Username    string // Gmail address
		Password    string // App Password
		SenderEmail string // Same as Username for Gmail
		SenderName  string
	}
	GoogleOAuth struct {
		ClientID string `yaml:"clientID"`
	}
	Redis struct {
		URL      string `yaml:"url"`
		Password string `yaml:"password"`
		DB       int    `yaml:"db"`
	}
}

// LoadConfig reads the configuration file
func LoadConfig(path string) (*Config, error) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal yaml: %w", err)
	}

	return &cfg, nil
}
