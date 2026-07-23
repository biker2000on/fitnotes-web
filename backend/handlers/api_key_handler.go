package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"backend/db"
	"backend/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type apiKeyRecord struct {
	ID         uuid.UUID  `json:"id"`
	Name       string     `json:"name"`
	KeyPrefix  string     `json:"key_prefix"`
	AccessMode string     `json:"access_mode"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at"`
	ExpiresAt  *time.Time `json:"expires_at"`
	RevokedAt  *time.Time `json:"revoked_at"`
}

type createAPIKeyRequest struct {
	Name string `json:"name"`
}

type createAPIKeyResponse struct {
	apiKeyRecord
	Key string `json:"key"`
}

func generateReadOnlyAPIKey() (string, error) {
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	return "fn_ro_" + base64.RawURLEncoding.EncodeToString(random), nil
}

func ListAPIKeysHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	rows, err := db.GetDB().Query(r.Context(), `
		SELECT id, name, key_prefix, access_mode, created_at, last_used_at, expires_at, revoked_at
		FROM api_keys
		WHERE user_id = $1
		ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to list API keys"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	keys := make([]apiKeyRecord, 0)
	for rows.Next() {
		var key apiKeyRecord
		if err := rows.Scan(&key.ID, &key.Name, &key.KeyPrefix, &key.AccessMode, &key.CreatedAt, &key.LastUsedAt, &key.ExpiresAt, &key.RevokedAt); err != nil {
			http.Error(w, `{"error":"failed to read API keys"}`, http.StatusInternalServerError)
			return
		}
		keys = append(keys, key)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, `{"error":"failed to read API keys"}`, http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"api_keys": keys})
}

func CreateAPIKeyHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req createAPIKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || len(req.Name) > 100 {
		http.Error(w, `{"error":"name must be between 1 and 100 characters"}`, http.StatusBadRequest)
		return
	}

	var activeCount int
	if err := db.GetDB().QueryRow(r.Context(),
		"SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL",
		userID,
	).Scan(&activeCount); err != nil {
		http.Error(w, `{"error":"failed to check API key limit"}`, http.StatusInternalServerError)
		return
	}
	if activeCount >= 20 {
		http.Error(w, `{"error":"active API key limit reached; revoke an existing key first"}`, http.StatusConflict)
		return
	}

	raw, err := generateReadOnlyAPIKey()
	if err != nil {
		http.Error(w, `{"error":"failed to generate API key"}`, http.StatusInternalServerError)
		return
	}
	prefix := raw
	if len(prefix) > 14 {
		prefix = prefix[:14]
	}

	var record apiKeyRecord
	err = db.GetDB().QueryRow(r.Context(), `
		INSERT INTO api_keys (user_id, name, key_prefix, key_hash, access_mode)
		VALUES ($1, $2, $3, $4, 'read_only')
		RETURNING id, name, key_prefix, access_mode, created_at, last_used_at, expires_at, revoked_at`,
		userID, req.Name, prefix, middleware.HashAPIKey(raw),
	).Scan(&record.ID, &record.Name, &record.KeyPrefix, &record.AccessMode, &record.CreatedAt, &record.LastUsedAt, &record.ExpiresAt, &record.RevokedAt)
	if err != nil {
		http.Error(w, `{"error":"failed to create API key"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(createAPIKeyResponse{apiKeyRecord: record, Key: raw})
}

func RevokeAPIKeyHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	keyID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid API key id"}`, http.StatusBadRequest)
		return
	}

	var revokedAt time.Time
	err = db.GetDB().QueryRow(r.Context(), `
		UPDATE api_keys
		SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
		WHERE id = $1 AND user_id = $2
		RETURNING revoked_at`,
		keyID, userID,
	).Scan(&revokedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"API key not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to revoke API key"}`, http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"id": keyID, "revoked_at": revokedAt})
}
