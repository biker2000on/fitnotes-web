package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"backend/db"
	"backend/middleware"
	"backend/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthRequest struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	ClientType string `json:"client_type,omitempty"`
}

type AuthResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

func generateTokenForRequest(r *http.Request, userID uuid.UUID, clientType string) (string, error) {
	if clientType == "" {
		clientType = r.URL.Query().Get("client")
	}
	if clientType == "" {
		clientType = r.Header.Get("X-FitNotes-Client")
	}
	if strings.EqualFold(clientType, "mobile") {
		return middleware.GenerateTokenWithLifetime(userID, middleware.MobileTokenLifetime)
	}
	return middleware.GenerateToken(userID)
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || len(req.Password) < 6 {
		http.Error(w, `{"error":"valid email and password of at least 6 characters required"}`, http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"failed to process password"}`, http.StatusInternalServerError)
		return
	}

	pool := db.GetDB()
	ctx := r.Context()

	// Transaction to insert user and their default settings
	tx, err := pool.Begin(ctx)
	if err != nil {
		http.Error(w, `{"error":"database transaction error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var user models.User
	err = tx.QueryRow(ctx,
		"INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at, updated_at",
		req.Email, string(hashedPassword),
	).Scan(&user.ID, &user.Email, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			http.Error(w, `{"error":"email already registered"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"failed to create user"}`, http.StatusInternalServerError)
		return
	}

	// Insert default settings for the user
	_, err = tx.Exec(ctx,
		"INSERT INTO settings (user_id) VALUES ($1)",
		user.ID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to configure default settings"}`, http.StatusInternalServerError)
		return
	}

	// Seed standard default categories and exercises
	err = db.SeedDefaultData(ctx, tx, user.ID)
	if err != nil {
		http.Error(w, `{"error":"failed to seed default exercises: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	err = tx.Commit(ctx)
	if err != nil {
		http.Error(w, `{"error":"failed to commit transaction"}`, http.StatusInternalServerError)
		return
	}

	token, err := generateTokenForRequest(r, user.ID, req.ClientType)
	if err != nil {
		http.Error(w, `{"error":"failed to generate authorization token"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(AuthResponse{
		Token: token,
		User:  user,
	})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	pool := db.GetDB()
	ctx := r.Context()

	var user models.User
	var passwordHash string

	err := pool.QueryRow(ctx,
		"SELECT id, email, password_hash, created_at, updated_at FROM users WHERE email = $1",
		req.Email,
	).Scan(&user.ID, &user.Email, &passwordHash, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
			return
		}
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password))
	if err != nil {
		http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
		return
	}

	token, err := generateTokenForRequest(r, user.ID, req.ClientType)
	if err != nil {
		http.Error(w, `{"error":"failed to generate authorization token"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(AuthResponse{
		Token: token,
		User:  user,
	})
}

func RefreshTokenHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	pool := db.GetDB()
	ctx := r.Context()

	var user models.User
	err = pool.QueryRow(ctx,
		"SELECT id, email, created_at, updated_at FROM users WHERE id = $1",
		userID,
	).Scan(&user.ID, &user.Email, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	token, err := generateTokenForRequest(r, user.ID, "")
	if err != nil {
		http.Error(w, `{"error":"failed to generate authorization token"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(AuthResponse{
		Token: token,
		User:  user,
	})
}

func MeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	pool := db.GetDB()
	ctx := r.Context()

	var user models.User
	err = pool.QueryRow(ctx,
		"SELECT id, email, created_at, updated_at FROM users WHERE id = $1",
		userID,
	).Scan(&user.ID, &user.Email, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(user)
}
