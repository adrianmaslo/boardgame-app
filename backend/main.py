import os
import sqlite3
import httpx
import xmltodict
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from typing import Optional

# 1. Konfiguration laden
# Lädt Variablen aus der .env Datei (z.B. den BGG_TOKEN)
load_dotenv()

app = FastAPI()

# 2. Datenbank-Bauplan
# Erstellt die Tabelle 'games', falls sie noch nicht existiert
def init_db():
    database_path = "games.db"
    with sqlite3.connect(database_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                bgg_id INTEGER UNIQUE,
                year INTEGER
            )
        """)
        conn.commit()

init_db()

# 3. Such-Logik (Hybrid-Modus)
@app.get("/search")
async def search_bgg(name: str):
    token = os.getenv("BGG_TOKEN")

    # MOCK-MODUS: Aktiv, solange kein echter Token in der .env steht
    if not token or token == "DEIN_TOKEN_KOMMT_HIER_REIN":
        print(f"DEBUG: Suche nach '{name}' im Mock-Modus")
        mock_data = [
            {"id": "13", "name": "Catan (Mock)", "year": "1995"},
            {"id": "161936", "name": "Pandemic Legacy (Mock)", "year": "2015"},
            {"id": "174430", "name": "Gloomhaven (Mock)", "year": "2017"},
            {"id": "31260", "name": "Agricola (Mock)", "year": "2007"}
        ]
        results = [g for g in mock_data if name.lower() in g['name'].lower()]
        return {"results": results if results else mock_data}

    # LIVE-MODUS: Wird automatisch genutzt, wenn der Token da ist
    url = "https://boardgamegeek.com/xmlapi2/search"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"query": name, "type": "boardgame"}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, headers=headers, timeout=10.0)
            
            if response.status_code == 401:
                return {"error": "Token ungültig oder noch nicht aktiv (401)."}
            
            data = xmltodict.parse(response.text)
            
            if not data.get('items') or 'item' not in data['items']:
                return {"results": []}
            
            items = data['items']['item']
            if not isinstance(items, list):
                items = [items]

            results = []
            for item in items:
                raw_name = item['name']
                game_name = raw_name['@value'] if not isinstance(raw_name, list) else raw_name[0]['@value']
                results.append({
                    "id": item['@id'],
                    "name": game_name,
                    "year": item.get('yearpublished', {}).get('@value', 'n/a')
                })
            return {"results": results}
            
        except Exception as e:
            return {"error": "BGG API nicht erreichbar", "detail": str(e)}

# 4. Spiel zur Sammlung hinzufügen
@app.get("/add")
def add_game(name: str, bgg_id: int, year: Optional[int] = None):
    try:
        with sqlite3.connect("games.db") as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO games (name, bgg_id, year) VALUES (?, ?, ?)",
                (name, bgg_id, year)
            )
            conn.commit()
        return {"message": f"'{name}' wurde gespeichert!"}
    except sqlite3.IntegrityError:
        return {"error": "Spiel ist bereits in der Sammlung."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 5. Sammlung abrufen
@app.get("/collection")
def get_collection():
    with sqlite3.connect("games.db") as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM games ORDER BY name ASC")
        rows = cursor.fetchall()
        return {"collection": [dict(row) for row in rows]}

# 6. Frontend ausliefern
# WICHTIG: Muss ganz unten stehen!
app.mount("/", StaticFiles(directory="static", html=True), name="static")