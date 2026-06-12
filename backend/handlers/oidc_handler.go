package handlers

// OIDC single sign-on (Pocket ID or any standards-compliant provider).
// Flow: authorization code + PKCE (S256) + state + nonce. Transaction state
// (state/verifier/nonce/link target) is persisted server-side in oidc_states,
// so no sealed cookies are needed and the SPA can stay token-based.
//
// User resolution rules (ported from gnucash-web, first match wins):
//  1. link mode  - attach the identity to the already-authenticated user
//  2. subject    - returning OIDC user, sign in
//  3. email      - verified email matches a local account with no OIDC binding
//                  => auto-link (the account migration path)
//  4. create     - brand-new user provisioned from the OIDC claims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"backend/db"
	"backend/middleware"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
)

const oidcStateTTL = 10 * time.Minute

var (
	oidcProviderMu sync.Mutex
	oidcProvider   *oidc.Provider
)

func oidcConfigured() bool {
	return os.Getenv("OIDC_ISSUER") != "" &&
		os.Getenv("OIDC_CLIENT_ID") != "" &&
		os.Getenv("OIDC_CLIENT_SECRET") != ""
}

func oidcProviderName() string {
	if name := os.Getenv("OIDC_PROVIDER_NAME"); name != "" {
		return name
	}
	return "Pocket ID"
}

func oidcRedirectURI() string {
	if uri := os.Getenv("OIDC_REDIRECT_URI"); uri != "" {
		return uri
	}
	frontend := strings.TrimRight(os.Getenv("FRONTEND_URL"), "/")
	if frontend == "" {
		frontend = "http://localhost:8080"
	}
	return frontend + "/api/auth/oidc/callback"
}

func frontendURL() string {
	frontend := strings.TrimRight(os.Getenv("FRONTEND_URL"), "/")
	if frontend == "" {
		frontend = "http://localhost:3001"
	}
	return frontend
}

// getOidcProvider performs (and caches) issuer discovery. Failures are not
// cached so a temporarily unreachable issuer recovers on the next request.
func getOidcProvider(ctx context.Context) (*oidc.Provider, error) {
	oidcProviderMu.Lock()
	defer oidcProviderMu.Unlock()
	if oidcProvider != nil {
		return oidcProvider, nil
	}
	p, err := oidc.NewProvider(ctx, os.Getenv("OIDC_ISSUER"))
	if err != nil {
		return nil, err
	}
	oidcProvider = p
	return p, nil
}

func oidcOauthConfig(p *oidc.Provider) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     os.Getenv("OIDC_CLIENT_ID"),
		ClientSecret: os.Getenv("OIDC_CLIENT_SECRET"),
		Endpoint:     p.Endpoint(),
		RedirectURL:  oidcRedirectURI(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}
}

// ProvidersHandler advertises configured auth providers so the login UI can
// render an SSO button without hard-coding anything.
func ProvidersHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	resp := map[string]any{}
	if oidcConfigured() {
		resp["oidc"] = map[string]string{"name": oidcProviderName()}
	}
	json.NewEncoder(w).Encode(resp)
}

func oidcErrorRedirect(w http.ResponseWriter, r *http.Request, message string) {
	http.Redirect(w, r, frontendURL()+"/?oidc_error="+url.QueryEscape(message), http.StatusFound)
}

