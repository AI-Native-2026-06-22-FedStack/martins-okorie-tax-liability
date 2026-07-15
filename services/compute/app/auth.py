from typing import Dict
import os
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from pwdlib import PasswordHash

# Initialize password hash using pwdlib's recommended (Argon2id) hasher.
# Ensures we match the Express service hashing configuration.
password_hash = PasswordHash.recommended()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# In-memory store of public keys, keyed by kid
PUBLIC_KEYS: Dict[str, str] = {}

class UserIdentity(BaseModel):
    id: str
    tenant_id: str
    role: str

def get_public_key(kid: str) -> str:
    """
    Retrieve the RS256 public key by kid.
    Exclusively loads the public key. Private keys are never loaded into the compute service.
    """
    if kid in PUBLIC_KEYS:
        return PUBLIC_KEYS[kid]

    # Look up environment variables first (production setup)
    env_key = os.getenv("JWT_PUBLIC_KEY")
    if env_key:
        PUBLIC_KEYS[kid] = env_key
        return env_key

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unknown key id or key not configured."
    )

def verify_token(token: str) -> dict:
    """
    Read kid from unverified header, fetch corresponding public key,
    and decode claims. Raises HTTP 401 on any verify failure.
    """
    try:
        # 1. Read kid from unverified header
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing key id in token header."
            )

        # 2. Get the public key PEM for verification
        public_key = get_public_key(kid)

        # 3. Verify RS256 algorithm and claims (issuer and audience)
        issuer = os.getenv("JWT_ISSUER", "taxpulse-api")
        audience = os.getenv("JWT_AUDIENCE", "taxpulse-clients")

        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=audience,
            issuer=issuer
        )
        return claims

    except jwt.ExpiredSignatureError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired."
        ) from e
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token."
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials."
        ) from e

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserIdentity:
    """
    FastAPI dependency that extracts the bearer token, verifies it,
    and returns a typed UserIdentity context.
    """
    claims = verify_token(token)
    
    # Extract identity fields
    user_id = claims.get("sub")
    tenant_id = claims.get("tenant_id")
    role = claims.get("role")

    if not user_id or not tenant_id or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token structure."
        )

    return UserIdentity(id=user_id, tenant_id=tenant_id, role=role)

def hash_password(password: str) -> str:
    """
    Hash password with Argon2id using pwdlib.
    """
    return password_hash.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    """
    Verify password in constant time using pwdlib.
    On a failed verify, raises HTTP 401.
    """
    try:
        if password_hash.verify(password, hashed):
            return True
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials."
    )
