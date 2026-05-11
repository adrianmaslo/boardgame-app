import os
import httpx
import xmltodict
from fastapi import APIRouter
from database import get_db_connection

router = APIRouter()

@router.get("/search")
async def search_bgg(name: str):
    token = os.getenv("BGG_TOKEN")
    if not token or token == "DEIN_TOKEN_KOMMT_HIER_REIN":
        mock_data = [{"id": "13", "name": "Catan (Mock)", "year": "1995"}]
        return {"results": [g for g in mock_data if name.lower() in g['name'].lower()]}

    async with httpx.AsyncClient() as client:
        response = await client.get("https://boardgamegeek.com/xmlapi2/search", params={"query": name, "type": "boardgame"})
        data = xmltodict.parse(response.text)
        items = data.get('items', {}).get('item', [])
        if not isinstance(items, list): items = [items]
        return {"results": [{"id": i['@id'], "name": i['name']['@value'] if isinstance(i['name'], dict) else i['name'][0]['@value']} for i in items]}

@router.get("/collection")
def get_collection():
    with get_db_connection() as conn:
        rows = conn.execute("SELECT * FROM games ORDER BY name ASC").fetchall()
        return {"collection": [dict(row) for row in rows]}

@router.get("/add")
def add_game(name: str, bgg_id: int):
    with get_db_connection() as conn:
        try:
            conn.execute("INSERT INTO games (name, bgg_id) VALUES (?, ?)", (name, bgg_id))
            conn.commit()
            return {"message": "Hinzugefügt"}
        except:
            return {"error": "Bereits vorhanden"}