// OidcLoginHandler starts the authorization flow. Optional query params:
//   - link_token: a valid FitNotes JWT; the resulting identity is linked to
//     that user instead of signing somebody in.
func OidcLoginHandler(w http.ResponseWriter, r *http.Request) {
	if !oidcConfigured() {
		http.Error(w, `{"error":"OIDC is not configured"}`, http.StatusNotFound)
		return
	}

	ctx := r.Context()
	provider, err := getOidcProvider(ctx)
	if err != nil {
		log.Printf("oidc: discovery failed: %v", err)
		oidcErrorRedirect(w, r, "identity provider unreachable")
		return
	}

	var linkUserID *uuid.UUID
	if linkToken := r.URL.Query().Get("link_token"); linkToken != "" {
		uid, err := middleware.ParseUserIDFromToken(linkToken)
		if err != nil {
			oidcErrorRedirect(w, r, "link requires a valid session")
			return
		}
		linkUserID = &uid
	}

	state := oauth2.GenerateVerifier()
	nonce := oauth2.GenerateVerifier()
	verifier := oauth2.GenerateVerifier()

	pool := db.GetDB()
	_, err = pool.Exec(ctx,
		"INSERT INTO oidc_states (state, code_verifier, nonce, link_user_id, redirect_to, expires_at) VALUES ($1, $2, $3, $4, $5, $6)",
		state, verifier, nonce, linkUserID, "/", time.Now().Add(oidcStateTTL),
	)
	if err != nil {
		log.Printf("oidc: failed to persist transaction state: %v", err)
		oidcErrorRedirect(w, r, "internal error")
		return
	}
	// Opportunistic cleanup of stale transactions.
	_, _ = pool.Exec(ctx, "DELETE FROM oidc_states WHERE expires_at < now()")

	authURL := oidcOauthConfig(provider).AuthCodeURL(
		state,
		oauth2.S256ChallengeOption(verifier),
		oidc.Nonce(nonce),
	)
	http.Redirect(w, r, authURL, http.StatusFound)
}

type oidcClaims struct {
	Sub               string `json:"sub"`
	Email             string `json:"email"`
	EmailVerified     bool   `json:"email_verified"`
	Name              string `json:"name"`
	PreferredUsername string `json:"preferred_username"`
	Picture           string `json:"picture"`
	Nonce             string `json:"nonce"`
}

type oidcUserRow struct {
	ID          uuid.UUID
	Email       string
	HasPassword bool
	OidcSubject *string
}

func findUserBy(ctx context.Context, pool *pgxpool.Pool, where string, args ...any) (*oidcUserRow, error) {
	var u oidcUserRow
	var passwordHash *string
	err := pool.QueryRow(ctx,
		"SELECT id, email, password_hash, oidc_subject FROM users WHERE "+where, args...,
	).Scan(&u.ID, &u.Email, &passwordHash, &u.OidcSubject)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.HasPassword = passwordHash != nil && *passwordHash != ""
	return &u, nil
}

