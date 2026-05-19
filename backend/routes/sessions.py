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


@router.post("/record_session")
async def record_session(
    game_id: int = Form(...),
    duration: int = Form(...),
    start_time: str = Form(None),
    comment: str = Form(None),
    scores_json: str = Form("[]"),   # [{"player_id": 1, "score": 10, "is_winner": true}]
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

        # Generische Scores (Liste von player_id + score + is_winner)
        scores = json.loads(scores_json)
        for s in scores:
            c.execute(
                "INSERT INTO scores (session_id, player_id, score_value, is_winner) VALUES (?, ?, ?, ?)",
                (s_id, s["player_id"], s.get("score", 0), 1 if s.get("is_winner") else 0)
            )

        # Round Scores
        rounds_data = json.loads(rounds_json)
        for r in rounds_data:
            for player_id, points in r.get("scores", {}).items():
                c.execute(
                    "INSERT INTO round_scores (session_id, round_number, player_id, points) VALUES (?, ?, ?, ?)",
                    (s_id, r["round"], int(player_id), points)
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
            SELECT s.*, g.name as game_name FROM sessions s
            JOIN games g ON s.game_id = g.id
            WHERE s.group_id = ?
            ORDER BY play_date DESC
        """, (active_group_id,)).fetchall()

        res = []
        for s in sessions:
            scores = conn.execute("""
                SELECT gm.display_name as name, sc.score_value, sc.is_winner
                FROM scores sc
                JOIN group_members gm ON sc.player_id = gm.user_id AND gm.group_id = ?
                WHERE sc.session_id = ?
            """, (active_group_id, s["id"])).fetchall()

            # Fallback: falls Scores über alte players-Tabelle
            if not scores:
                scores = conn.execute("""
                    SELECT p.name, sc.score_value, sc.is_winner FROM scores sc
                    JOIN players p ON sc.player_id = p.id WHERE session_id = ?
                """, (s["id"],)).fetchall()

            rounds = conn.execute("""
                SELECT round_number, gm.display_name as name, points
                FROM round_scores rs
                JOIN group_members gm ON rs.player_id = gm.user_id AND gm.group_id = ?
                WHERE session_id = ? ORDER BY round_number ASC
            """, (active_group_id, s["id"])).fetchall()

            if not rounds:
                rounds = conn.execute("""
                    SELECT round_number, p.name, points FROM round_scores rs
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