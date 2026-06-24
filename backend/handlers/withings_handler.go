package handlers

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"backend/db"
	"backend/middleware"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Custom namespace for deterministic UUID v5 generation
var withingsNamespace = uuid.MustParse("d5671bb0-80de-4ff4-a3bf-9a08e6db9fb3")
var withingsWebhookSyncSemaphore = make(chan struct{}, 4)

type WithingsTokenResponse struct {
	Status int `json:"status"`
	Body   struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		Scope        string `json:"scope"`
		UserID       string `json:"userid"`
	} `json:"body"`
	Error string `json:"error,omitempty"`
}

type withingsBool bool

func (b *withingsBool) UnmarshalJSON(data []byte) error {
	switch strings.Trim(strings.ToLower(string(data)), `"`) {
	case "true", "1":
		*b = true
		return nil
	case "false", "0", "", "null":
		*b = false
		return nil
	default:
		return fmt.Errorf("invalid withings boolean value %s", string(data))
	}
}

func (b withingsBool) Bool() bool {
	return bool(b)
}

// WithingsAuthURLHandler returns the OAuth URL to redirect the user to
func WithingsAuthURLHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	clientID := os.Getenv("WITHINGS_CLIENT_ID")
	redirectURI := os.Getenv("WITHINGS_REDIRECT_URI")
	if clientID == "" || redirectURI == "" {
		http.Error(w, `{"error":"Withings API is not configured on this server"}`, http.StatusInternalServerError)
		return
	}

	pool := db.GetDB()
	ctx := r.Context()

	// Generate and store a CSRF state UUID
	stateUUID := uuid.New()
	expiresAt := time.Now().Add(10 * time.Minute)

	_, err = pool.Exec(ctx, `
		INSERT INTO withings_oauth_states (state, user_id, expires_at)
		VALUES ($1, $2, $3)
	`, stateUUID, userID, expiresAt)
	if err != nil {
		log.Printf("Failed to generate oauth state: %v", err)
		http.Error(w, `{"error":"failed to generate authorization state"}`, http.StatusInternalServerError)
		return
	}

	authURL := fmt.Sprintf(
		"https://account.withings.com/oauth2_user/authorize2?response_type=code&client_id=%s&scope=user.metrics&redirect_uri=%s&state=%s",
		url.QueryEscape(clientID),
		url.QueryEscape(redirectURI),
		url.QueryEscape(stateUUID.String()),
	)

	_ = json.NewEncoder(w).Encode(map[string]string{"url": authURL})
}

