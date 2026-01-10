package main

import (
	"arguehub/config"
	"arguehub/db"
	"arguehub/models"
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// Parse command line flags
	email := flag.String("email", "", "User email (required)")
	password := flag.String("password", "", "User password (required)")
	name := flag.String("name", "", "User display name (required)")
	configPath := flag.String("config", "config/config.prod.yml", "Path to config file")
	flag.Parse()

	// Validate required fields
	if *email == "" || *password == "" || *name == "" {
		fmt.Println("Error: email, password, and name are required")
		fmt.Println("\nUsage:")
		flag.PrintDefaults()
		os.Exit(1)
	}

	// Load config
	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to MongoDB
	if err := db.ConnectMongoDB(cfg.Database.URI); err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer db.MongoClient.Disconnect(context.Background())

	// Check if user already exists
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existingUser models.User
	err = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": *email}).Decode(&existingUser)
	if err == nil {
		log.Fatalf("User with email %s already exists", *email)
	}
	if err != mongo.ErrNoDocuments {
		log.Fatalf("Database error: %v", err)
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Create new user
	now := time.Now()
	newUser := models.User{
		Email:            *email,
		Password:         string(hashedPassword),
		DisplayName:      *name,
		Nickname:         *name,
		Bio:              "Test user account",
		Rating:           1500.0,
		RD:               350.0,
		Volatility:       0.06,
		LastRatingUpdate: now,
		AvatarURL:        "https://avatar.iran.liara.run/public/10",
		IsVerified:       true, // Auto-verify for development
		Score:            0,
		Badges:           []string{},
		CurrentStreak:    0,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	// Insert user into database
	result, err := db.MongoDatabase.Collection("users").InsertOne(dbCtx, newUser)
	if err != nil {
		log.Fatalf("Failed to create user: %v", err)
	}

	fmt.Printf("✅ User created successfully!\n")
	fmt.Printf("   ID: %s\n", result.InsertedID)
	fmt.Printf("   Email: %s\n", *email)
	fmt.Printf("   Name: %s\n", *name)
	fmt.Printf("   Verified: true\n")
}