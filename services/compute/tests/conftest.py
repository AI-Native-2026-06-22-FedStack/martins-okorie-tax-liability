import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


@pytest.fixture(scope="session")
def key_pair() -> tuple[str, str]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    return private_pem, public_pem



@pytest.fixture(scope="session")
def private_key(key_pair) -> str:
    return key_pair[0]


@pytest.fixture(scope="session")
def public_key(key_pair) -> str:
    return key_pair[1]


@pytest.fixture(autouse=True)
def configure_public_key(monkeypatch, public_key) -> None:
    monkeypatch.setenv("JWT_PUBLIC_KEY", public_key)
    from app.auth import PUBLIC_KEYS

    PUBLIC_KEYS.clear()


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
def wrong_issuer_token(private_key) -> str:
    payload = {
        "sub": "user-123",
        "tenant_id": "11111111-1111-4111-8111-111111111111",
        "role": "Firm Admin",
        "iss": "wrong-issuer",
        "aud": "taxpulse-clients",
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
