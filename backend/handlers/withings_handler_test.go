package handlers

import (
	"errors"
	"testing"
)

func TestIsWithingsAuthRejectionInvalidRefreshTokenMessage(t *testing.T) {
	err := errors.New("refresh failed with status 503: Invalid Params: invalid refresh_token")

	if !isWithingsAuthRejection(503, err) {
		t.Fatal("expected invalid refresh_token message to be treated as an auth rejection")
	}
}

func TestIsWithingsAuthRejectionTransientStatus(t *testing.T) {
	err := errors.New("refresh failed with status 503: upstream unavailable")

	if isWithingsAuthRejection(503, err) {
		t.Fatal("expected generic 503 to remain retryable")
	}
}
