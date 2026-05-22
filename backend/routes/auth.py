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
    avatar_icon: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class UpdateProfileRequest(BaseModel):
    new_username: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None
    avatar_icon: Optional[str] = None
    favorite_game_id: Optional[int] = None

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
            "INSERT INTO users (username, email, password_hash, avatar_color, avatar_icon) VALUES (?, ?, ?, ?, ?)",
            (username, data.email, pw_hash, data.avatar_color or "#6366f1", data.avatar_icon)
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
            "avatar_color": user["avatar_color"],
            "avatar_icon": user["avatar_icon"],
            "favorite_game_id": user["favorite_game_id"]
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
            "avatar_color": user["avatar_color"],
            "avatar_icon": user["avatar_icon"],
            "favorite_game_id": user["favorite_game_id"]
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
                SELECT u.id AS id, gm.display_name, gm.avatar_color, gm.avatar_icon, gm.favorite_game_id,
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
        "avatar_icon": current_user["avatar_icon"],
        "favorite_game_id": current_user["favorite_game_id"],
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


@router.put("/me")
def update_me(data: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    """Aktualisiert Username und/oder Passwort des aktuellen Users."""
    user_id = current_user["id"]
    
    with get_db_connection() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        
        # 1. Aktuelles Passwort überprüfen (nur wenn neues Passwort geändert werden soll)
        if data.new_password:
            if not data.current_password or not verify_password(data.current_password, user["password_hash"]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Das aktuelle Passwort ist falsch oder fehlt."
                )
            
        new_username = data.new_username.strip() if data.new_username else None
        
        # 2. Username ändern (falls gewünscht)
        if new_username and new_username.lower() != user["username"].lower():
            if len(new_username) < 2 or len(new_username) > 30:
                raise HTTPException(status_code=400, detail="Username muss 2–30 Zeichen lang sein.")
                
            existing = conn.execute("SELECT id FROM users WHERE username = ?", (new_username.lower(),)).fetchone()
            if existing:
                raise HTTPException(status_code=400, detail="Dieser Username ist bereits vergeben.")
                
            conn.execute("UPDATE users SET username = ? WHERE id = ?", (new_username.lower(), user_id))
            conn.execute("UPDATE group_members SET display_name = ? WHERE user_id = ?", (new_username, user_id))
            
        # 3. Passwort ändern (falls gewünscht)
        if data.new_password:
            if len(data.new_password) < 6:
                raise HTTPException(status_code=400, detail="Das neue Passwort muss mindestens 6 Zeichen lang sein.")
            new_hash = hash_password(data.new_password)
            conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
            
        # Avatar und Favorite Game
        if data.avatar_icon is not None:
            conn.execute("UPDATE users SET avatar_icon = ? WHERE id = ?", (data.avatar_icon, user_id))
            conn.execute("UPDATE group_members SET avatar_icon = ? WHERE user_id = ?", (data.avatar_icon, user_id))
        
        if data.favorite_game_id is not None:
            if data.favorite_game_id <= 0:
                conn.execute("UPDATE users SET favorite_game_id = NULL WHERE id = ?", (user_id,))
                conn.execute("UPDATE group_members SET favorite_game_id = NULL WHERE user_id = ?", (user_id,))
            else:
                conn.execute("UPDATE users SET favorite_game_id = ? WHERE id = ?", (data.favorite_game_id, user_id))
                conn.execute("UPDATE group_members SET favorite_game_id = ? WHERE user_id = ?", (data.favorite_game_id, user_id))
            
        conn.commit()
        
        # 4. Aktualisierte Daten laden und neuen Token generieren
        updated_user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        
    token = create_access_token(updated_user["id"], updated_user["username"])
    return {
        "status": "Profil aktualisiert",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": updated_user["id"],
            "username": updated_user["username"],
            "email": updated_user["email"],
            "avatar_color": updated_user["avatar_color"],
            "avatar_icon": updated_user["avatar_icon"],
            "favorite_game_id": updated_user["favorite_game_id"]
        }
    }


@router.delete("/me")
def delete_account(current_user: dict = Depends(get_current_user)):
    import os
    user_id = current_user["id"]
    
    with get_db_connection() as conn:
        c = conn.cursor()
        
        # 1. Alle Gruppen-Zugehörigkeiten holen
        memberships = c.execute("SELECT group_id FROM group_members WHERE user_id = ?", (user_id,)).fetchall()
        
        for m in memberships:
            group_id = m["group_id"]
            
            # Prüfen ob dieser User Admin dieser Gruppe ist
            group_info = c.execute("SELECT admin_id FROM groups WHERE id = ?", (group_id,)).fetchone()
            if group_info and group_info["admin_id"] == user_id:
                # Andere Gruppen-Mitglieder holen, sortiert nach joined_at
                other_members = c.execute(
                    "SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ? ORDER BY joined_at ASC",
                    (group_id, user_id)
                ).fetchall()
                
                if other_members:
                    # Admin-Rechte an das älteste andere Mitglied übertragen
                    new_admin_id = other_members[0]["user_id"]
                    c.execute("UPDATE groups SET admin_id = ? WHERE id = ?", (new_admin_id, group_id))
                else:
                    # Keine anderen Mitglieder -> Gesamte Gruppe und Daten löschen
                    
                    # 1. Alle Sessions in dieser Gruppe holen und deren Fotos vom Dateisystem löschen
                    sessions = c.execute("SELECT photo_path FROM sessions WHERE group_id = ?", (group_id,)).fetchall()
                    for s in sessions:
                        p_path = s["photo_path"]
                        if p_path and os.path.exists(p_path):
                            try:
                                os.remove(p_path)
                            except Exception:
                                pass
                    
                    # 2. Runden-Ergebnisse und Gesamt-Ergebnisse dieser Sessions löschen
                    c.execute("""
                        DELETE FROM round_scores WHERE session_id IN (
                            SELECT id FROM sessions WHERE group_id = ?
                        )
                    """, (group_id,))
                    
                    c.execute("""
                        DELETE FROM scores WHERE session_id IN (
                            SELECT id FROM sessions WHERE group_id = ?
                        )
                    """, (group_id,))
                    
                    # 3. Sessions löschen
                    c.execute("DELETE FROM sessions WHERE group_id = ?", (group_id,))
                    
                    # 4. Spiele dieser Gruppe löschen
                    c.execute("DELETE FROM games WHERE group_id = ?", (group_id,))
                    
                    # 5. Gäste dieser Gruppe löschen
                    c.execute("DELETE FROM guests WHERE group_id = ?", (group_id,))
                    
                    # 6. Gruppe selbst löschen
                    c.execute("DELETE FROM groups WHERE id = ?", (group_id,))
            
            # Aus group_members austragen
            c.execute("DELETE FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, user_id))
            
        # 2. Eigene Scores und Runden-Punkte löschen
        c.execute("DELETE FROM scores WHERE player_id = ?", (user_id,))
        c.execute("DELETE FROM round_scores WHERE player_id = ?", (user_id,))
        
        # 3. User selbst löschen
        c.execute("DELETE FROM users WHERE id = ?", (user_id,))
        
        conn.commit()
        
    return {"status": "Erfolg", "message": "Konto und alle zugehörigen Daten wurden gelöscht."}

