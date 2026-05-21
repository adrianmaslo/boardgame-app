import os, uuid, shutil, json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import get_db_connection
from auth_utils import get_current_user

router = APIRouter()
UPLOAD_DIR = "uploads"


def _get_active_group(conn, user_id: int, group_id: Optional[int] = None):
    """Gibt die aktive Gruppe des Users zurück. Nimmt die erste wenn keine angegeben."""
    if group_id:
        member = conn.execute(
            "SELECT gm.group_id FROM group_members gm WHERE gm.group_id = ? AND gm.user_id = ?",
            (group_id, user_id)
        ).fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Kein Zugriff auf diese Gruppe.")
        return group_id
    else:
        first = conn.execute(
            "SELECT gm.group_id FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE gm.user_id = ? ORDER BY gm.joined_at ASC LIMIT 1",
            (user_id,)
        ).fetchone()
        return first["group_id"] if first else None


class CreateGuest(BaseModel):
    name: str


@router.post("/guests")
def create_guest(data: CreateGuest, group_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    """Erstellt einen neuen Gast in der aktiven Gruppe."""
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name darf nicht leer sein.")
    
    with get_db_connection() as conn:
        active_group_id = _get_active_group(conn, current_user["id"], group_id)
        if not active_group_id:
            raise HTTPException(status_code=400, detail="Keine aktive Gruppe gefunden.")
        
        # Check if exists
        existing = conn.execute(
            "SELECT id FROM guests WHERE group_id = ? AND name = ?",
            (active_group_id, name)
        ).fetchone()
        if existing:
            return {"id": existing["id"], "name": name}
        
        c = conn.cursor()
        c.execute(
            "INSERT INTO guests (group_id, name) VALUES (?, ?)",
            (active_group_id, name)
        )
        conn.commit()
        return {"id": c.lastrowid, "name": name}


@router.get("/guests")
def get_guests(group_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    """Gibt die Liste der Gäste der aktiven Gruppe zurück."""
    with get_db_connection() as conn:
        active_group_id = _get_active_group(conn, current_user["id"], group_id)
        if not active_group_id:
            return {"guests": []}
        rows = conn.execute("SELECT id, name FROM guests WHERE group_id = ?", (active_group_id,)).fetchall()
        return {"guests": [dict(r) for r in rows]}


@router.delete("/guests/{guest_id}")
def delete_guest(guest_id: int, current_user: dict = Depends(get_current_user)):
    """Löscht einen Gast aus der Gruppe, falls er noch keine Partien gespielt hat."""
    with get_db_connection() as conn:
        guest = conn.execute("SELECT * FROM guests WHERE id = ?", (guest_id,)).fetchone()
        if not guest:
            raise HTTPException(status_code=404, detail="Gast nicht gefunden.")
        
        member = conn.execute(
            "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
            (guest["group_id"], current_user["id"])
        ).fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Kein Zugriff.")
        
        # Prüfen ob Gast bereits mitgespielt hat (id ist negativ in der scores Tabelle)
        count = conn.execute("SELECT count(*) FROM scores WHERE player_id = ?", (-guest_id,)).fetchone()[0]
        if count > 0:
            raise HTTPException(status_code=400, detail="Dieser Gast kann nicht gelöscht werden, da er bereits bei Spielen mitgespielt hat!")
        
        conn.execute("DELETE FROM guests WHERE id = ?", (guest_id,))
        conn.commit()
        return {"status": "Erfolg"}


@router.post("/record_session")
async def record_session(
    game_id: int = Form(...),
    duration: int = Form(...),
    start_time: str = Form(None),
    comment: str = Form(None),
    scores_json: str = Form("[]"),   # [{"player_id": 1, "score": 10, "is_winner": true}, {"player_id": null, "guest_name": "Michael"}]
    rounds_json: str = Form("[]"),
    group_id: int = Form(None),
    photo: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    photo_path = None
    if photo and photo.filename:
        file_name = f"{uuid.uuid4()}.jpg"
        photo_path = os.path.join(UPLOAD_DIR, file_name)
        with open(photo_path, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)

    with get_db_connection() as conn:
        active_group_id = _get_active_group(conn, current_user["id"], group_id)

        c = conn.cursor()
        c.execute(
            """INSERT INTO sessions (game_id, duration_seconds, start_time, photo_path, comment, group_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (game_id, duration, start_time, photo_path, comment, active_group_id)
        )
        s_id = c.lastrowid

        # Generische Scores (Liste von player_id + score + is_winner + optional guest_name)
        scores = json.loads(scores_json)
        temp_to_final_id = {}

        for s in scores:
            pid = s.get("player_id")
            
            # Wenn player_id null ist, aber ein guest_name übergeben wurde -> Gast anlegen/holen
            if pid is None and s.get("guest_name"):
                g_name = s["guest_name"].strip()
                # Prüfen ob Gast bereits existiert
                existing = c.execute(
                    "SELECT id FROM guests WHERE group_id = ? AND name = ?",
                    (active_group_id, g_name)
                ).fetchone()
                if existing:
                    final_pid = -existing["id"]
                else:
                    c.execute(
                        "INSERT INTO guests (group_id, name) VALUES (?, ?)",
                        (active_group_id, g_name)
                    )
                    final_pid = -c.lastrowid
                
                # Temp-ID zu finaler ID zuordnen
                temp_id = s.get("temp_id")
                if temp_id:
                    temp_to_final_id[str(temp_id)] = final_pid
                # Zur Sicherheit auch per Name
                temp_to_final_id[g_name] = final_pid
            else:
                final_pid = int(pid)
                temp_to_final_id[str(pid)] = final_pid
                if final_pid < 0:
                    temp_to_final_id[str(abs(final_pid))] = final_pid

            c.execute(
                "INSERT INTO scores (session_id, player_id, score_value, is_winner) VALUES (?, ?, ?, ?)",
                (s_id, final_pid, s.get("score", 0), 1 if s.get("is_winner") else 0)
            )

        # Round Scores
        rounds_data = json.loads(rounds_json)
        for r in rounds_data:
            for player_key, points in r.get("scores", {}).items():
                final_player_id = temp_to_final_id.get(str(player_key))
                if final_player_id is None:
                    try:
                        final_player_id = int(player_key)
                    except ValueError:
                        final_player_id = 0

                c.execute(
                    "INSERT INTO round_scores (session_id, round_number, player_id, points) VALUES (?, ?, ?, ?)",
                    (s_id, r["round"], final_player_id, points)
                )

        conn.commit()
    return {"status": "Erfolg", "session_id": s_id}


@router.get("/history")
def get_history(group_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        active_group_id = _get_active_group(conn, current_user["id"], group_id)
        if not active_group_id:
            return {"history": []}

        sessions = conn.execute("""
            SELECT s.*, g.name as game_name, g.win_condition FROM sessions s
            JOIN games g ON s.game_id = g.id
            WHERE s.group_id = ?
            ORDER BY play_date DESC
        """, (active_group_id,)).fetchall()

        res = []
        for s in sessions:
            scores = conn.execute("""
                SELECT 
                    sc.player_id,
                    CASE WHEN sc.player_id > 0 THEN gm.display_name ELSE gst.name END as name,
                    sc.score_value, sc.is_winner
                FROM scores sc
                LEFT JOIN group_members gm ON sc.player_id = gm.user_id AND gm.group_id = ?
                LEFT JOIN guests gst ON sc.player_id = -gst.id AND gst.group_id = ?
                WHERE sc.session_id = ?
            """, (active_group_id, active_group_id, s["id"])).fetchall()

            # Fallback: falls Scores über alte players-Tabelle
            if not scores or all(sc["name"] is None for sc in scores):
                scores = conn.execute("""
                    SELECT sc.player_id, p.name, sc.score_value, sc.is_winner FROM scores sc
                    JOIN players p ON sc.player_id = p.id WHERE session_id = ?
                """, (s["id"],)).fetchall()

            rounds = conn.execute("""
                SELECT 
                    round_number,
                    rs.player_id,
                    CASE WHEN rs.player_id > 0 THEN gm.display_name ELSE gst.name END as name,
                    points
                FROM round_scores rs
                LEFT JOIN group_members gm ON rs.player_id = gm.user_id AND gm.group_id = ?
                LEFT JOIN guests gst ON rs.player_id = -gst.id AND gst.group_id = ?
                WHERE rs.session_id = ? ORDER BY round_number ASC
            """, (active_group_id, active_group_id, s["id"])).fetchall()

            if not rounds or all(r["name"] is None for r in rounds):
                rounds = conn.execute("""
                    SELECT round_number, rs.player_id, p.name, points FROM round_scores rs
                    JOIN players p ON p.id = rs.player_id
                    WHERE session_id = ? ORDER BY round_number ASC
                """, (s["id"],)).fetchall()

            res.append({**dict(s), "scores": [dict(sc) for sc in scores], "rounds": [dict(r) for r in rounds]})
        return {"history": res}


@router.delete("/session/{session_id}")
def delete_session(session_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        # Prüfen ob Session zur Gruppe des Users gehört
        session = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Session nicht gefunden.")

        member = conn.execute(
            "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
            (session["group_id"], current_user["id"])
        ).fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Kein Zugriff.")

        c = conn.cursor()
        try:
            if session["photo_path"] and os.path.exists(session["photo_path"]):
                os.remove(session["photo_path"])
            c.execute("DELETE FROM round_scores WHERE session_id = ?", (session_id,))
            c.execute("DELETE FROM scores WHERE session_id = ?", (session_id,))
            c.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()
            return {"status": "Erfolg"}
        except Exception as e:
            print(f"Fehler beim Löschen: {e}")
            raise HTTPException(status_code=500, detail="Partie konnte nicht gelöscht werden.")


class EditSession(BaseModel):
    duration_minutes: Optional[int] = None
    play_date: Optional[str] = None
    comment: Optional[str] = None
    scores_json: Optional[str] = None   # [{"player_id": 1, "score": 10, "is_winner": true}]


@router.patch("/session/{session_id}")
def edit_session(session_id: int, data: EditSession, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        session = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Session nicht gefunden.")

        member = conn.execute(
            "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
            (session["group_id"], current_user["id"])
        ).fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Kein Zugriff.")

        c = conn.cursor()
        updates, params = [], []
        if data.duration_minutes is not None:
            updates.append("duration_seconds = ?")
            params.append(data.duration_minutes * 60)
        if data.play_date is not None:
            updates.append("play_date = ?")
            params.append(data.play_date)
        if data.comment is not None:
            updates.append("comment = ?")
            params.append(data.comment)

        if updates:
            params.append(session_id)
            c.execute(f"UPDATE sessions SET {', '.join(updates)} WHERE id = ?", params)

        if data.scores_json:
            scores = json.loads(data.scores_json)
            c.execute("DELETE FROM scores WHERE session_id = ?", (session_id,))
            for s in scores:
                c.execute(
                    "INSERT INTO scores (session_id, player_id, score_value, is_winner) VALUES (?, ?, ?, ?)",
                    (session_id, s["player_id"], s.get("score", 0), 1 if s.get("is_winner") else 0)
                )
            
            # Runden-Punkte für Spieler löschen, die nicht mehr in der Partie sind
            new_player_ids = [s["player_id"] for s in scores]
            if new_player_ids:
                placeholders = ", ".join("?" for _ in new_player_ids)
                c.execute(f"DELETE FROM round_scores WHERE session_id = ? AND player_id NOT IN ({placeholders})", (session_id, *new_player_ids))
            else:
                c.execute("DELETE FROM round_scores WHERE session_id = ?", (session_id,))

        conn.commit()
    return {"status": "Erfolg"}


@router.get("/players")
def get_players(group_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    """Gibt die Mitglieder der aktiven Gruppe als Spielerliste zurück."""
    with get_db_connection() as conn:
        active_group_id = _get_active_group(conn, current_user["id"], group_id)
        if not active_group_id:
            return {"players": []}

        members = conn.execute("""
            SELECT u.id, gm.display_name as name, gm.avatar_color
            FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ?
            ORDER BY gm.joined_at ASC
        """, (active_group_id,)).fetchall()

        return {"players": [dict(m) for m in members]}