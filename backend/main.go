package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"backend/db"
	"backend/handlers"
	"backend/middleware"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

func main() {
	// Load environmental variables if .env file exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	// Initialize Postgres Database Connection
	_, err := db.InitDB()
	if err != nil {
		log.Fatalf("Failed to initialize database connection: %v", err)
	}
	defer db.CloseDB()

	// Initialize Chi Router
	r := chi.NewRouter()

	// Core Middlewares
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(60 * time.Second))

	// CORS Configuration (Crucial for Tauri mobile client and Web client interaction)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:3001",
			"http://127.0.0.1:3001",
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://localhost:5173",
			"http://127.0.0.1:5173",
			"http://localhost",
			"http://127.0.0.1",
			"tauri://localhost",
			"http://tauri.localhost",
		},
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			// Allow all localhost, 127.0.0.1, and tauri origins (including arbitrary ports)
			if strings.HasPrefix(origin, "http://localhost:") ||
				strings.HasPrefix(origin, "http://127.0.0.1:") ||
				origin == "http://localhost" ||
				origin == "http://127.0.0.1" ||
				origin == "tauri://localhost" ||
				origin == "http://tauri.localhost" {
				return true
			}
			return false
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "Origin", "X-FitNotes-Client"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300, // Maximum value of Access-Control-Max-Age
	}))

	// API Routing
	r.Route("/api", func(r chi.Router) {
		// Public Auth Endpoints
		r.Post("/auth/register", handlers.RegisterHandler)
		r.Post("/auth/login", handlers.LoginHandler)

		// Public Withings OAuth Callback & Webhook endpoints
		r.Get("/withings/callback", handlers.WithingsCallbackHandler)
		r.Post("/withings/webhook", handlers.WithingsWebhookHandler)

		// Authenticated Routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)

			r.Get("/auth/me", handlers.MeHandler)
			r.Post("/auth/refresh", handlers.RefreshTokenHandler)
			r.Post("/sync", handlers.SyncHandler)
			r.Post("/import-fitnotes", handlers.ImportFitNotesHandler)
			r.Get("/export-fitnotes", handlers.ExportFitNotesHandler)
			r.Get("/export-csv", handlers.ExportCSVHandler)

			// Authenticated Withings endpoints
			r.Get("/withings/auth-url", handlers.WithingsAuthURLHandler)
			r.Get("/withings/status", handlers.WithingsStatusHandler)
			r.Post("/withings/sync", handlers.WithingsSyncHandler)
			r.Delete("/withings/disconnect", handlers.WithingsDisconnectHandler)
		})
	})

	// Fallback Route
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":"resource not found"}`))
	})

	// Start Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Graceful shutdown channels
	serverCtx, serverStopCtx := context.WithCancel(context.Background())
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGHUP, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT)

	// Start Withings Daily Ticker Background Sync Loop
	go startWithingsDailySync(serverCtx)

	go func() {
		<-sigChan
		log.Println("Shutting down API server gracefully...")

		// Shutdown context with 15 second timeout
		shutdownCtx, cancel := context.WithTimeout(serverCtx, 15*time.Second)
		defer cancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Fatalf("Server shutdown forced: %v", err)
		}
		serverStopCtx()
	}()

	log.Printf("FitNotes Reborn Go API Server is running on port %s", port)
	err = server.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		log.Fatalf("Listen and serve error: %v", err)
	}

	// Wait for graceful shutdown to finish
	<-serverCtx.Done()
	log.Println("API server stopped.")
}

// Background sync worker that runs on startup and once every 24 hours
func startWithingsDailySync(ctx context.Context) {
	// Wait a moment for server initialization
	time.Sleep(10 * time.Second)

	// Run initial sync on startup
	runDailySync(ctx)

	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Withings background sync worker stopped.")
			return
		case <-ticker.C:
			runDailySync(ctx)
		}
	}
}

func runDailySync(ctx context.Context) {
	log.Println("Withings daily background sync starting...")
	pool := db.GetDB()
	if pool == nil {
		log.Println("Withings daily sync: Database pool is not initialized")
		return
	}

	rows, err := pool.Query(ctx, "SELECT user_id FROM withings_tokens")
	if err != nil {
		log.Printf("Withings daily sync: Failed to query users: %v", err)
		return
	}
	defer rows.Close()

	var userIDs []uuid.UUID
	for rows.Next() {
		var uid uuid.UUID
		if err := rows.Scan(&uid); err == nil {
			userIDs = append(userIDs, uid)
		}
	}

	for _, uid := range userIDs {
		// Run with timeout to prevent blocking other jobs
		syncCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		count, syncErr := handlers.PullWithingsWeightsSinceLastUpdate(syncCtx, pool, uid)
		cancel()

		if syncErr != nil {
			log.Printf("Withings daily sync: Failed for user %s: %v", uid.String(), syncErr)
		} else if count > 0 {
			log.Printf("Withings daily sync: Successfully synced %d records for user %s", count, uid.String())
		}
	}
	log.Println("Withings daily background sync complete.")
}
