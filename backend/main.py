from fastapi import FastAPI
import sqlite3
import httpx
import xmltodict

app = FastAPI()

# Datenbank-Check beim Start
def init_db():
    with sqlite3.connect("games.db") as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY, name TEXT, bgg_id INTEGER)")

init_db()

@app.get("/")
def home():
    return {"status": "bereit", "info": "Nutze /search?name=SPIELNAME zum Suchen"}

@app.get("/search")
async def search_bgg(name: str):
    # Wir fragen die offizielle BGG API an
    url = f"https://boardgamegeek.com/xmlapi2/search?query={name}&type=boardgame"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        # BGG antwortet in XML, wir machen daraus ein schönes Python-Wörterbuch (JSON-style)
        data = xmltodict.parse(response.text)
        
        # Falls keine Spiele gefunden wurden
        if 'items' not in data or 'item' not in data['items']:
            return {"results": []}
        
        items = data['items']['item']
        # Falls nur ein Ergebnis kommt, machen wir eine Liste daraus
        if not isinstance(items, list):
            items = [items]

        results = []
        for item in items:
            results.append({
                "id": item['@id'],
                "name": item['name']['@value'],
                "year": item.get('yearpublished', {}).get('@value', 'unbekannt')
            })
            
        return {"results": results}