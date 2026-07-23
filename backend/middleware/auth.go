package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"backend/db"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type contextKey string

const UserIDKey contextKey = "user_id"
const AuthTypeKey contextKey = "auth_type"

var jwtSecret = []byte(getJWTSecret())

const tokenLifetime = 7 * 24 * time.Hour
const MobileTokenLifetime = 180 * 24 * time.Hour

func getJWTSecret() string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "fitnotes-super-secret-key-change-in-prod"
	}
	return secret
}

// GenerateToken generates a JWT token for a given user UUID
func GenerateToken(userID uuid.UUID) (string, error) {
	return GenerateTokenWithLifetime(userID, tokenLifetime)
}

func GenerateTokenWithLifetime(userID uuid.UUID, lifetime time.Duration) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID.String(),
		"exp": time.Now().Add(lifetime).Unix(),
		"iat": time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ParseUserIDFromToken validates a raw JWT string and returns its subject.
// Used by flows that carry the token outside the Authorization header
// (e.g. the OIDC account-link redirect).
func ParseUserIDFromToken(tokenStr string) (uuid.UUID, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return uuid.Nil, errors.New("invalid or expired token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return uuid.Nil, errors.New("invalid claims")
	}
	subStr, err := claims.GetSubject()
	if err != nil {
		return uuid.Nil, err
	}
	return uuid.Parse(subStr)
}

// AuthMiddleware validates the JWT token in Authorization header and injects the user_id in the context
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"authorization header required"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			http.Error(w, `{"error":"invalid authorization header format"}`, http.StatusUnauthorized)
			return
		}

		tokenStr := parts[1]
		token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
			return
		}

		subStr, err := claims.GetSubject()
		if err != nil {
			http.Error(w, `{"error":"missing subject claim"}`, http.StatusUnauthorized)
			return
		}

		userID, err := uuid.Parse(subStr)
		if err != nil {
			http.Error(w, `{"error":"invalid user id format in subject"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		ctx = context.WithValue(ctx, AuthTypeKey, "session")
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// HashAPIKey returns the digest persisted for an API key. Keeping this helper
// public makes it possible for creation and authentication to share exactly
// the same representation without ever storing the plaintext credential.
func HashAPIKey(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func apiKeyFromRequest(r *http.Request) string {
	if key := strings.TrimSpace(r.Header.Get("X-API-Key")); key != "" {
		return key
	}
	parts := strings.Fields(r.Header.Get("Authorization"))
	if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
		return parts[1]
	}
	return ""
}

// APIKeyAuthMiddleware authenticates integration requests and enforces the
// current read-only contract at the HTTP method boundary.
func APIKeyAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, `{"error":"this API key is read-only"}`, http.StatusMethodNotAllowed)
			return
		}

		raw := apiKeyFromRequest(r)
		if !strings.HasPrefix(raw, "fn_ro_") || len(raw) < 32 {
			http.Error(w, `{"error":"valid read-only API key required"}`, http.StatusUnauthorized)
			return
		}

		pool := db.GetDB()
		if pool == nil {
			http.Error(w, `{"error":"database unavailable"}`, http.StatusServiceUnavailable)
			return
		}

		var userID uuid.UUID
		err := pool.QueryRow(r.Context(), `
			SELECT user_id
			FROM api_keys
			WHERE key_hash = $1
			  AND access_mode = 'read_only'
			  AND revoked_at IS NULL
			  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
			HashAPIKey(raw),
		).Scan(&userID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				http.Error(w, `{"error":"invalid or revoked API key"}`, http.StatusUnauthorized)
				return
			}
			http.Error(w, `{"error":"failed to validate API key"}`, http.StatusInternalServerError)
			return
		}

		// Avoid a WAL write for every polling request. The short independent
		// timeout keeps usage metadata from consuming the request's full budget.
		usageCtx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
		_, _ = pool.Exec(usageCtx, `
			UPDATE api_keys
			SET last_used_at = CURRENT_TIMESTAMP
			WHERE key_hash = $1
			  AND (last_used_at IS NULL OR last_used_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes')`,
			HashAPIKey(raw),
		)
		cancel()

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		ctx = context.WithValue(ctx, AuthTypeKey, "api_key_read_only")
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetUserID retrieves the authenticated user ID from context
func GetUserID(ctx context.Context) (uuid.UUID, error) {
	val := ctx.Value(UserIDKey)
	if val == nil {
		return uuid.Nil, errors.New("user id not found in context")
	}

	userID, ok := val.(uuid.UUID)
	if !ok {
		return uuid.Nil, errors.New("invalid user id type in context")
	}

	return userID, nil
}
