package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAPIKeyFromRequest(t *testing.T) {
	tests := []struct {
		name   string
		bearer string
		header string
		want   string
	}{
		{name: "bearer", bearer: "Bearer fn_ro_bearer", want: "fn_ro_bearer"},
		{name: "case insensitive scheme", bearer: "bEaReR fn_ro_mixed", want: "fn_ro_mixed"},
		{name: "dedicated header", header: "fn_ro_header", want: "fn_ro_header"},
		{name: "dedicated header wins", bearer: "Bearer fn_ro_bearer", header: "fn_ro_header", want: "fn_ro_header"},
		{name: "malformed bearer", bearer: "Bearer", want: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/workouts", nil)
			if tt.bearer != "" {
				req.Header.Set("Authorization", tt.bearer)
			}
			if tt.header != "" {
				req.Header.Set("X-API-Key", tt.header)
			}
			if got := apiKeyFromRequest(req); got != tt.want {
				t.Fatalf("apiKeyFromRequest() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestHashAPIKey(t *testing.T) {
	const key = "fn_ro_example-key-that-is-long-enough"
	got := HashAPIKey(key)
	if len(got) != 64 {
		t.Fatalf("HashAPIKey() returned %d characters, want 64", len(got))
	}
	if got != HashAPIKey(key) {
		t.Fatal("HashAPIKey() is not deterministic")
	}
	if got == HashAPIKey(key+"x") {
		t.Fatal("different API keys produced the same digest")
	}
}
