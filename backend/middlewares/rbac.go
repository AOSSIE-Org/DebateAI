package middlewares

import (
	"arguehub/config"
	"arguehub/db"
	"arguehub/models"
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/casbin/casbin/v2"
	"github.com/casbin/casbin/v2/model"
	mongodbadapter "github.com/casbin/mongodb-adapter/v3"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var enforcer *casbin.Enforcer

// InitCasbin initializes Casbin enforcer with MongoDB adapter
func InitCasbin(configPath string) error {
	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Create MongoDB adapter for Casbin
	// NewAdapter only takes URL and optional timeout
	// Database name should be in the URI, collection defaults to 'casbin_rule'
	adapter, err := mongodbadapter.NewAdapter(cfg.Database.URI)
	if err != nil {
		return fmt.Errorf("failed to create Casbin adapter: %w", err)
	}

	// Create enforcer with RBAC model
	// Try to load from config file, fallback to inline model
	// Try multiple possible paths
	modelPaths := []string{"./rbac_model.conf", "../rbac_model.conf", "./backend/rbac_model.conf"}
	var enforcerErr error
	for _, modelPath := range modelPaths {
		enforcer, enforcerErr = casbin.NewEnforcer(modelPath, adapter)
		if enforcerErr == nil {
			log.Printf("Loaded Casbin model from: %s", modelPath)
			break
		}
	}
	err = enforcerErr
	if err != nil {
		// If model file doesn't exist, create a default enforcer with inline model
		modelText := `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
`
		// Create model from string
		m, err := model.NewModelFromString(modelText)
		if err != nil {
			return fmt.Errorf("failed to create Casbin model: %w", err)
		}
		
		// Create enforcer with model and adapter
		enforcer, err = casbin.NewEnforcer(m, adapter)
		if err != nil {
			return fmt.Errorf("failed to create Casbin enforcer: %w", err)
		}
		// Set default policies
		enforcer.AddPolicy("admin", "debate", "delete")
		enforcer.AddPolicy("admin", "comment", "delete")
		enforcer.AddPolicy("admin", "user", "read")
		enforcer.AddPolicy("admin", "analytics", "read")
		enforcer.AddPolicy("moderator", "comment", "delete")
		enforcer.AddPolicy("moderator", "user", "read")
	}

	// Load policies
	if err := enforcer.LoadPolicy(); err != nil {
		return fmt.Errorf("failed to load policy: %w", err)
	}

	// Ensure default policies exist (idempotent - won't add duplicates)
	ensureDefaultPolicies()

	log.Println("Casbin RBAC initialized successfully")
	return nil
}

// ensureDefaultPolicies ensures that default RBAC policies exist in the database
func ensureDefaultPolicies() {
	// Define default policies
	defaultPolicies := []struct {
		role     string
		resource string
		action   string
	}{
		{"admin", "debate", "delete"},
		{"admin", "comment", "delete"},
		{"admin", "user", "read"},
		{"admin", "analytics", "read"},
		{"moderator", "comment", "delete"},
		{"moderator", "user", "read"},
	}

	// Add policies if they don't exist
	for _, policy := range defaultPolicies {
		exists, _ := enforcer.HasPolicy(policy.role, policy.resource, policy.action)
		if !exists {
			enforcer.AddPolicy(policy.role, policy.resource, policy.action)
			log.Printf("Added default policy: %s can %s %s", policy.role, policy.action, policy.resource)
		}
	}
	
	// Save policies to database
	if err := enforcer.SavePolicy(); err != nil {
		log.Printf("Warning: Failed to save policies: %v", err)
	}
}

// AdminAuthMiddleware authenticates admin users and checks RBAC permissions
func AdminAuthMiddleware(configPath string) gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg, err := config.LoadConfig(configPath)
		if err != nil {
			log.Printf("Failed to load config: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load configuration"})
			c.Abort()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			c.Abort()
			return
		}

		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			c.Abort()
			return
		}

		claims, err := validateAdminJWT(tokenParts[1], cfg.JWT.Secret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token", "message": err.Error()})
			c.Abort()
			return
		}

		email := claims["sub"].(string)
		
		// Check if user is an admin
		dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		var admin models.Admin
		err = db.MongoDatabase.Collection("admins").FindOne(dbCtx, bson.M{"email": email}).Decode(&admin)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}

		// Set admin data in context
		c.Set("adminEmail", email)
		c.Set("adminID", admin.ID)
		c.Set("adminRole", admin.Role)
		c.Next()
	}
}

// RBACMiddleware checks if the admin has permission for the requested action
func RBACMiddleware(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		adminRole, exists := c.Get("adminRole")
		if !exists {
			log.Printf("RBACMiddleware: Admin role not found in context")
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin role not found"})
			c.Abort()
			return
		}

		role := adminRole.(string)
		log.Printf("RBACMiddleware: Checking permission for role=%s, resource=%s, action=%s", role, resource, action)
		
		// Check permission using Casbin
		allowed, err := enforcer.Enforce(role, resource, action)
		if err != nil {
			log.Printf("Casbin enforce error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Permission check failed"})
			c.Abort()
			return
		}

		if !allowed {
			log.Printf("RBACMiddleware: Permission denied for role=%s, resource=%s, action=%s", role, resource, action)
			// Check if policy exists
			hasPolicy, _ := enforcer.HasPolicy(role, resource, action)
			log.Printf("RBACMiddleware: Policy exists: %v", hasPolicy)
			c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			c.Abort()
			return
		}

		log.Printf("RBACMiddleware: Permission granted for role=%s, resource=%s, action=%s", role, resource, action)
		c.Next()
	}
}

// GetEnforcer returns the Casbin enforcer instance
func GetEnforcer() *casbin.Enforcer {
	return enforcer
}

// AddAdminRole adds an admin role for a user
func AddAdminRole(email, role string) error {
	// This would typically be called during admin creation
	// For now, we'll just ensure the admin exists in the database
	return nil
}

// LogAdminAction logs an admin action for audit purposes
func LogAdminAction(c *gin.Context, action, resourceType string, resourceID primitive.ObjectID, details map[string]interface{}) error {
	adminID, exists := c.Get("adminID")
	if !exists {
		return fmt.Errorf("adminID not found in context")
	}
	
	adminEmail, exists := c.Get("adminEmail")
	if !exists {
		return fmt.Errorf("adminEmail not found in context")
	}
	
	ipAddress := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")
	
	// Extract device info from User-Agent (simplified)
	deviceInfo := "Unknown"
	if strings.Contains(userAgent, "Mobile") {
		deviceInfo = "Mobile"
	} else if strings.Contains(userAgent, "Tablet") {
		deviceInfo = "Tablet"
	} else {
		deviceInfo = "Desktop"
	}

	logEntry := models.AdminActionLog{
		ID:           primitive.NewObjectID(),
		AdminID:      adminID.(primitive.ObjectID),
		AdminEmail:   adminEmail.(string),
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		DeviceInfo:   deviceInfo,
		Timestamp:    time.Now(),
		Details:      details,
	}

	collection := db.MongoDatabase.Collection("admin_action_logs")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := collection.InsertOne(ctx, logEntry)
	return err
}

// validateAdminJWT validates JWT token for admin authentication
func validateAdminJWT(tokenString, secret string) (map[string]interface{}, error) {
	// Reuse the validateJWT from auth.go by importing it, or define here
	// For now, we'll define it here to avoid circular dependencies
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		result := make(map[string]interface{})
		for k, v := range claims {
			result[k] = v
		}
		return result, nil
	}
	return nil, fmt.Errorf("invalid token")
}

