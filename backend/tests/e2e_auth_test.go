package tests

import (
	"context"
	"net/http"
	"testing"
	"time"

	"arguehub/internal/testkit"
	"arguehub/models"
	"arguehub/structs"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
)

func TestAuthDatabaseFlow(t *testing.T) {
	database := testkit.ConnectMongo(t)
	testkit.StartSMTP(t)
	router := newAppRouter()

	email := "flow@debateai.test"
	password := "Password123!"
	ctx := context.Background()

	rec := perform(router, http.MethodPost, "/signup", structs.SignUpRequest{
		Email:    email,
		Password: password,
	}, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("signup status = %d, body %s", rec.Code, rec.Body.String())
	}

	var created models.User
	if err := database.Collection("users").FindOne(ctx, bson.M{"email": email}).Decode(&created); err != nil {
		t.Fatalf("load signed up user: %v", err)
	}
	if created.IsVerified {
		t.Fatal("new user should be unverified until the code is confirmed")
	}
	if created.VerificationCode == "" {
		t.Fatal("signup should store a verification code")
	}
	if created.Password == password {
		t.Fatal("password must be stored as a hash")
	}

	rec = perform(router, http.MethodPost, "/login", structs.LoginRequest{Email: email, Password: password}, nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unverified login status = %d, body %s", rec.Code, rec.Body.String())
	}
	if code, _ := decodeBody(t, rec)["code"].(string); code != "EMAIL_NOT_VERIFIED" {
		t.Fatalf("unverified login code = %q", code)
	}

	rec = perform(router, http.MethodPost, "/signup", structs.SignUpRequest{Email: email, Password: password}, nil)
	if rec.Code != http.StatusBadRequest || errorText(t, rec) != "User already exists" {
		t.Fatalf("duplicate signup = %d %s", rec.Code, rec.Body.String())
	}

	rec = perform(router, http.MethodPost, "/verifyEmail", structs.VerifyEmailRequest{
		Email:            email,
		ConfirmationCode: created.VerificationCode,
	}, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("verify status = %d, body %s", rec.Code, rec.Body.String())
	}
	verifyBody := decodeBody(t, rec)
	accessToken, _ := verifyBody["accessToken"].(string)
	assertTokenSubject(t, accessToken, email)

	authHeader := map[string]string{"Authorization": "Bearer " + accessToken}
	rec = perform(router, http.MethodPost, "/verifyToken", nil, authHeader)
	if rec.Code != http.StatusOK {
		t.Fatalf("verifyToken status = %d, body %s", rec.Code, rec.Body.String())
	}

	unknown := signSubjectToken(t, "missing@debateai.test", time.Now().Add(time.Hour))
	rec = perform(router, http.MethodPost, "/verifyToken", nil, map[string]string{"Authorization": "Bearer " + unknown})
	if rec.Code != http.StatusUnauthorized || errorText(t, rec) != "User not found" {
		t.Fatalf("unknown user token = %d %s", rec.Code, rec.Body.String())
	}

	expired := signSubjectToken(t, email, time.Now().Add(-time.Minute))
	rec = perform(router, http.MethodPost, "/verifyToken", nil, map[string]string{"Authorization": "Bearer " + expired})
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expired verifyToken status = %d, body %s", rec.Code, rec.Body.String())
	}

	rec = perform(router, http.MethodPost, "/login", structs.LoginRequest{Email: email, Password: "WrongPassword123!"}, nil)
	if rec.Code != http.StatusUnauthorized || errorText(t, rec) != "Invalid email or password" {
		t.Fatalf("wrong password = %d %s", rec.Code, rec.Body.String())
	}

	rec = perform(router, http.MethodPost, "/login", structs.LoginRequest{Email: email, Password: password}, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("login status = %d, body %s", rec.Code, rec.Body.String())
	}
	loginToken, _ := decodeBody(t, rec)["accessToken"].(string)
	assertTokenSubject(t, loginToken, email)
	authHeader = map[string]string{"Authorization": "Bearer " + loginToken}

	rec = perform(router, http.MethodPut, "/user/updateprofile", map[string]string{
		"displayName": "FlowUser",
		"bio":         "Hello",
		"twitter":     "debater",
	}, authHeader)
	if rec.Code != http.StatusOK {
		t.Fatalf("profile update status = %d, body %s", rec.Code, rec.Body.String())
	}

	// UpdateProfile writes every JSON field. Omitted fields become empty.
	rec = perform(router, http.MethodPut, "/user/updateprofile", map[string]string{"bio": "Only bio"}, authHeader)
	if rec.Code != http.StatusOK {
		t.Fatalf("partial profile body status = %d, body %s", rec.Code, rec.Body.String())
	}
	var updated models.User
	if err := database.Collection("users").FindOne(ctx, bson.M{"email": email}).Decode(&updated); err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if updated.Bio != "Only bio" || updated.DisplayName != "" || updated.Twitter != "" {
		t.Fatalf("profile overwrite = displayName %q bio %q twitter %q", updated.DisplayName, updated.Bio, updated.Twitter)
	}

	_, err := database.Collection("users").InsertOne(ctx, models.User{
		Email:       "other@debateai.test",
		DisplayName: "TakenName",
		Nickname:    "TakenName",
		IsVerified:  true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	})
	if err != nil {
		t.Fatalf("insert other user: %v", err)
	}
	rec = perform(router, http.MethodPut, "/user/updateprofile", map[string]string{
		"displayName": "TakenName",
		"bio":         "Only bio",
	}, authHeader)
	if rec.Code != http.StatusConflict || errorText(t, rec) != "Display name already taken" {
		t.Fatalf("display name conflict = %d %s", rec.Code, rec.Body.String())
	}

	rec = perform(router, http.MethodPost, "/rooms", map[string]string{"type": "public"}, authHeader)
	if rec.Code != http.StatusOK {
		t.Fatalf("create room status = %d, body %s", rec.Code, rec.Body.String())
	}
	roomBody := decodeBody(t, rec)
	roomID, _ := roomBody["id"].(string)
	if roomID == "" || roomBody["type"] != "public" {
		t.Fatalf("room response = %s", rec.Body.String())
	}
	var stored bson.M
	if err := database.Collection("rooms").FindOne(ctx, bson.M{"_id": roomID}).Decode(&stored); err != nil {
		t.Fatalf("room was not stored: %v", err)
	}
	if stored["ownerId"] != updated.ID.Hex() {
		t.Fatalf("room owner = %#v, want %s", stored["ownerId"], updated.ID.Hex())
	}
}

func assertTokenSubject(t *testing.T, token, email string) {
	t.Helper()
	if token == "" {
		t.Fatal("expected an access token")
	}
	claims := jwt.MapClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (any, error) {
		return []byte(testkit.JWTSecret), nil
	})
	if err != nil || !parsed.Valid {
		t.Fatalf("parse access token: %v", err)
	}
	if claims["sub"] != email {
		t.Fatalf("sub = %#v, want %s", claims["sub"], email)
	}
	exp, err := claims.GetExpirationTime()
	if err != nil || exp == nil {
		t.Fatalf("exp claim: %v", err)
	}
	until := time.Until(exp.Time)
	if until < 50*time.Minute || until > 70*time.Minute {
		t.Fatalf("token expires in %s, want about 60 minutes", until)
	}
}
