import os, uuid, shutil, json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from database import get_db_connection

router = APIRouter()
UPLOAD_DIR = "uploads"

@router.post("/record_session")
async def record_session(
    game_id: int = Form(...),
    duration: int = Form(...),
    start_time: str = Form(None),
    comment: str = Form(None),
    score_adrian: int = Form(0),
    score_lea: int = Form(0),
    winner_id: int = Form(None),
    rounds_json: str = Form("[]"),
    photo: UploadFile = File(None)
):
    photo_path = None
    if photo:
        file_name = f"{uuid.uuid4()}.jpg"
        photo_path = os.path.join(UPLOAD_DIR, file_name)
        with open(photo_path, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)

    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("""INSERT INTO sessions 
                     (game_id, duration_seconds, start_time, photo_path, comment) 
                     VALUES (?, ?, ?, ?, ?)""", 
                  (game_id, duration, start_time, photo_path, comment))
        s_id = c.lastrowid
        
        p_ids = {row["name"]: row["id"] for row in c.execute("SELECT * FROM players").fetchall()}
        
        c.execute("INSERT INTO scores (session_id, player_id, score_value, is_winner) VALUES (?, ?, ?, ?)",
                  (s_id, p_ids["Adrian"], score_adrian, 1 if int(winner_id) == 1 else 0))
        c.execute("INSERT INTO scores (session_id, player_id, score_value, is_winner) VALUES (?, ?, ?, ?)",
                  (s_id, p_ids["Lea"], score_lea, 1 if int(winner_id) == 2 else 0))
        
        rounds_data = json.loads(rounds_json)
        for r in rounds_data:
            c.execute("INSERT INTO round_scores (session_id, round_number, player_id, points) VALUES (?, ?, ?, ?)",
                      (s_id, r['round'], p_ids["Adrian"], r['adrian']))
            c.execute("INSERT INTO round_scores (session_id, round_number, player_id, points) VALUES (?, ?, ?, ?)",
                      (s_id, r['round'], p_ids["Lea"], r['lea']))
        conn.commit()
    return {"status": "Erfolg"}

@router.get("/history")
def get_history():
    with get_db_connection() as conn:
        sessions = conn.execute("""
            SELECT s.*, g.name as game_name FROM sessions s 
            JOIN games g ON s.game_id = g.id ORDER BY play_date DESC
        """).fetchall()
        
        res = []
        for s in sessions:
            scores = conn.execute("""
                SELECT p.name, sc.score_value, sc.is_winner FROM scores sc 
                JOIN players p ON sc.player_id = p.id WHERE session_id = ?
            """, (s["id"],)).fetchall()
            rounds = conn.execute("""
                SELECT round_number, p.name, points FROM round_scores rs
                JOIN players p ON p.id = rs.player_id
                WHERE session_id = ? ORDER BY round_number ASC
            """, (s["id"],)).fetchall()
            res.append({**dict(s), "scores": [dict(sc) for sc in scores], "rounds": [dict(r) for r in rounds]})
        return {"history": res}

@router.delete("/session/{session_id}")
def delete_session(session_id: int):
    with get_db_connection() as conn:
        c = conn.cursor()
        try:
            photo_row = c.execute("SELECT photo_path FROM sessions WHERE id = ?", (session_id,)).fetchone()
            if photo_row and photo_row["photo_path"]:
                full_path = photo_row["photo_path"]
                if os.path.exists(full_path):
                    os.remove(full_path)

            c.execute("DELETE FROM round_scores WHERE session_id = ?", (session_id,))
            c.execute("DELETE FROM scores WHERE session_id = ?", (session_id,))
            c.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()
            return {"status": "Erfolg"}
        except Exception as e:
            print(f"Fehler beim Löschen der Session: {e}")
            raise HTTPException(status_code=500, detail="Partie konnte nicht gelöscht werden.")

class EditSession(BaseModel):
    duration_minutes: int = None
    play_date: str = None
    score_adrian: int = None
    score_lea: int = None
    winner_id: int = None
    comment: str = None

@router.patch("/session/{session_id}")
def edit_session(session_id: int, data: EditSession):
    with get_db_connection() as conn:
        c = conn.cursor()
        
        updates = []
        params = []
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
            
        p_ids = {row["name"]: row["id"] for row in c.execute("SELECT * FROM players").fetchall()}
        
        if data.score_adrian is not None and data.winner_id is not None:
            c.execute("UPDATE scores SET score_value = ?, is_winner = ? WHERE session_id = ? AND player_id = ?",
                      (data.score_adrian, 1 if data.winner_id == 1 else 0, session_id, p_ids["Adrian"]))
        
        if data.score_lea is not None and data.winner_id is not None:
            c.execute("UPDATE scores SET score_value = ?, is_winner = ? WHERE session_id = ? AND player_id = ?",
                      (data.score_lea, 1 if data.winner_id == 2 else 0, session_id, p_ids["Lea"]))
                      
        conn.commit()
    return {"status": "Erfolg"}