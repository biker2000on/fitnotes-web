//go:build ignore

// Helper used once during deployment: prints a random OIDC client secret and
// its bcrypt hash (cost 10, matching Pocket ID's storage format).
package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		panic(err)
	}
	secret := base64.RawURLEncoding.EncodeToString(raw)
	hash, err := bcrypt.GenerateFromPassword([]byte(secret), 10)
	if err != nil {
		panic(err)
	}
	fmt.Println("SECRET=" + secret)
	fmt.Println("HASH=" + string(hash))
}
