package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	pool    *pgxpool.Pool
	once    sync.Once
	initErr error
)

// InitDB initializes the connection pool to the PostgreSQL database
func InitDB() (*pgxpool.Pool, error) {
	once.Do(func() {
		connStr := os.Getenv("DATABASE_URL")
		if connStr == "" {
			connStr = "postgres://postgres:postgres@localhost:5432/fitnotes?sslmode=disable"
		}

		config, pErr := pgxpool.ParseConfig(connStr)
		if pErr != nil {
			initErr = fmt.Errorf("unable to parse database url: %w", pErr)
			return
		}

		// Configure pool settings
		config.MaxConns = 25
		config.MinConns = 5
		config.MaxConnIdleTime = 30 * time.Minute
		config.MaxConnLifetime = 1 * time.Hour

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		pool, pErr = pgxpool.NewWithConfig(ctx, config)
		if pErr != nil {
			initErr = fmt.Errorf("unable to connect to database: %w", pErr)
			return
		}

		// Ping to verify connection
		if pErr = pool.Ping(ctx); pErr != nil {
			initErr = fmt.Errorf("database ping failed: %w", pErr)
			pool.Close()
			pool = nil
			return
		}

		log.Println("Successfully connected to PostgreSQL database")

		// Run database schema migrations
		if mErr := runMigrations(pool); mErr != nil {
			pool.Close()
			pool = nil
			initErr = fmt.Errorf("database migrations failed: %w", mErr)
			return
		}
	})

	return pool, initErr
}

// runMigrations automatically reads and executes initial SQL schemas if the database is empty
func runMigrations(pool *pgxpool.Pool) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Check if users table already exists
	var exists bool
	query := `SELECT EXISTS (
		SELECT FROM information_schema.tables 
		WHERE table_schema = 'public' 
		AND table_name = 'users'
	);`
	err := pool.QueryRow(ctx, query).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if users table exists: %w", err)
	}

	if !exists {
		log.Println("Users table not found, running base schema migration...")
		if err := applyMigration(ctx, pool, "000001_init_schema.up.sql"); err != nil {
			return err
		}
		log.Println("Base database schema created.")
	} else {
		log.Println("Base schema present.")
	}

	// Additive parity migration is idempotent (IF NOT EXISTS / ADD COLUMN IF NOT
	// EXISTS), so apply it on every boot to keep the schema current.
	if err := applyMigration(ctx, pool, "000002_parity.up.sql"); err != nil {
		return fmt.Errorf("failed to apply parity migration: %w", err)
	}
	log.Println("Parity migration applied.")
	if err := applyMigration(ctx, pool, "000003_programming.up.sql"); err != nil {
		return fmt.Errorf("failed to apply programming migration: %w", err)
	}
	log.Println("Programming migration applied.")
	if err := applyMigration(ctx, pool, "000004_muscles.up.sql"); err != nil {
		return fmt.Errorf("failed to apply muscles migration: %w", err)
	}
	log.Println("Muscles migration applied.")
	if err := applyMigration(ctx, pool, "000005_muscles_custom.up.sql"); err != nil {
		return fmt.Errorf("failed to apply custom muscles migration: %w", err)
	}
	log.Println("Custom muscles migration applied.")
	if err := applyMigration(ctx, pool, "000006_api_keys.up.sql"); err != nil {
		return fmt.Errorf("failed to apply API keys migration: %w", err)
	}
	log.Println("API keys migration applied.")
	return nil
}

// applyMigration locates a migration SQL file across common deployment paths and executes it.
func applyMigration(ctx context.Context, pool *pgxpool.Pool, filename string) error {
	searchDirs := []string{"db/migrations/", "../db/migrations/", "./db/migrations/", "/root/db/migrations/"}

	var sqlBytes []byte
	var readErr error
	for _, dir := range searchDirs {
		sqlBytes, readErr = os.ReadFile(dir + filename)
		if readErr == nil {
			log.Printf("Loaded migration file: %s%s", dir, filename)
			break
		}
	}
	if readErr != nil {
		return fmt.Errorf("failed to read migration file %s: %w", filename, readErr)
	}

	if _, err := pool.Exec(ctx, string(sqlBytes)); err != nil {
		return fmt.Errorf("failed to execute migration %s: %w", filename, err)
	}
	return nil
}

// GetDB returns the active connection pool
func GetDB() *pgxpool.Pool {
	return pool
}

// CloseDB closes the connection pool
func CloseDB() {
	if pool != nil {
		pool.Close()
		log.Println("Closed PostgreSQL database connection pool")
	}
}
