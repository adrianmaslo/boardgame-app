import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from database import init_db
from routes import games, sessions
from routes import games, sessions, stats # stats hinzufügen

app = FastAPI(title="Lea & Adrian Game Tracker")

# Datenbank beim Start initialisieren
init_db()

# Die neuen Routen einbinden
app.include_router(games.router)
app.include_router(sessions.router)
app.include_router(stats.router) # Hier einbinden

# Mounts für Dateien
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/photos", StaticFiles(directory=UPLOAD_DIR), name="photos")
app.mount("/", StaticFiles(directory="static", html=True), name="static")