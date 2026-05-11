from fastapi import FastAPI, HTTPException
import sqlite3
from typing import List, Optional

app = FastAPI()

# 1. Datenbank beim Start initialisieren
def init_db():
    with sqlite3.connect("games.db") as conn:
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

# --- Endpunkte ---

@app.get("/")
def home():
    return {
        "status": "online",
        "endpoints": {
            "suche": "/search?name=SPIELNAME",
            "hinzufügen": "/add?name=NAME&bgg_id=ID&year=JAHR",
            "sammlung": "/collection"
        }
    }

# 2. Suche (Aktuell im Mock-Modus mit Beispieldaten)
@app.get("/search")
async def search_bgg(name: str):
    # Sobald dein BGG-Token da ist, ersetzen wir diesen Teil wieder durch die echte API-Anfrage
    mock_data = [
        {"id": "13", "name": "Catan", "year": "1995"},
        {"id": "161936", "name": "Pandemic Legacy: Season 1", "year": "2015"},
        {"id": "174430", "name": "Gloomhaven", "year": "2017"},
        {"id": "31260", "name": "Agricola", "year": "2007"},
        {"id": "224517", "name": "Brass: Birmingham", "year": "2018"}
    ]
    
    results = [g for g in mock_data if name.lower() in g['name'].lower()]
    
    # Wenn kein Name gefunden wurde, geben wir eine kleine Auswahl zurück
    return {"results": results if results else mock_data}

# 3. Ein Spiel zur eigenen Datenbank hinzufügen
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
        return {"message": f"'{name}' wurde erfolgreich zu deiner Sammlung hinzugefügt!"}
    except sqlite3.IntegrityError:
        return {"error": "Dieses Spiel ist bereits in deiner Sammlung."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. Die eigene Sammlung anzeigen
@app.get("/collection")
def get_collection():
    with sqlite3.connect("games.db") as conn:
        conn.row_factory = sqlite3.Row  # Damit wir Spaltennamen zurückbekommen
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM games ORDER BY name ASC")
        rows = cursor.fetchall()
        
        # Umwandlung der Zeilen in eine Liste von Wörterbüchern
        collection = [dict(row) for row in rows]
        
    return {"collection": collection, "count": len(collection)}