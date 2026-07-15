import os
import time
import pytest
import jwt

# Paths to the test RS256 keys
KEYS_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "jwt_keys")
PRIVATE_KEY_PATH = os.path.join(KEYS_DIR, "private.pem")
PUBLIC_KEY_PATH = os.path.join(KEYS_DIR, "public.pem")

@pytest.fixture(scope="session")
def private_key() -> str:
    with open(PRIVATE_KEY_PATH, "r") as f:
        return f.read()

@pytest.fixture(scope="session")
def public_key() -> str:
    with open(PUBLIC_KEY_PATH, "r") as f:
        return f.read()

@pytest.fixture(scope="session")
def valid_token(private_key) -> str:
    payload = {
        "sub": "user-123",
        "tenant_id": "11111111-1111-4111-8111-111111111111",
        "role": "Firm Admin",
        "iss": "taxpulse-api",
        "aud": "taxpulse-clients",
        "exp": int(time.time()) + 900  # 15 minutes in the future
    }
    headers = {
        "kid": "2026-07"
    }
    return jwt.encode(payload, private_key, algorithm="RS256", headers=headers)

@pytest.fixture(scope="session")
def wrong_aud_token(private_key) -> str:
    payload = {
        "sub": "user-123",
        "tenant_id": "11111111-1111-4111-8111-111111111111",
        "role": "Firm Admin",
        "iss": "taxpulse-api",
        "aud": "wrong-audience",
        "exp": int(time.time()) + 900
    }
    headers = {
        "kid": "2026-07"
    }
    return jwt.encode(payload, private_key, algorithm="RS256", headers=headers)

@pytest.fixture(scope="session")
def expired_token(private_key) -> str:
    payload = {
        "sub": "user-123",
        "tenant_id": "11111111-1111-4111-8111-111111111111",
        "role": "Firm Admin",
        "iss": "taxpulse-api",
        "aud": "taxpulse-clients",
        "exp": int(time.time()) - 10  # Expired 10 seconds ago
    }
    headers = {
        "kid": "2026-07"
    }
    return jwt.encode(payload, private_key, algorithm="RS256", headers=headers)

@pytest.fixture(scope="session")
def tampered_token(valid_token) -> str:
    parts = valid_token.split(".")
    # Modify the signature part slightly to invalidate it
    tampered_sig = parts[2][:-4] + "AAAA"
    return ".".join([parts[0], parts[1], tampered_sig])
