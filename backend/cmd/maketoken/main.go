package main

import (
    "fmt"
    "arguehub/config"
    "arguehub/utils"
)

func main() {
    cfg, err := config.LoadConfig("./config/config.prod.yml")
    if err != nil {
        fmt.Println("failed to load config:", err)
        return
    }
    utils.SetJWTSecret(cfg.JWT.Secret)

    // Generate a token for the seeded test user (user1@example.com).
    token, err := utils.GenerateJWTToken("test-user-id", "user1@example.com")
    if err != nil {
        fmt.Println("failed to generate token:", err)
        return
    }
    fmt.Println(token)
}
