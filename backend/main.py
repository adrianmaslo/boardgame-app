import os
import sqlite3
import httpx
import xmltodict
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from typing import Optional
import shutil
import uuid

load_dotenv()
app = FastAPI()

# Ordner für Uploads (Fotos)
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- DATENBANK SETUP ---
def init_db():
    with sqlite3.connect("games.db") as conn:
        c = conn.cursor()
        c.execute("""CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            bgg_id INTEGER UNIQUE,
            is_coop INTEGER DEFAULT 0
        )""")
        c.execute("CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL)")
        c.execute("""CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER,
            play_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            duration_seconds INTEGER,
            photo_path TEXT,
            comment TEXT,
            is_coop INTEGER DEFAULT 0,
            FOREIGN KEY (game_id) REFERENCES games (id)
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            player_id INTEGER,
            score_value INTEGER,
            is_winner INTEGER DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES sessions (id),
            FOREIGN KEY (player_id) REFERENCES players (id)
        )""")
        c.execute("INSERT OR IGNORE INTO players (name) VALUES (?)", ("Adrian",))
        c.execute("INSERT OR IGNORE INTO players (name) VALUES (?)", ("Lea",))
        conn.commit()

init_db()

# --- BGG LOGIK (Wieder integriert) ---
@app.get("/search")
async def search_bgg(name: str):
    token = os.getenv("BGG_TOKEN")
    if not token or token == "DEIN_TOKEN_KOMMT_HIER_REIN":
        mock_data = [
            {"id": "13", "name": "Catan (Mock)", "year": "1995"},
            {"id": "161936", "name": "Pandemic Legacy (Mock)", "year": "2015"}
        ]
        return {"results": [g for g in mock_data if name.lower() in g['name'].lower()]}

    url = "https://boardgamegeek.com/xmlapi2/search"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params={"query": name, "type": "boardgame"}, headers={"Authorization": f"Bearer {token}"})
            data = xmltodict.parse(response.text)
            items = data.get('items', {}).get('item', [])
            if not isinstance(items, list): items = [items]
            
            results = []
            for item in items:
                game_name = item['name']['@value'] if not isinstance(item['name'], list) else item['name'][0]['@value']
                results.append({
                    "id": item['@id'],
                    "name": game_name,
                    "year": item.get('yearpublished', {}).get('@value', 'n/a')
                })
            return {"results": results}
        except Exception as e:
            return {"error": "API Fehler", "detail": str(e)}

@app.get("/add")
def add_game(name: str, bgg_id: int):
    try:
        with sqlite3.connect("games.db") as conn:
            conn.execute("INSERT INTO games (name, bgg_id) VALUES (?, ?)", (name, bgg_id))
            conn.commit()
        return {"message": f"'{name}' wurde zu deiner Sammlung hinzugefügt!"}
    except sqlite3.IntegrityError:
        return {"error": "Spiel ist bereits in der Sammlung."}

# --- SAMMLUNG & SPIELER ---
@app.get("/collection")
def get_collection():
    with sqlite3.connect("games.db") as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM games ORDER BY name ASC").fetchall()
        return {"collection": [dict(row) for row in rows]}

@app.get("/players")
def get_players():
    with sqlite3.connect("games.db") as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM players").fetchall()
        return {"players": [dict(row) for row in rows]}

# --- FOTO & SESSION (Vorbereitung) ---
@app.post("/record_session")
async def record_session(
    game_id: int = Form(...),
    duration: int = Form(...), # Die gestoppten Sekunden vom Handy
    comment: str = Form(None),
    is_coop: int = Form(0),
    # Ergebnisse für euch beide
    score_adrian: int = Form(0),
    score_lea: int = Form(0),
    winner_id: int = Form(None), # Wer hat gewonnen? (ID von Adrian oder Lea)
    photo: UploadFile = File(None)
):
    with sqlite3.connect("games.db") as conn:
        c = conn.cursor()
        
        # 1. Foto speichern (falls vorhanden)
        photo_path = None
        if photo:
            file_name = f"{uuid.uuid4()}.jpg"
            photo_path = os.path.join(UPLOAD_DIR, file_name)
            with open(photo_path, "wb") as buffer:
                shutil.copyfileobj(photo.file, buffer)

        # 2. Die Session (Spielrunde) anlegen
        c.execute("""
            INSERT INTO sessions (game_id, duration_seconds, photo_path, comment, is_coop)
            VALUES (?, ?, ?, ?, ?)
        """, (game_id, duration, photo_path, comment, is_coop))
        
        session_id = c.lastrowid # Die ID der gerade erstellten Runde merken

        # 3. Die Scores für Adrian und Lea verknüpfen
        # Wir holen uns die IDs von Adrian und Lea aus der Datenbank
        adrian_id = c.execute("SELECT id FROM players WHERE name = 'Adrian'").fetchone()[0]
        lea_id = c.execute("SELECT id FROM players WHERE name = 'Lea'").fetchone()[0]

        # Score Adrian
        c.execute("""
            INSERT INTO scores (session_id, player_id, score_value, is_winner)
            VALUES (?, ?, ?, ?)
        """, (session_id, adrian_id, score_adrian, 1 if winner_id == adrian_id else 0))

        # Score Lea
        c.execute("""
            INSERT INTO scores (session_id, player_id, score_value, is_winner)
            VALUES (?, ?, ?, ?)
        """, (session_id, lea_id, score_adrian, 1 if winner_id == lea_id else 0))

        conn.commit()

    return {"status": "Erfolg", "session_id": session_id}

# --- MOUNTS ---
app.mount("/photos", StaticFiles(directory=UPLOAD_DIR), name="photos")
app.mount("/", StaticFiles(directory="static", html=True), name="static")