from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import get_db_connection, generate_invite_code
from auth_utils import get_current_user

router = APIRouter(prefix="/groups", tags=["groups"])

AVATAR_COLORS = ["#00f0ff", "#ff00e5", "#7c3aed", "#f59e0b", "#10b981", "#ef4444"]

# ─── Schemas ──────────────────────────────────────────────────────────────────

class CreateGroupRequest(BaseModel):
    name: str
    display_name: Optional[str] = None  # Wie der Ersteller in der Gruppe heißen soll

class JoinGroupRequest(BaseModel):
    invite_code: str
    display_name: Optional[str] = None

# ─── Hilfsfunktion ───────────────────────────────────────────────────────────

def _get_group_members(conn, group_id: int):
    members = conn.execute("""
        SELECT u.id AS id, u.username, gm.display_name, gm.avatar_color,
               CASE WHEN g.admin_id = u.id THEN 1 ELSE 0 END as is_admin
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        JOIN groups g ON g.id = gm.group_id
        WHERE gm.group_id = ?
        ORDER BY gm.joined_at ASC
    """, (group_id,)).fetchall()
    return [dict(m) for m in members]

# ─── Endpunkte ────────────────────────────────────────────────────────────────

@router.post("/create")
def create_group(data: CreateGroupRequest, current_user: dict = Depends(get_current_user)):
    name = data.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Gruppenname muss mindestens 2 Zeichen haben.")

    # Max. 10 Gruppen pro User (sinnvolle Begrenzung)
    with get_db_connection() as conn:
        existing_count = conn.execute(
            "SELECT COUNT(*) FROM group_members WHERE user_id = ?", (current_user["id"],)
        ).fetchone()[0]
        if existing_count >= 10:
            raise HTTPException(status_code=400, detail="Du bist bereits in 10 Gruppen. Bitte erst eine verlassen.")

        # Eindeutigen Invite-Code generieren
        while True:
            code = generate_invite_code()
            existing = conn.execute("SELECT id FROM groups WHERE invite_code = ?", (code,)).fetchone()
            if not existing:
                break

        conn.execute(
            "INSERT INTO groups (name, invite_code, admin_id) VALUES (?, ?, ?)",
            (name, code, current_user["id"])
        )
        conn.commit()
        group = conn.execute("SELECT * FROM groups WHERE admin_id = ? AND name = ? ORDER BY id DESC LIMIT 1",
                             (current_user["id"], name)).fetchone()

        # Admin als erstes Mitglied hinzufügen
        display_name = data.display_name or current_user["username"]
        conn.execute(
            "INSERT INTO group_members (group_id, user_id, display_name, avatar_color) VALUES (?, ?, ?, ?)",
            (group["id"], current_user["id"], display_name, AVATAR_COLORS[0])
        )
        conn.commit()

        return {
            "id": group["id"],
            "name": group["name"],
            "invite_code": group["invite_code"],
            "admin_id": group["admin_id"],
            "is_admin": True,
            "members": _get_group_members(conn, group["id"])
        }


@router.post("/join")
def join_group(data: JoinGroupRequest, current_user: dict = Depends(get_current_user)):
    code = data.invite_code.strip().upper()

    with get_db_connection() as conn:
        group = conn.execute("SELECT * FROM groups WHERE invite_code = ?", (code,)).fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Kein Gruppe mit diesem Code gefunden.")

        # Bereits Mitglied?
        already = conn.execute(
            "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
            (group["id"], current_user["id"])
        ).fetchone()
        if already:
            raise HTTPException(status_code=409, detail="Du bist bereits Mitglied dieser Gruppe.")

        # Max. 4 Mitglieder
        member_count = conn.execute(
            "SELECT COUNT(*) FROM group_members WHERE group_id = ?", (group["id"],)
        ).fetchone()[0]
        if member_count >= 4:
            raise HTTPException(status_code=400, detail="Diese Gruppe ist bereits voll (max. 4 Mitglieder).")

        # Farbe zuweisen (nächste freie)
        used_colors = [r["avatar_color"] for r in conn.execute(
            "SELECT avatar_color FROM group_members WHERE group_id = ?", (group["id"],)
        ).fetchall()]
        color = next((c for c in AVATAR_COLORS if c not in used_colors), AVATAR_COLORS[member_count % len(AVATAR_COLORS)])

        display_name = data.display_name or current_user["username"]
        conn.execute(
            "INSERT INTO group_members (group_id, user_id, display_name, avatar_color) VALUES (?, ?, ?, ?)",
            (group["id"], current_user["id"], display_name, color)
        )
        conn.commit()

        return {
            "id": group["id"],
            "name": group["name"],
            "invite_code": group["invite_code"],
            "admin_id": group["admin_id"],
            "is_admin": group["admin_id"] == current_user["id"],
            "members": _get_group_members(conn, group["id"])
        }


@router.get("/mine")
def get_my_groups(current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        groups = conn.execute("""
            SELECT g.* FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = ?
            ORDER BY gm.joined_at ASC
        """, (current_user["id"],)).fetchall()

        result = []
        for g in groups:
            result.append({
                **dict(g),
                "is_admin": g["admin_id"] == current_user["id"],
                "members": _get_group_members(conn, g["id"])
            })
        return {"groups": result}


@router.get("/{group_id}/members")
def get_group_members(group_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        # Zugriff nur wenn Mitglied
        member = conn.execute(
            "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, current_user["id"])
        ).fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Kein Zugriff auf diese Gruppe.")

        return {"members": _get_group_members(conn, group_id)}


@router.delete("/{group_id}/member/{user_id}")
def remove_member(group_id: int, user_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        group = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Gruppe nicht gefunden.")

        # Nur Admin darf Mitglieder entfernen (außer sich selbst)
        if group["admin_id"] != current_user["id"] and user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Nur der Admin kann Mitglieder entfernen.")

        # Admin kann sich nicht selbst entfernen
        if user_id == group["admin_id"]:
            raise HTTPException(status_code=400, detail="Der Gruppen-Admin kann sich nicht selbst entfernen. Lösche stattdessen die Gruppe.")

        conn.execute(
            "DELETE FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, user_id)
        )
        conn.commit()
        return {"status": "Mitglied entfernt"}


@router.post("/{group_id}/new-code")
def regenerate_invite_code(group_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        group = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Gruppe nicht gefunden.")
        if group["admin_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Nur der Admin kann den Code erneuern.")

        while True:
            code = generate_invite_code()
            existing = conn.execute("SELECT id FROM groups WHERE invite_code = ? AND id != ?", (code, group_id)).fetchone()
            if not existing:
                break

        conn.execute("UPDATE groups SET invite_code = ? WHERE id = ?", (code, group_id))
        conn.commit()
        return {"invite_code": code}


@router.patch("/{group_id}/display-name")
def update_display_name(group_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    """User ändert seinen Anzeigenamen in der Gruppe."""
    new_name = data.get("display_name", "").strip()
    if len(new_name) < 1 or len(new_name) > 30:
        raise HTTPException(status_code=400, detail="Name muss 1–30 Zeichen lang sein.")

    with get_db_connection() as conn:
        member = conn.execute(
            "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, current_user["id"])
        ).fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Du bist kein Mitglied dieser Gruppe.")

        conn.execute(
            "UPDATE group_members SET display_name = ? WHERE group_id = ? AND user_id = ?",
            (new_name, group_id, current_user["id"])
        )
        conn.commit()
    return {"status": "Name aktualisiert", "display_name": new_name}
