import os
import sqlite3
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from fastapi import APIRouter, HTTPException
from database import get_db_connection

router = APIRouter(tags=["games"])

raw_token = os.getenv("BGG_TOKEN", "")
BGG_AUTH_TOKEN = raw_token.replace('"', '').replace("'", "").strip()

def get_bgg_headers():
    headers = {"Accept": "application/xml", "User-Agent": "AdrianAndLeaGameLog/1.0"}
    if BGG_AUTH_TOKEN:
        headers["Authorization"] = f"Bearer {BGG_AUTH_TOKEN}"
    return headers

def get_bgg_details(bgg_id: int):
    details_url = f"https://boardgamegeek.com/xmlapi2/thing?id={bgg_id}&stats=1"
    data = {"image_url": "", "min_players": 0, "max_players": 0, "playing_time": 0, "weight": 0.0, "name": ""}
    
    try:
        req = urllib.request.Request(details_url, headers=get_bgg_headers())
        with urllib.request.urlopen(req, timeout=8) as response:
            root = ET.fromstring(response.read())
            item = root.find('item')
            if item is not None:
                name_node = item.find("name[@type='primary']")
                if name_node is not None: data["name"] = name_node.get('value')
                
                # HD-Bild suchen, nur als Fallback das kleine Thumbnail nehmen
                img_node = item.find('image')
                if img_node is None:
                    img_node = item.find('thumbnail')
                if img_node is not None: data["image_url"] = img_node.text
                
                if item.find('minplayers') is not None: data["min_players"] = int(item.find('minplayers').get('value', 0))
                if item.find('maxplayers') is not None: data["max_players"] = int(item.find('maxplayers').get('value', 0))
                if item.find('playingtime') is not None: data["playing_time"] = int(item.find('playingtime').get('value', 0))
                
                weight_node = item.find(".//averageweight")
                if weight_node is not None: data["weight"] = round(float(weight_node.get('value', 0)), 2)
    except Exception as e:
        print(f"⚠️ BGG Detail Fehler: {e}")
    return data

@router.get("/search")
def search_bgg(name: str):
    if not name or len(name.strip()) < 2:
        return {"results": []}
    
    query_str = name.strip()
    encoded_name = urllib.parse.quote(query_str)
    url = f"https://boardgamegeek.com/xmlapi2/search?type=boardgame&query={encoded_name}"
        
    try:
        req = urllib.request.Request(url, headers=get_bgg_headers())
        with urllib.request.urlopen(req, timeout=8) as response:
            root = ET.fromstring(response.read())
            
        results = []
        for item in root.findall('item'):
            bgg_id = item.get('id')
            name_node = item.find("name[@type='primary']")
            
            if name_node is None:
                continue
                
            game_name = name_node.get('value')
            results.append({"id": int(bgg_id), "name": game_name})
            
        # Sortier-Algorithmus: Exakte Treffer nach oben, dann nach Länge
        query_lower = query_str.lower()
        results.sort(key=lambda x: (x['name'].lower() != query_lower, len(x['name'])))
            
        return {"results": results[:25]}
    except Exception as e:
        print(f"🔴 Suche fehlgeschlagen: {e}")
        raise HTTPException(status_code=500, detail="BGG Suche fehlgeschlagen")

@router.get("/preview")
def preview_game(bgg_id: int):
    return get_bgg_details(bgg_id)

@router.get("/add")
def add_game(name: str, bgg_id: int):
    details = get_bgg_details(bgg_id)
    final_name = details["name"] if details["name"] else name
    
    with get_db_connection() as conn:
        c = conn.cursor()
        try:
            c.execute("""
                INSERT INTO games (name, bgg_id, image_url, min_players, max_players, playing_time, weight) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (final_name, bgg_id, details["image_url"], details["min_players"], details["max_players"], details["playing_time"], details["weight"]))
            conn.commit()
            return {"status": "Erfolg"}
        except sqlite3.IntegrityError:
            return {"status": "Existiert bereits"}

@router.delete("/delete/{game_id}")
def delete_game(game_id: int):
    with get_db_connection() as conn:
        c = conn.cursor()
        count = c.execute("SELECT count(*) FROM sessions WHERE game_id = ?", (game_id,)).fetchone()[0]
        if count > 0:
            raise HTTPException(status_code=400, detail="Du kannst dieses Spiel nicht löschen, da ihr es schon gespielt und geloggt habt!")
            
        c.execute("DELETE FROM games WHERE id = ?", (game_id,))
        conn.commit()
        return {"status": "Erfolg"}

@router.get("/collection")
def get_collection():
    with get_db_connection() as conn:
        collection = conn.execute("SELECT * FROM games ORDER BY name ASC").fetchall()
        return {"collection": [dict(g) for g in collection]}