// OidcCallbackHandler completes the flow: token exchange, ID-token + nonce
// verification, user resolution, JWT issuance, redirect back into the SPA.
func OidcCallbackHandler(w http.ResponseWriter, r *http.Request) {
	if !oidcConfigured() {
		http.Error(w, `{"error":"OIDC is not configured"}`, http.StatusNotFound)
		return
	}
	ctx := r.Context()
	pool := db.GetDB()

	state := r.URL.Query().Get("state")
	if state == "" {
		oidcErrorRedirect(w, r, "missing state")
		return
	}

	// Recover and consume the transaction (single use).
	var verifier, nonce string
	var linkUserID *uuid.UUID
	var expiresAt time.Time
	err := pool.QueryRow(ctx,
		"DELETE FROM oidc_states WHERE state = $1 RETURNING code_verifier, nonce, link_user_id, expires_at",
		state,
	).Scan(&verifier, &nonce, &linkUserID, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && time.Now().After(expiresAt)) {
		oidcErrorRedirect(w, r, "sign-in session expired, try again")
		return
	}
	if err != nil {
		log.Printf("oidc: failed to load transaction state: %v", err)
		oidcErrorRedirect(w, r, "internal error")
		return
	}

	if providerErr := r.URL.Query().Get("error"); providerErr != "" {
		oidcErrorRedirect(w, r, "sign-in cancelled")
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		oidcErrorRedirect(w, r, "missing authorization code")
		return
	}

	provider, err := getOidcProvider(ctx)
	if err != nil {
		log.Printf("oidc: discovery failed: %v", err)
		oidcErrorRedirect(w, r, "identity provider unreachable")
		return
	}
	conf := oidcOauthConfig(provider)

	token, err := conf.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		log.Printf("oidc: token exchange failed: %v", err)
		oidcErrorRedirect(w, r, "token exchange failed")
		return
	}

	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		oidcErrorRedirect(w, r, "provider did not return an ID token")
		return
	}
	idToken, err := provider.Verifier(&oidc.Config{ClientID: conf.ClientID}).Verify(ctx, rawIDToken)
	if err != nil {
		log.Printf("oidc: ID token verification failed: %v", err)
		oidcErrorRedirect(w, r, "invalid ID token")
		return
	}

	var claims oidcClaims
	if err := idToken.Claims(&claims); err != nil || claims.Sub == "" {
		oidcErrorRedirect(w, r, "ID token missing subject")
		return
	}
	if claims.Nonce != nonce {
		oidcErrorRedirect(w, r, "nonce mismatch")
		return
	}

	// Userinfo is the authoritative claim source where available.
	if ui, err := provider.UserInfo(ctx, oauth2.StaticTokenSource(token)); err == nil {
		var uiClaims oidcClaims
		if err := ui.Claims(&uiClaims); err == nil {
			if uiClaims.Email != "" {
				claims.Email = uiClaims.Email
				claims.EmailVerified = uiClaims.EmailVerified
			}
			if uiClaims.Name != "" {
				claims.Name = uiClaims.Name
			}
			if uiClaims.Picture != "" {
				claims.Picture = uiClaims.Picture
			}
		}
	}

	issuer := os.Getenv("OIDC_ISSUER")
	email := strings.TrimSpace(strings.ToLower(claims.Email))

	userBySubject, err := findUserBy(ctx, pool, "oidc_issuer = $1 AND oidc_subject = $2", issuer, claims.Sub)
	if err != nil {
		log.Printf("oidc: user lookup failed: %v", err)
		oidcErrorRedirect(w, r, "internal error")
		return
	}

	// ---- (1) LINK MODE ----
	if linkUserID != nil {
		if userBySubject != nil && userBySubject.ID != *linkUserID {
			oidcErrorRedirect(w, r, "this identity is already linked to a different account")
			return
		}
		linkUser, err := findUserBy(ctx, pool, "id = $1", *linkUserID)
		if err != nil || linkUser == nil {
			oidcErrorRedirect(w, r, "account not found")
			return
		}
		if linkUser.OidcSubject != nil && *linkUser.OidcSubject != claims.Sub {
			oidcErrorRedirect(w, r, "your account is already linked to a different identity")
			return
		}
		authMethod := "oidc"
		if linkUser.HasPassword {
			authMethod = "both"
		}
		_, err = pool.Exec(ctx,
			`UPDATE users SET oidc_subject = $1, oidc_issuer = $2, auth_method = $3,
			        display_name = NULLIF($4, ''), avatar_url = NULLIF($5, ''), updated_at = now()
			 WHERE id = $6`,
			claims.Sub, issuer, authMethod, claims.Name, claims.Picture, *linkUserID,
		)
		if err != nil {
			log.Printf("oidc: link update failed: %v", err)
			oidcErrorRedirect(w, r, "failed to link identity")
			return
		}
		http.Redirect(w, r, frontendURL()+"/?oidc=linked#/sync", http.StatusFound)
		return
	}

	// ---- (2) SUBJECT MATCH: returning OIDC user ----
	if userBySubject != nil {
		issueOidcSession(w, r, ctx, pool, userBySubject.ID, userBySubject.Email, claims)
		return
	}

	// ---- (3) VERIFIED-EMAIL AUTO-LINK: migrate an existing local account ----
	if email != "" && claims.EmailVerified {
		userByEmail, err := findUserBy(ctx, pool, "email = $1", email)
		if err != nil {
			log.Printf("oidc: user lookup failed: %v", err)
			oidcErrorRedirect(w, r, "internal error")
			return
		}
		if userByEmail != nil {
			if userByEmail.OidcSubject != nil {
				// Email owner is bound to a different OIDC identity - don't hijack.
				oidcErrorRedirect(w, r, "an account with this email is linked to a different identity")
				return
			}
			authMethod := "oidc"
			if userByEmail.HasPassword {
				authMethod = "both"
			}
			_, err = pool.Exec(ctx,
				`UPDATE users SET oidc_subject = $1, oidc_issuer = $2, auth_method = $3,
				        display_name = NULLIF($4, ''), avatar_url = NULLIF($5, ''), updated_at = now()
				 WHERE id = $6`,
				claims.Sub, issuer, authMethod, claims.Name, claims.Picture, userByEmail.ID,
			)
			if err != nil {
				log.Printf("oidc: auto-link failed: %v", err)
				oidcErrorRedirect(w, r, "failed to link identity")
				return
			}
			log.Printf("oidc: auto-linked %s to user %s by verified email", claims.Sub, userByEmail.ID)
			issueOidcSession(w, r, ctx, pool, userByEmail.ID, userByEmail.Email, claims)
			return
		}
	}

	// ---- (4) CREATE: brand-new OIDC user ----
	if email == "" {
		oidcErrorRedirect(w, r, "identity provider did not supply an email address")
		return
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		oidcErrorRedirect(w, r, "internal error")
		return
	}
	defer tx.Rollback(ctx)

	var newUserID uuid.UUID
	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, auth_method, oidc_subject, oidc_issuer, display_name, avatar_url)
		 VALUES ($1, NULL, 'oidc', $2, $3, NULLIF($4, ''), NULLIF($5, '')) RETURNING id`,
		email, claims.Sub, issuer, claims.Name, claims.Picture,
	).Scan(&newUserID)
	if err != nil {
		log.Printf("oidc: user creation failed: %v", err)
		oidcErrorRedirect(w, r, "failed to create account")
		return
	}
	if _, err = tx.Exec(ctx, "INSERT INTO settings (user_id) VALUES ($1)", newUserID); err != nil {
		log.Printf("oidc: settings creation failed: %v", err)
		oidcErrorRedirect(w, r, "failed to create account")
		return
	}
	if err = db.SeedDefaultData(ctx, tx, newUserID); err != nil {
		log.Printf("oidc: default data seed failed: %v", err)
		oidcErrorRedirect(w, r, "failed to create account")
		return
	}
	if err = tx.Commit(ctx); err != nil {
		oidcErrorRedirect(w, r, "failed to create account")
		return
	}
	log.Printf("oidc: created new user %s for subject %s", newUserID, claims.Sub)
	issueOidcSession(w, r, ctx, pool, newUserID, email, claims)
}

func issueOidcSession(w http.ResponseWriter, r *http.Request, ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, email string, claims oidcClaims) {
	// Keep profile data fresh on every sign-in.
	_, _ = pool.Exec(ctx,
		"UPDATE users SET display_name = COALESCE(NULLIF($1, ''), display_name), avatar_url = COALESCE(NULLIF($2, ''), avatar_url), updated_at = now() WHERE id = $3",
		claims.Name, claims.Picture, userID,
	)
	token, err := middleware.GenerateToken(userID)
	if err != nil {
		oidcErrorRedirect(w, r, "failed to issue session")
		return
	}
	redirect := fmt.Sprintf("%s/?oidc=success&oidc_token=%s&oidc_email=%s",
		frontendURL(), url.QueryEscape(token), url.QueryEscape(email))
	http.Redirect(w, r, redirect, http.StatusFound)
}

// OidcUnlinkHandler removes the OIDC binding. Refused when the account has no
// password (it would lock the user out).
func OidcUnlinkHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	pool := db.GetDB()
	ctx := r.Context()
	user, err := findUserBy(ctx, pool, "id = $1", userID)
	if err != nil || user == nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}
	if user.OidcSubject == nil {
		http.Error(w, `{"error":"no identity provider is linked to this account"}`, http.StatusBadRequest)
		return
	}
	if !user.HasPassword {
		http.Error(w, `{"error":"set a password before unlinking, or you would be locked out"}`, http.StatusBadRequest)
		return
	}

	_, err = pool.Exec(ctx,
		"UPDATE users SET oidc_subject = NULL, oidc_issuer = NULL, avatar_url = NULL, auth_method = 'password', updated_at = now() WHERE id = $1",
		userID,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to unlink"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
