package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAPIPagination(t *testing.T) {
	tests := []struct {
		query      string
		wantLimit  int
		wantOffset int
	}{
		{"", 200, 0},
		{"?limit=25&offset=50", 25, 50},
		{"?limit=5000&offset=-2", 1000, 0},
		{"?limit=invalid&offset=invalid", 200, 0},
	}
	for _, tt := range tests {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/workouts"+tt.query, nil)
		limit, offset := apiPagination(req)
		if limit != tt.wantLimit || offset != tt.wantOffset {
			t.Errorf("%q: got (%d, %d), want (%d, %d)", tt.query, limit, offset, tt.wantLimit, tt.wantOffset)
		}
	}
}

func TestValidDateFilter(t *testing.T) {
	for _, value := range []string{"", "2026-07-23", "2000-02-29"} {
		if !validDateFilter(value) {
			t.Errorf("validDateFilter(%q) = false, want true", value)
		}
	}
	for _, value := range []string{"07/23/2026", "2026-02-30", "tomorrow"} {
		if validDateFilter(value) {
			t.Errorf("validDateFilter(%q) = true, want false", value)
		}
	}
}
