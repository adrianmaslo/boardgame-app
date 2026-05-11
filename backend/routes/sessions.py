import os
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, Form
from database import get_db_connection

router = APIRouter()
UPLOAD_DIR = "uploads"

@router.post("/record_session")
async def record_session(
    game_id: int = Form(...),
    duration: int = Form(...),
    comment: str = Form(None),
    score_adrian: int = Form(0),
    score_lea: int = Form(0),
    winner_id: int = Form(None),
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
        c.execute("INSERT INTO sessions (game_id, duration_seconds, photo_path, comment) VALUES (?, ?, ?, ?)", 
                  (game_id, duration, photo_path, comment))
        s_id = c.lastrowid
        
        # Adrian & Lea IDs holen
        p_ids = {row["name"]: row["id"] for row in c.execute("SELECT * FROM players").fetchall()}
        
        # Scores eintragen
        c.execute("INSERT INTO scores (session_id, player_id, score_value, is_winner) VALUES (?, ?, ?, ?)",
                  (s_id, p_ids["Adrian"], score_adrian, 1 if winner_id == 1 else 0))
        c.execute("INSERT INTO scores (session_id, player_id, score_value, is_winner) VALUES (?, ?, ?, ?)",
                  (s_id, p_ids["Lea"], score_lea, 1 if winner_id == 2 else 0))
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
            res.append({**dict(s), "scores": [dict(sc) for sc in scores]})
        return {"history": res}