// WithingsCallbackHandler processes Withings authorization code redirect
func WithingsCallbackHandler(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	stateStr := r.URL.Query().Get("state")

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173" // Default fallback
	}

	if code == "" || stateStr == "" {
		http.Redirect(w, r, frontendURL+"/settings?withings_error=missing_parameters", http.StatusTemporaryRedirect)
		return
	}

	stateUUID, err := uuid.Parse(stateStr)
	if err != nil {
		http.Redirect(w, r, frontendURL+"/settings?withings_error=invalid_state", http.StatusTemporaryRedirect)
		return
	}

	pool := db.GetDB()
	ctx := r.Context()

	// 1. Verify state UUID in database
	var userID uuid.UUID
	var expiresAt time.Time
	err = pool.QueryRow(ctx, `
		SELECT user_id, expires_at FROM withings_oauth_states WHERE state = $1
	`, stateUUID).Scan(&userID, &expiresAt)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Redirect(w, r, frontendURL+"/settings?withings_error=state_not_found", http.StatusTemporaryRedirect)
		} else {
			log.Printf("Failed to query oauth state: %v", err)
			http.Redirect(w, r, frontendURL+"/settings?withings_error=db_error", http.StatusTemporaryRedirect)
		}
		return
	}

	// Delete state nonce immediately (single-use)
	_, _ = pool.Exec(ctx, "DELETE FROM withings_oauth_states WHERE state = $1", stateUUID)

	if time.Now().After(expiresAt) {
		http.Redirect(w, r, frontendURL+"/settings?withings_error=state_expired", http.StatusTemporaryRedirect)
		return
	}

	// 2. Exchange code for tokens
	clientID := os.Getenv("WITHINGS_CLIENT_ID")
	clientSecret := os.Getenv("WITHINGS_CLIENT_SECRET")
	redirectURI := os.Getenv("WITHINGS_REDIRECT_URI")

	tokenData := url.Values{}
	tokenData.Set("action", "requesttoken")
	tokenData.Set("grant_type", "authorization_code")
	tokenData.Set("client_id", clientID)
	tokenData.Set("client_secret", clientSecret)
	tokenData.Set("code", code)
	tokenData.Set("redirect_uri", redirectURI)

	resp, err := postWithingsOAuthForm(r.Context(), tokenData)
	if err != nil {
		log.Printf("Failed to POST token request to Withings: %v", err)
		http.Redirect(w, r, frontendURL+"/settings?withings_error=token_exchange_failed", http.StatusTemporaryRedirect)
		return
	}
	defer resp.Body.Close()

	var tokResp WithingsTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokResp); err != nil {
		log.Printf("Failed to parse Withings token response: %v", err)
		http.Redirect(w, r, frontendURL+"/settings?withings_error=token_parse_failed", http.StatusTemporaryRedirect)
		return
	}

	if tokResp.Status != 0 {
		log.Printf("Withings token exchange returned status %d: %s", tokResp.Status, tokResp.Error)
		http.Redirect(w, r, frontendURL+"/settings?withings_error=api_rejected", http.StatusTemporaryRedirect)
		return
	}

	// 3. Save tokens to DB
	tokenExpiresAt := time.Now().Add(time.Duration(tokResp.Body.ExpiresIn) * time.Second)
	_, err = pool.Exec(ctx, `
		INSERT INTO withings_tokens (user_id, withings_user_id, access_token, refresh_token, expires_at, last_update, updated_at)
		VALUES ($1, $2, $3, $4, $5, 0, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			withings_user_id = EXCLUDED.withings_user_id,
			access_token = EXCLUDED.access_token,
			refresh_token = EXCLUDED.refresh_token,
			expires_at = EXCLUDED.expires_at,
			updated_at = NOW()
	`, userID, tokResp.Body.UserID, tokResp.Body.AccessToken, tokResp.Body.RefreshToken, tokenExpiresAt)

	if err != nil {
		log.Printf("Failed to save Withings tokens to DB: %v", err)
		http.Redirect(w, r, frontendURL+"/settings?withings_error=save_tokens_failed", http.StatusTemporaryRedirect)
		return
	}

	// 4. Subscribe to Withings Webhook Notification (Real-Time Sync)
	webhookURL := os.Getenv("WITHINGS_WEBHOOK_URL")
	if webhookURL != "" {
		err := subscribeWebhook(tokResp.Body.AccessToken, webhookURL)
		if err != nil {
			log.Printf("Warning: Failed to subscribe webhook: %v", err)
		} else {
			log.Printf("Successfully subscribed webhook for Withings user: %s", tokResp.Body.UserID)
		}
	}

	// 5. Trigger Initial All-Time Pull in a background routine (startdate=0)
	go func() {
		// Pulling weights from epoch 0 (all-time)
		_, pErr := PullWithingsWeightsRange(context.Background(), pool, userID, 0, time.Now().Unix())
		if pErr != nil {
			log.Printf("Error during initial Withings all-time pull: %v", pErr)
		}
	}()

	// Redirect back to settings page with connected flag
	http.Redirect(w, r, frontendURL+"/settings?withings_connected=true", http.StatusTemporaryRedirect)
}

