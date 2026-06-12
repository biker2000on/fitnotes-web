#!/usr/bin/env python3
"""Smoke test: register a user, push a workout_routines row through /api/sync,
pull it back, and verify OIDC endpoints respond sanely when unconfigured."""
import json
import urllib.request
import uuid
import sys

BASE = "http://localhost:8080"


def req(path, method="GET", body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


email = f"synctest-{uuid.uuid4().hex[:8]}@example.com"
status, reg = req("/api/auth/register", "POST", {"email": email, "password": "secret123"})
assert status == 201, f"register failed: {status} {reg}"
token = reg["token"]
print("registered", email)

# Need a routine + section first (FK targets).
routine_id = str(uuid.uuid4())
section_id = str(uuid.uuid4())
wr_id = str(uuid.uuid4())
now = "2026-06-12T00:00:00Z"
payload = {
    "last_sync_timestamp": "1970-01-01T00:00:00Z",
    "routines": [{"id": routine_id, "name": "ATG Knee Ability", "notes": None, "last_modified": now, "is_deleted": False}],
    "routine_sections": [{"id": section_id, "routine_id": routine_id, "name": "Leg Day", "sort_order": 1, "last_modified": now, "is_deleted": False}],
    "workout_routines": [{"id": wr_id, "date": "2026-06-12", "routine_id": routine_id, "routine_section_id": section_id, "last_modified": now, "is_deleted": False}],
}
status, resp = req("/api/sync", "POST", payload, token)
assert status == 200, f"sync push failed: {status} {resp}"

status, resp = req("/api/sync", "POST", {"last_sync_timestamp": "1970-01-01T00:00:00Z"}, token)
assert status == 200, f"sync pull failed: {status} {resp}"
wrs = resp.get("workout_routines") or []
match = [w for w in wrs if w["id"] == wr_id]
assert match, f"workout_routines row not pulled back: {wrs}"
assert match[0]["date"] == "2026-06-12" and match[0]["routine_section_id"] == section_id
print("workout_routines push/pull OK:", match[0]["date"], match[0]["routine_id"][:8])

# /api/auth/me should report identity fields.
status, me = req("/api/auth/me", token=token)
assert status == 200 and me.get("has_password") is True and me.get("oidc_linked") is False, me
print("me endpoint OK:", {k: me[k] for k in ("auth_method", "has_password", "oidc_linked")})

# OIDC endpoints when unconfigured.
status, _ = req("/api/auth/oidc/login")
assert status == 404, f"oidc login should 404 when unconfigured, got {status}"
status, providers = req("/api/auth/providers")
assert status == 200 and providers == {}, providers
print("oidc unconfigured endpoints OK")
print("ALL PASS")
