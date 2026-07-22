import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.auth import verify_token, hash_password, verify_password
from app.main import app

client = TestClient(app)

# We verify against the shared key fixture directly to avoid dependency on a running Express service, matching standard contract testing patterns.

def test_verify_token_success(valid_token):
    # Test that verify_token successfully parses a correct token
    claims = verify_token(valid_token)
    assert claims["sub"] == "user-123"
    assert claims["tenant_id"] == "11111111-1111-4111-8111-111111111111"
    assert claims["role"] == "Firm Admin"

def test_verify_token_wrong_audience(wrong_aud_token):
    # Test that wrong audience is rejected with 401
    with pytest.raises(HTTPException) as exc_info:
        verify_token(wrong_aud_token)
    assert exc_info.value.status_code == 401
    assert "audience" in str(exc_info.value.detail).lower() or "token" in str(exc_info.value.detail).lower()

def test_verify_token_wrong_issuer(wrong_issuer_token):
    # Test that wrong issuer is rejected with 401
    with pytest.raises(HTTPException) as exc_info:
        verify_token(wrong_issuer_token)
    assert exc_info.value.status_code == 401
    assert "issuer" in str(exc_info.value.detail).lower() or "token" in str(exc_info.value.detail).lower()

def test_verify_token_expired(expired_token):
    # Test that expired token is rejected with 401
    with pytest.raises(HTTPException) as exc_info:
        verify_token(expired_token)
    assert exc_info.value.status_code == 401
    assert "expired" in str(exc_info.value.detail).lower()

def test_verify_token_tampered(tampered_token):
    # Test that tampered signature is rejected with 401
    with pytest.raises(HTTPException) as exc_info:
        verify_token(tampered_token)
    assert exc_info.value.status_code == 401

def test_route_success(valid_token):
    # Test protected route with valid token
    headers = {"Authorization": f"Bearer {valid_token}"}
    response = client.post(
        "/compute/tax-liability",
        json={"income": 100000.0, "deductions": 20000.0},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["tenant_id"] == "11111111-1111-4111-8111-111111111111"
    assert data["role"] == "Firm Admin"
    assert data["tax_liability"] == 12000.0  # (100k - 20k) * 0.15

def test_route_unauthorized_missing():
    # Test protected route with no token
    response = client.post(
        "/compute/tax-liability",
        json={"income": 100000.0, "deductions": 20000.0}
    )
    assert response.status_code == 401

def test_route_unauthorized_invalid(tampered_token):
    # Test protected route with invalid/tampered token
    headers = {"Authorization": f"Bearer {tampered_token}"}
    response = client.post(
        "/compute/tax-liability",
        json={"income": 100000.0, "deductions": 20000.0},
        headers=headers
    )
    assert response.status_code == 401

def test_pwdlib_hashing_success():
    # Test password hashing and verification success path
    password = "super-secret-password"
    hashed = hash_password(password)
    assert hashed != password
    assert "argon2" in hashed
    
    # Correct password verification
    assert verify_password(password, hashed) is True

def test_pwdlib_hashing_failure():
    # Test that incorrect password verification raises HTTPException 401
    password = "super-secret-password"
    hashed = hash_password(password)
    
    with pytest.raises(HTTPException) as exc_info:
        verify_password("wrong-password", hashed)
    assert exc_info.value.status_code == 401

def test_route_correlation_id_propagation(valid_token):
    # Test that incoming correlation ID header is returned in the response
    custom_id = "test-python-correlation-999"
    headers = {
        "Authorization": f"Bearer {valid_token}",
        "x-correlation-id": custom_id
    }
    response = client.post(
        "/compute/tax-liability",
        json={"income": 100000.0, "deductions": 20000.0},
        headers=headers
    )
    assert response.status_code == 200
    assert response.headers.get("x-correlation-id") == custom_id

def test_route_correlation_id_fallback(valid_token):
    # Test that request ID propagates as correlation ID in response when correlation ID is absent
    custom_req_id = "test-python-request-id-111"
    headers = {
        "Authorization": f"Bearer {valid_token}",
        "x-request-id": custom_req_id
    }
    response = client.post(
        "/compute/tax-liability",
        json={"income": 100000.0, "deductions": 20000.0},
        headers=headers
    )
    assert response.status_code == 200
    assert response.headers.get("x-correlation-id") == custom_req_id