// WithingsWebhookProbeHandler answers the HEAD/GET verification probe that
// Withings sends to the callback URL during notify subscribe. The subscribe
// call fails outright if this probe does not return 200.
func WithingsWebhookProbeHandler(w http.ResponseWriter, r *http.Request) {
	if !validWithingsWebhookSecret(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// EnsureWithingsWebhook (re)subscribes the notification callback for a user.
// Subscriptions on the Withings side can lapse (e.g. after repeated callback
// failures), and subscribing again is idempotent, so this runs on every daily
// sync to keep real-time weigh-in pushes alive.
func EnsureWithingsWebhook(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) error {
	webhookURL := os.Getenv("WITHINGS_WEBHOOK_URL")
	if webhookURL == "" {
		return nil
	}
	accessToken, err := getValidWithingsAccessToken(ctx, pool, userID)
	if err != nil {
		return err
	}
	return subscribeWebhook(accessToken, webhookURL)
}

// WithingsWebhookHandler handles incoming webhook POST requests from Withings
func WithingsWebhookHandler(w http.ResponseWriter, r *http.Request) {
	if !validWithingsWebhookSecret(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	if err := r.ParseForm(); err != nil {
		log.Printf("Webhook: Failed to parse form parameters: %v", err)
		http.Error(w, "invalid webhook payload", http.StatusBadRequest)
		return
	}

	userid := r.FormValue("userid")
	appli := r.FormValue("appli")
	startDateStr := r.FormValue("startdate")
	endDateStr := r.FormValue("enddate")

	log.Printf("Webhook: Received notification for user=%s, appli=%s, range=[%s, %s]", userid, appli, startDateStr, endDateStr)

	// We only process body composition events (appli=1)
	if appli != "1" || userid == "" {
		http.Error(w, "unsupported webhook payload", http.StatusBadRequest)
		return
	}

	startVal, _ := strconv.ParseInt(startDateStr, 10, 64)
	endVal, _ := strconv.ParseInt(endDateStr, 10, 64)
	if endVal == 0 {
		endVal = time.Now().Unix()
	}

	pool := db.GetDB()
	ctx := context.Background()

	// Query local user ID mapped to this Withings user ID
	var localUserID uuid.UUID
	err := pool.QueryRow(ctx, "SELECT user_id FROM withings_tokens WHERE withings_user_id = $1", userid).Scan(&localUserID)
	if err != nil {
		if err == pgx.ErrNoRows {
			log.Printf("Webhook: No local user found mapping to Withings user ID %s", userid)
		} else {
			log.Printf("Webhook: Database query error: %v", err)
		}
		http.Error(w, "unknown withings user", http.StatusNotFound)
		return
	}

	select {
	case withingsWebhookSyncSemaphore <- struct{}{}:
	default:
		http.Error(w, "withings sync queue full", http.StatusServiceUnavailable)
		return
	}

	w.WriteHeader(http.StatusAccepted)

	// Trigger asynchronous weight range pull
	go func(uid uuid.UUID, s, e int64) {
		defer func() { <-withingsWebhookSyncSemaphore }()
		count, pErr := PullWithingsWeightsRange(context.Background(), pool, uid, s, e)
		if pErr != nil {
			log.Printf("Webhook: Weight sync failed for local user %s: %v", uid, pErr)
		} else {
			log.Printf("Webhook: Weight sync complete for user %s. Pulled %d records.", uid, count)
		}
	}(localUserID, startVal, endVal)
}

func validWithingsWebhookSecret(r *http.Request) bool {
	expected := os.Getenv("WITHINGS_WEBHOOK_SECRET")
	if expected == "" {
		webhookURL := os.Getenv("WITHINGS_WEBHOOK_URL")
		if parsed, err := url.Parse(webhookURL); err == nil {
			expected = parsed.Query().Get("token")
		}
	}
	if expected == "" {
		log.Println("Webhook: WITHINGS_WEBHOOK_SECRET or tokenized WITHINGS_WEBHOOK_URL is required")
		return false
	}
	actual := r.URL.Query().Get("token")
	return subtle.ConstantTimeCompare([]byte(actual), []byte(expected)) == 1
}

// WithingsStatusHandler returns user Withings connection status
func WithingsStatusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	pool := db.GetDB()
	ctx := r.Context()

	var updatedAt time.Time
	err = pool.QueryRow(ctx, "SELECT updated_at FROM withings_tokens WHERE user_id = $1", userID).Scan(&updatedAt)

	if err != nil {
		if err == pgx.ErrNoRows {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"connected": false})
		} else {
			log.Printf("Failed to query Withings status: %v", err)
			http.Error(w, `{"error":"failed to fetch connection status"}`, http.StatusInternalServerError)
		}
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"connected": true,
		"last_sync": updatedAt.Format(time.RFC3339),
	})
}

// WithingsSyncHandler manually triggers an all-time Withings repair pull.
func WithingsSyncHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	pool := db.GetDB()
	ctx := r.Context()

	count, err := PullWithingsWeightsRange(ctx, pool, userID, 0, time.Now().Unix())
	if err != nil {
		log.Printf("Manual Withings pull failed: %v", err)
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":        true,
		"records_pulled": count,
	})
}

