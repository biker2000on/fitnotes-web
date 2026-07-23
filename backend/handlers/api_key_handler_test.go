package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"backend/middleware"

	"github.com/go-chi/chi/v5"
)

func TestGenerateReadOnlyAPIKey(t *testing.T) {
	first, err := generateReadOnlyAPIKey()
	if err != nil {
		t.Fatalf("generateReadOnlyAPIKey() returned error: %v", err)
	}
	second, err := generateReadOnlyAPIKey()
	if err != nil {
		t.Fatalf("generateReadOnlyAPIKey() returned error: %v", err)
	}
	if !strings.HasPrefix(first, "fn_ro_") {
		t.Fatalf("key prefix = %q, want fn_ro_", first)
	}
	if len(first) < 40 {
		t.Fatalf("key length = %d, want at least 40", len(first))
	}
	if first == second {
		t.Fatal("two generated API keys were identical")
	}
}

func TestReadOnlyAPIKeyRejectsWriteMethods(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/workouts", nil)
	req.Header.Set("Authorization", "Bearer fn_ro_this-key-is-long-enough-to-parse")
	rec := httptest.NewRecorder()
	called := false
	middleware.APIKeyAuthMiddleware(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		called = true
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusMethodNotAllowed)
	}
	if called {
		t.Fatal("read-only middleware called the downstream write handler")
	}
}

func TestAPIKeyCreateAuthenticateRevoke(t *testing.T) {
	_, token := createSyncTestUser(t)

	createBody, _ := json.Marshal(createAPIKeyRequest{Name: "Integration test"})
	createReq := httptest.NewRequest(http.MethodPost, "/api/api-keys", bytes.NewReader(createBody))
	createReq.Header.Set("Authorization", "Bearer "+token)
	createRec := httptest.NewRecorder()
	middleware.AuthMiddleware(http.HandlerFunc(CreateAPIKeyHandler)).ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create returned status %d: %s", createRec.Code, createRec.Body.String())
	}

	var created createAPIKeyResponse
	if err := json.NewDecoder(createRec.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode create response: %v", err)
	}
	if !strings.HasPrefix(created.Key, "fn_ro_") {
		t.Fatalf("created key = %q, want fn_ro_ prefix", created.Key)
	}

	readReq := httptest.NewRequest(http.MethodGet, "/api/v1/", nil)
	readReq.Header.Set("X-API-Key", created.Key)
	readRec := httptest.NewRecorder()
	middleware.APIKeyAuthMiddleware(http.HandlerFunc(APIInfoHandler)).ServeHTTP(readRec, readReq)
	if readRec.Code != http.StatusOK {
		t.Fatalf("authenticated read returned status %d: %s", readRec.Code, readRec.Body.String())
	}

	revokeReq := httptest.NewRequest(http.MethodDelete, "/api/api-keys/"+created.ID.String(), nil)
	revokeReq.Header.Set("Authorization", "Bearer "+token)
	revokeRec := httptest.NewRecorder()
	router := chi.NewRouter()
	router.Use(middleware.AuthMiddleware)
	router.Delete("/api/api-keys/{id}", RevokeAPIKeyHandler)
	router.ServeHTTP(revokeRec, revokeReq)
	if revokeRec.Code != http.StatusOK {
		t.Fatalf("revoke returned status %d: %s", revokeRec.Code, revokeRec.Body.String())
	}

	afterReq := httptest.NewRequest(http.MethodGet, "/api/v1/", nil)
	afterReq.Header.Set("Authorization", "Bearer "+created.Key)
	afterRec := httptest.NewRecorder()
	middleware.APIKeyAuthMiddleware(http.HandlerFunc(APIInfoHandler)).ServeHTTP(afterRec, afterReq)
	if afterRec.Code != http.StatusUnauthorized {
		t.Fatalf("revoked key returned status %d, want %d", afterRec.Code, http.StatusUnauthorized)
	}
}
