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
}

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