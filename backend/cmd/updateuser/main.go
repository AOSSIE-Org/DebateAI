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
	password := flag.String("password", "", "New password (optional)")
	verify := flag.Bool("verify", false, "Set user as verified")
	configPath := flag.String("config", "config/config.prod.yml", "Path to config file")
	flag.Parse()

	// Validate required fields
	if *email == "" {
		fmt.Println("Error: email is required")
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

	// Check if user exists
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existingUser models.User
	err = db.MongoDatabase.Collection("users").FindOne(dbCtx, bson.M{"email": *email}).Decode(&existingUser)
	if err == mongo.ErrNoDocuments {
		log.Fatalf("User with email %s not found", *email)
	}
	if err != nil {
		log.Fatalf("Database error: %v", err)
	}

	// Prepare update document
	updateDoc := bson.M{
		"updatedAt": time.Now(),
	}

	// Update password if provided
	if *password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash password: %v", err)
		}
		updateDoc["password"] = string(hashedPassword)
	}

	// Update verification status if requested
	if *verify {
		updateDoc["isVerified"] = true
	}

	// Update user
	result, err := db.MongoDatabase.Collection("users").UpdateOne(
		dbCtx,
		bson.M{"email": *email},
		bson.M{"$set": updateDoc},
	)
	if err != nil {
		log.Fatalf("Failed to update user: %v", err)
	}

	fmt.Printf("✅ User updated successfully!\n")
	fmt.Printf("   Email: %s\n", *email)
	fmt.Printf("   Modified count: %d\n", result.ModifiedCount)
	if *password != "" {
		fmt.Printf("   Password: updated\n")
	}
	if *verify {
		fmt.Printf("   Verified: true\n")
	}
}