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
	email := flag.String("email", "", "Admin email (required)")
	password := flag.String("password", "", "Admin password (required)")
	name := flag.String("name", "", "Admin name (required)")
	role := flag.String("role", "admin", "Admin role: 'admin' or 'moderator' (default: admin)")
	configPath := flag.String("config", "config/config.prod.yml", "Path to config file")
	flag.Parse()

	// Validate required fields
	if *email == "" || *password == "" || *name == "" {
		fmt.Println("Error: email, password, and name are required")
		fmt.Println("\nUsage:")
		flag.PrintDefaults()
		os.Exit(1)
	}

	// Validate role
	if *role != "admin" && *role != "moderator" {
		fmt.Println("Error: role must be 'admin' or 'moderator'")
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

	// Check if admin already exists
	dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existingAdmin models.Admin
	err = db.MongoDatabase.Collection("admins").FindOne(dbCtx, bson.M{"email": *email}).Decode(&existingAdmin)
	if err == nil {
		log.Fatalf("Admin with email %s already exists", *email)
	}
	if err != mongo.ErrNoDocuments {
		log.Fatalf("Database error: %v", err)
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Create new admin
	now := time.Now()
	newAdmin := models.Admin{
		Email:     *email,
		Password:  string(hashedPassword),
		Role:      *role,
		Name:      *name,
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Insert admin into database
	result, err := db.MongoDatabase.Collection("admins").InsertOne(dbCtx, newAdmin)
	if err != nil {
		log.Fatalf("Failed to create admin: %v", err)
	}

	fmt.Printf("✅ Admin created successfully!\n")
	fmt.Printf("   ID: %s\n", result.InsertedID)
	fmt.Printf("   Email: %s\n", *email)
	fmt.Printf("   Name: %s\n", *name)
	fmt.Printf("   Role: %s\n", *role)
}

