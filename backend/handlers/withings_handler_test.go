package handlers

import (
	"encoding/json"
	"errors"
	"testing"
)

// Withings returns userid as a string on the authorization-code exchange but
// as a bare number on refresh_token exchanges; both must decode.
func TestWithingsTokenResponseUserIDNumberOrString(t *testing.T) {
	cases := []struct {
		payload string
		want    string
	}{
		{`{"status":0,"body":{"access_token":"a","refresh_token":"r","expires_in":10800,"userid":12345678}}`, "12345678"},
		{`{"status":0,"body":{"access_token":"a","refresh_token":"r","expires_in":10800,"userid":"12345678"}}`, "12345678"},
		{`{"status":0,"body":{"access_token":"a","refresh_token":"r","expires_in":10800,"userid":null}}`, ""},
	}

	for _, tc := range cases {
		var resp WithingsTokenResponse
		if err := json.Unmarshal([]byte(tc.payload), &resp); err != nil {
			t.Fatalf("failed to decode %s: %v", tc.payload, err)
		}
		if resp.Body.UserID.String() != tc.want {
			t.Fatalf("userid = %q, want %q (payload %s)", resp.Body.UserID.String(), tc.want, tc.payload)
		}
		if resp.Body.RefreshToken != "r" {
			t.Fatalf("refresh token lost while decoding %s", tc.payload)
		}
	}
}

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
