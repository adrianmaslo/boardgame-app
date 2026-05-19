import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from database import get_db_connection

# ─── Konfiguration ────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", "fallback-secret-change-in-production")
ALGORITHM = "HS256"
EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "30"))

# ─── Passwort-Hashing ─────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# ─── JWT Token ────────────────────────────────────────────────────────────────
def create_access_token(user_id: int, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# ─── Auth Dependency ──────────────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    """FastAPI Dependency: Liest und validiert den JWT Token aus dem Authorization Header."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nicht authentifiziert. Bitte einloggen.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = int(payload.get("sub"))
        username: str = payload.get("username")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Ungültiger Token")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ungültig oder abgelaufen.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # User aus DB laden
    with get_db_connection() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User nicht gefunden")

    return dict(user)

def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    """Wie get_current_user, aber gibt None zurück wenn kein Token vorhanden."""
    if credentials is None:
        return None
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None
