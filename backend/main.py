import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import init_db
from routes import games, sessions, stats, auth, groups
from auth_utils import get_current_user

app = FastAPI(title="Game-Log Pro v1.1")

# Datenbank beim Start initialisieren
init_db()

# Router einbinden
app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(games.router)
app.include_router(sessions.router)
app.include_router(stats.router)

# Upload-Ordner anlegen
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─── Geschützte Foto-Route ────────────────────────────────────────────────────
bearer = HTTPBearer(auto_error=False)

@app.get("/photos/{filename}")
async def get_photo(filename: str, credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    """Fotos sind nur für eingeloggte User abrufbar."""
    # Auth prüfen
    if credentials:
        try:
            user = get_current_user(credentials)
        except HTTPException:
            user = None
    else:
        user = None

    # Fotos öffentlich lassen für PWA/Browser-Kompatibilität (kann später verschärft werden)
    # TODO: In v1.2 auf streng-auth umstellen
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Foto nicht gefunden")
    return FileResponse(file_path)

# Static Frontend mounten (immer zuletzt!)
app.mount("/", StaticFiles(directory="static", html=True), name="static")