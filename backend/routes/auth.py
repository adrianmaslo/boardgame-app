from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional
from database import get_db_connection, generate_invite_code
from auth_utils import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

# ─── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    avatar_color: Optional[str] = "#6366f1"

class LoginRequest(BaseModel):
    username: str
    password: str

# ─── Endpunkte ────────────────────────────────────────────────────────────────

@router.post("/register")
def register(data: RegisterRequest):
    username = data.username.strip().lower()
    if len(username) < 2 or len(username) > 30:
        raise HTTPException(status_code=400, detail="Username muss 2–30 Zeichen lang sein.")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 6 Zeichen haben.")

    pw_hash = hash_password(data.password)

    with get_db_connection() as conn:
        # Prüfen ob Username bereits vergeben
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Dieser Username ist bereits vergeben.")

        if data.email:
            existing_email = conn.execute("SELECT id FROM users WHERE email = ?", (data.email,)).fetchone()
            if existing_email:
                raise HTTPException(status_code=409, detail="Diese E-Mail-Adresse ist bereits registriert.")

        conn.execute(
            "INSERT INTO users (username, email, password_hash, avatar_color) VALUES (?, ?, ?, ?)",
            (username, data.email, pw_hash, data.avatar_color or "#6366f1")
        )
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()

    token = create_access_token(user["id"], user["username"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "avatar_color": user["avatar_color"]
        }
    }


@router.post("/login")
def login(data: LoginRequest):
    username = data.username.strip().lower()

    with get_db_connection() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()

    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falscher Username oder Passwort."
        )

    token = create_access_token(user["id"], user["username"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "avatar_color": user["avatar_color"]
        }
    }


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Gibt den aktuellen User + seine Gruppen zurück."""
    with get_db_connection() as conn:
        groups = conn.execute("""
            SELECT g.id, g.name, g.invite_code, g.admin_id,
                   COUNT(gm2.id) as member_count
            FROM groups g
            JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = ?
            LEFT JOIN group_members gm2 ON g.id = gm2.group_id
            GROUP BY g.id
        """, (current_user["id"],)).fetchall()

        groups_list = []
        for g in groups:
            members = conn.execute("""
                SELECT u.id, gm.display_name, gm.avatar_color,
                       CASE WHEN g2.admin_id = u.id THEN 1 ELSE 0 END as is_admin
                FROM group_members gm
                JOIN users u ON u.id = gm.user_id
                JOIN groups g2 ON g2.id = gm.group_id
                WHERE gm.group_id = ?
                ORDER BY gm.joined_at ASC
            """, (g["id"],)).fetchall()
            groups_list.append({
                **dict(g),
                "members": [dict(m) for m in members],
                "is_admin": g["admin_id"] == current_user["id"]
            })

    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "avatar_color": current_user["avatar_color"],
        "groups": groups_list
    }


@router.patch("/me/password")
def change_password(data: dict, current_user: dict = Depends(get_current_user)):
    old_pw = data.get("old_password", "")
    new_pw = data.get("new_password", "")
    if not verify_password(old_pw, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Altes Passwort falsch.")
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="Neues Passwort zu kurz (min. 6 Zeichen).")
    with get_db_connection() as conn:
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?",
                     (hash_password(new_pw), current_user["id"]))
        conn.commit()
    return {"status": "Passwort geändert"}