// WithingsDisconnectHandler removes Withings tokens and revokes subscription
func WithingsDisconnectHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	pool := db.GetDB()
	ctx := r.Context()

	// Fetch token to revoke webhook before deleting credentials
	var accessToken string
	_ = pool.QueryRow(ctx, "SELECT access_token FROM withings_tokens WHERE user_id = $1", userID).Scan(&accessToken)

	if accessToken != "" {
		webhookURL := os.Getenv("WITHINGS_WEBHOOK_URL")
		if webhookURL != "" {
			_ = revokeWebhook(accessToken, webhookURL)
		}
	}

	_, err = pool.Exec(ctx, "DELETE FROM withings_tokens WHERE user_id = $1", userID)
	if err != nil {
		log.Printf("Failed to delete Withings connection: %v", err)
		http.Error(w, `{"error":"failed to disconnect Withings account"}`, http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// subscribeWebhook signs up the callbackurl for weight measurements on Withings
func subscribeWebhook(accessToken, webhookURL string) error {
	data := url.Values{}
	data.Set("action", "subscribe")
	data.Set("callbackurl", withingsWebhookCallbackURL(webhookURL))
	data.Set("appli", "1") // 1: Weight measurements

	req, err := http.NewRequest("POST", "https://wbsapi.withings.net/notify", strings.NewReader(data.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var apiResp struct {
		Status int    `json:"status"`
		Error  string `json:"error,omitempty"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return err
	}
	if apiResp.Status != 0 {
		return fmt.Errorf("subscribe failed with status %d: %s", apiResp.Status, apiResp.Error)
	}

	return nil
}

// revokeWebhook unsubscribes the callbackurl from weight measurements on Withings
func revokeWebhook(accessToken, webhookURL string) error {
	data := url.Values{}
	data.Set("action", "revoke")
	data.Set("callbackurl", withingsWebhookCallbackURL(webhookURL))
	data.Set("appli", "1")

	req, err := http.NewRequest("POST", "https://wbsapi.withings.net/notify", strings.NewReader(data.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var apiResp struct {
		Status int `json:"status"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&apiResp)
	return nil
}

func withingsWebhookCallbackURL(webhookURL string) string {
	secret := os.Getenv("WITHINGS_WEBHOOK_SECRET")
	if secret == "" {
		return webhookURL
	}
	parsed, err := url.Parse(webhookURL)
	if err != nil {
		return webhookURL
	}
	q := parsed.Query()
	if q.Get("token") == "" {
		q.Set("token", secret)
		parsed.RawQuery = q.Encode()
	}
	return parsed.String()
}

// PullWithingsWeightsRange syncs Withings measurements inside a range and saves them
func PullWithingsWeightsRange(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, startDate, endDate int64) (int, error) {
	data := url.Values{}
	data.Set("action", "getmeas")
	data.Set("meastypes", "1,6") // 1: weight (kg), 6: body fat (%)
	data.Set("category", "1")    // 1: actual measurements
	data.Set("startdate", fmt.Sprintf("%d", startDate))
	data.Set("enddate", fmt.Sprintf("%d", endDate))

	return pullWithingsWeights(ctx, pool, userID, data, endDate)
}

// PullWithingsWeightsSinceLastUpdate syncs measurements updated since the last successful Withings pull.
func PullWithingsWeightsSinceLastUpdate(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (int, error) {
	var lastUpdate int64
	err := pool.QueryRow(ctx, "SELECT last_update FROM withings_tokens WHERE user_id = $1", userID).Scan(&lastUpdate)
	if err != nil {
		return 0, err
	}

	data := url.Values{}
	data.Set("action", "getmeas")
	data.Set("meastypes", "1,6") // 1: weight (kg), 6: body fat (%)
	data.Set("category", "1")    // 1: actual measurements
	if lastUpdate > 0 {
		data.Set("lastupdate", fmt.Sprintf("%d", lastUpdate))
	} else {
		data.Set("startdate", fmt.Sprintf("%d", time.Now().AddDate(0, 0, -30).Unix()))
		data.Set("enddate", fmt.Sprintf("%d", time.Now().Unix()))
	}

	return pullWithingsWeights(ctx, pool, userID, data, time.Now().Unix())
}

func pullWithingsWeights(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, data url.Values, cursorValue int64) (int, error) {
	accessToken, err := getValidWithingsAccessToken(ctx, pool, userID)
	if err != nil {
		return 0, err
	}

	client := &http.Client{Timeout: 15 * time.Second}
	totalCount := 0
	nextOffset := ""

	for page := 0; ; page++ {
		if page > 1000 {
			return totalCount, fmt.Errorf("withings pagination exceeded safety limit")
		}

		pageData := url.Values{}
		for key, values := range data {
			pageData[key] = append([]string(nil), values...)
		}
		if nextOffset != "" {
			pageData.Set("offset", nextOffset)
		}

		req, err := http.NewRequestWithContext(ctx, "POST", "https://wbsapi.withings.net/measure", strings.NewReader(pageData.Encode()))
		if err != nil {
			return totalCount, err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("Authorization", "Bearer "+accessToken)

		resp, err := client.Do(req)
		if err != nil {
			return totalCount, err
		}

		var measResp struct {
			Status int `json:"status"`
			Body   struct {
				MeasureGroups []struct {
					GrpID    int64 `json:"grpid"`
					Date     int64 `json:"date"`
					Measures []struct {
						Value float64 `json:"value"`
						Type  int     `json:"type"`
						Unit  int     `json:"unit"`
					} `json:"measures"`
				} `json:"measuregrps"`
				More   withingsBool `json:"more"`
				Offset int          `json:"offset"`
			} `json:"body"`
			Error string `json:"error,omitempty"`
		}

		decodeErr := json.NewDecoder(resp.Body).Decode(&measResp)
		_ = resp.Body.Close()
		if decodeErr != nil {
			return totalCount, fmt.Errorf("failed to decode getmeas JSON response: %w", decodeErr)
		}

		if measResp.Status != 0 {
			return totalCount, fmt.Errorf("withings api getmeas status %d: %s", measResp.Status, measResp.Error)
		}

		// Persist each page in its own transaction so large backfills do not hold
		// a single transaction open while paging through Withings history.
		tx, err := pool.Begin(ctx)
		if err != nil {
			return totalCount, err
		}

		pageCount := 0
		for _, group := range measResp.Body.MeasureGroups {
			var weightVal, fatVal float64
			hasWeight := false
			hasFat := false

			for _, m := range group.Measures {
				val := m.Value * math.Pow10(m.Unit)
				if m.Type == 1 { // Weight
					weightVal = val
					hasWeight = true
				} else if m.Type == 6 { // Fat Ratio
					fatVal = val
					hasFat = true
				}
			}

			// Weight is a NOT NULL database column, so skip groups without it
			if !hasWeight {
				continue
			}

			// Format date as local date string
			measDate := time.Unix(group.Date, 0).UTC().Format("2006-01-02")

			// Create deterministic UUID based on grpid (prevents duplicates, permits clean updates)
			recordID := uuid.NewSHA1(withingsNamespace, []byte(fmt.Sprintf("%d", group.GrpID)))

			var bodyFatParam *float64
			if hasFat {
				bodyFatParam = &fatVal
			}

			tag, err := tx.Exec(ctx, `
				INSERT INTO body_weights (id, user_id, date, body_weight_metric, body_fat, comments, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6, NOW(), false)
				ON CONFLICT (id) DO UPDATE SET
					date = EXCLUDED.date,
					body_weight_metric = EXCLUDED.body_weight_metric,
					body_fat = EXCLUDED.body_fat,
					comments = EXCLUDED.comments,
					last_modified = NOW(),
					is_deleted = false
				WHERE body_weights.user_id = EXCLUDED.user_id
			`, recordID, userID, measDate, weightVal, bodyFatParam, "Synced from Withings")

			if err != nil {
				_ = tx.Rollback(ctx)
				return totalCount, fmt.Errorf("failed to upsert body weight record: %w", err)
			}
			if tag.RowsAffected() > 0 {
				pageCount++
			}
		}

		if err := tx.Commit(ctx); err != nil {
			return totalCount, err
		}
		totalCount += pageCount

		if !measResp.Body.More.Bool() {
			break
		}
		nextOffset = strconv.Itoa(measResp.Body.Offset)
		if nextOffset == "" || nextOffset == "0" {
			return totalCount, fmt.Errorf("withings response requested another page without a usable offset")
		}
	}

	// Track successful sync and the update cursor used by ongoing repair syncs.
	_, _ = pool.Exec(ctx, "UPDATE withings_tokens SET updated_at = NOW(), last_update = GREATEST(last_update, $1) WHERE user_id = $2", cursorValue, userID)

	return totalCount, nil
}

func getValidWithingsAccessToken(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (string, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var accessToken, refreshToken string
	var expiresAt time.Time
	err = tx.QueryRow(ctx, `
		SELECT access_token, refresh_token, expires_at
		FROM withings_tokens
		WHERE user_id = $1
		FOR UPDATE
	`, userID).Scan(&accessToken, &refreshToken, &expiresAt)
	if err != nil {
		return "", err
	}

	if time.Now().Add(5 * time.Minute).Before(expiresAt) {
		if err := tx.Commit(ctx); err != nil {
			return "", err
		}
		return accessToken, nil
	}

	newAccess, newRefresh, newExpiresAt, status, err := refreshWithingsToken(refreshToken)
	if err != nil {
		// Drop the stored connection only when Withings definitively rejects
		// the refresh token. Transient failures (network errors, 5xx, rate
		// limits) must keep the credentials so the next sync can retry -
		// deleting here is what silently reverted users to "Connect Scale".
		if isWithingsAuthRejection(status, err) {
			_, _ = tx.Exec(ctx, "DELETE FROM withings_tokens WHERE user_id = $1 AND refresh_token = $2", userID, refreshToken)
			_ = tx.Commit(ctx)
			return "", fmt.Errorf("revoked/invalid refresh token: %w", err)
		}
		return "", fmt.Errorf("transient withings token refresh failure (status %d): %w", status, err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE withings_tokens
		SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
		WHERE user_id = $4
	`, newAccess, newRefresh, newExpiresAt, userID)
	if err != nil {
		return "", fmt.Errorf("failed to save refreshed tokens: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return newAccess, nil
}

// isWithingsAuthRejection reports whether a Withings OAuth failure means the
// credentials are definitively invalid (as opposed to a transient error).
// 100-102 are authentication failures, 401 is an invalid/expired token. Withings
// can also report an invalid refresh token as status 503 "Invalid Params".
func isWithingsAuthRejection(status int, err error) bool {
	switch status {
	case 100, 101, 102, 401:
		return true
	}
	if err != nil {
		message := strings.ToLower(err.Error())
		if strings.Contains(message, "invalid refresh_token") ||
			strings.Contains(message, "invalid_refresh_token") ||
			strings.Contains(message, "invalid refresh token") {
			return true
		}
	}
	return false
}

// refreshWithingsToken exchanges a refresh token for new credentials. The
// returned status is the Withings API status code (-1 when the request never
// produced a parseable response, i.e. a transport-level failure).
func refreshWithingsToken(refreshToken string) (string, string, time.Time, int, error) {
	clientID := os.Getenv("WITHINGS_CLIENT_ID")
	clientSecret := os.Getenv("WITHINGS_CLIENT_SECRET")

	tokenData := url.Values{}
	tokenData.Set("action", "requesttoken")
	tokenData.Set("grant_type", "refresh_token")
	tokenData.Set("client_id", clientID)
	tokenData.Set("client_secret", clientSecret)
	tokenData.Set("refresh_token", refreshToken)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err := postWithingsOAuthForm(ctx, tokenData)
	if err != nil {
		return "", "", time.Time{}, -1, err
	}
	defer resp.Body.Close()

	var tokResp WithingsTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokResp); err != nil {
		return "", "", time.Time{}, -1, err
	}

	if tokResp.Status != 0 {
		return "", "", time.Time{}, tokResp.Status, fmt.Errorf("refresh failed with status %d: %s", tokResp.Status, tokResp.Error)
	}

	expiresAt := time.Now().Add(time.Duration(tokResp.Body.ExpiresIn) * time.Second)
	return tokResp.Body.AccessToken, tokResp.Body.RefreshToken, expiresAt, 0, nil
}

func postWithingsOAuthForm(ctx context.Context, data url.Values) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", "https://wbsapi.withings.net/v2/oauth2", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	return client.Do(req)
}
