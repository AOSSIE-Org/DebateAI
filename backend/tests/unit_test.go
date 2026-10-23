package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"arguehub/structs"

	"github.com/gin-gonic/gin/binding"
)

func TestRequestStructValidation(t *testing.T) {
	t.Run("SignUp", func(t *testing.T) {
		cases := []struct {
			name    string
			payload structs.SignUpRequest
			wantErr bool
		}{
			{name: "valid", payload: structs.SignUpRequest{Email: "user@example.com", Password: "StrongPassword123"}, wantErr: false},
			{name: "bad email", payload: structs.SignUpRequest{Email: "not-an-email", Password: "StrongPassword123"}, wantErr: true},
			{name: "short password", payload: structs.SignUpRequest{Email: "user@example.com", Password: "123"}, wantErr: true},
			{name: "empty email", payload: structs.SignUpRequest{Email: "", Password: "StrongPassword123"}, wantErr: true},
			{name: "empty password", payload: structs.SignUpRequest{Email: "user@example.com", Password: ""}, wantErr: true},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				err := bindJSON(t, tc.payload, &structs.SignUpRequest{})
				if tc.wantErr && err == nil {
					t.Fatal("expected binding error")
				}
				if !tc.wantErr && err != nil {
					t.Fatalf("bind: %v", err)
				}
			})
		}
	})

	t.Run("Login", func(t *testing.T) {
		cases := []struct {
			name    string
			payload structs.LoginRequest
			wantErr bool
		}{
			{name: "valid", payload: structs.LoginRequest{Email: "user@example.com", Password: "password123"}, wantErr: false},
			{name: "missing password", payload: structs.LoginRequest{Email: "user@example.com", Password: ""}, wantErr: true},
			{name: "bad email", payload: structs.LoginRequest{Email: "invalid-email", Password: "password123"}, wantErr: true},
			{name: "short password", payload: structs.LoginRequest{Email: "user@example.com", Password: "short"}, wantErr: true},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				err := bindJSON(t, tc.payload, &structs.LoginRequest{})
				if tc.wantErr && err == nil {
					t.Fatal("expected binding error")
				}
				if !tc.wantErr && err != nil {
					t.Fatalf("bind: %v", err)
				}
			})
		}
	})
}

func bindJSON(t *testing.T, payload any, dest any) error {
	t.Helper()
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	return binding.Default(http.MethodPost, "application/json").Bind(req, dest)
}
