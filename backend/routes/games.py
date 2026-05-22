import os
import sqlite3
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from database import get_db_connection
from auth_utils import get_current_user

router = APIRouter(tags=["games"])

raw_token = os.getenv("BGG_TOKEN", "")
BGG_AUTH_TOKEN = raw_token.replace('"', '').replace("'", "").strip()


def get_bgg_headers():
    headers = {"Accept": "application/xml", "User-Agent": "GameLogPro/1.1"}
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
                img_node = item.find('image') or item.find('thumbnail')
                if img_node is not None: data["image_url"] = img_node.text
                if item.find('minplayers') is not None: data["min_players"] = int(item.find('minplayers').get('value', 0))
                if item.find('maxplayers') is not None: data["max_players"] = int(item.find('maxplayers').get('value', 0))
                if item.find('playingtime') is not None: data["playing_time"] = int(item.find('playingtime').get('value', 0))
                weight_node = item.find(".//averageweight")
                if weight_node is not None: data["weight"] = round(float(weight_node.get('value', 0)), 2)
    except Exception as e:
        print(f"⚠️ BGG Detail Fehler: {e}")
    return data


def _get_active_group_id(conn, user_id: int, group_id: Optional[int] = None):
    if group_id:
        member = conn.execute(
            "SELECT gm.group_id FROM group_members gm WHERE gm.group_id = ? AND gm.user_id = ?",
            (group_id, user_id)
        ).fetchone()
        if not member:
            raise HTTPException(status_code=403, detail="Kein Zugriff auf diese Gruppe.")
        return group_id
    first = conn.execute(
        "SELECT gm.group_id FROM group_members gm WHERE gm.user_id = ? ORDER BY gm.joined_at ASC LIMIT 1",
        (user_id,)
    ).fetchone()
    return first["group_id"] if first else None


# ─── BGG Suche (kein Auth nötig) ─────────────────────────────────────────────
@router.get("/search")
def search_bgg(name: str):
    if not name or len(name.strip()) < 2:
        return {"results": []}
    encoded_name = urllib.parse.quote(name.strip())
    url = f"https://boardgamegeek.com/xmlapi2/search?type=boardgame&query={encoded_name}"
    try:
        req = urllib.request.Request(url, headers=get_bgg_headers())
        with urllib.request.urlopen(req, timeout=8) as response:
            root = ET.fromstring(response.read())
        results = []
        for item in root.findall('item'):
            bgg_id = item.get('id')
            name_node = item.find("name[@type='primary']")
            if name_node is None: continue
            results.append({"id": int(bgg_id), "name": name_node.get('value')})
        query_lower = name.strip().lower()
        results.sort(key=lambda x: (x['name'].lower() != query_lower, len(x['name'])))
        return {"results": results[:25]}
    except Exception as e:
        print(f"🔴 Suche fehlgeschlagen: {e}")
        raise HTTPException(status_code=500, detail="BGG Suche fehlgeschlagen")


@router.get("/preview")
def preview_game(bgg_id: int):
    return get_bgg_details(bgg_id)


# ─── Sammlung (Auth-geschützt, gruppenspezifisch) ────────────────────────────
@router.get("/add")
def add_game(name: str, bgg_id: int, is_wishlist: int = 0, group_id: Optional[int] = None,
             current_user: dict = Depends(get_current_user)):
    details = get_bgg_details(bgg_id)
    final_name = details["name"] if details["name"] else name

    with get_db_connection() as conn:
        active_group_id = _get_active_group_id(conn, current_user["id"], group_id)
        
        existing = conn.execute("SELECT id FROM games WHERE bgg_id = ? AND group_id = ?", (bgg_id, active_group_id)).fetchone()
        if existing:
            return {"status": "Existiert bereits"}
            
        try:
            conn.execute("""
                INSERT INTO games (name, bgg_id, image_url, min_players, max_players, playing_time, weight, is_wishlist, group_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (final_name, bgg_id, details["image_url"], details["min_players"],
                  details["max_players"], details["playing_time"], details["weight"], is_wishlist, active_group_id))
            conn.commit()
            return {"status": "Erfolg"}
        except sqlite3.IntegrityError:
            return {"status": "Existiert bereits"}


@router.delete("/delete/{game_id}")
def delete_game(game_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        game = conn.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
        if not game:
            raise HTTPException(status_code=404, detail="Spiel nicht gefunden.")
        count = conn.execute("SELECT count(*) FROM sessions WHERE game_id = ?", (game_id,)).fetchone()[0]
        if count > 0:
            raise HTTPException(status_code=400, detail="Du kannst dieses Spiel nicht löschen, da ihr es schon gespielt habt!")
        conn.execute("DELETE FROM games WHERE id = ?", (game_id,))
        conn.commit()
        return {"status": "Erfolg"}


@router.patch("/toggle_win_condition/{game_id}")
def toggle_win_condition(game_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        current = conn.execute("SELECT win_condition FROM games WHERE id = ?", (game_id,)).fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="Spiel nicht gefunden")
        # Cycle through 0 (highest wins), 1 (lowest wins), 2 (no points, only winner)
        new_cond = (current["win_condition"] + 1) % 3
        conn.execute("UPDATE games SET win_condition = ? WHERE id = ?", (new_cond, game_id))
        conn.commit()
        return {"status": "Erfolg", "new_win_condition": new_cond}


@router.patch("/game/{game_id}/category")
def change_game_category(game_id: int, category: str, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        conn.execute("UPDATE games SET category = ? WHERE id = ?", (category or "Standard", game_id))
        conn.commit()
        return {"status": "Erfolg", "category": category}


@router.get("/collection")
def get_collection(group_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        active_group_id = _get_active_group_id(conn, current_user["id"], group_id)
        if not active_group_id:
            return {"collection": [], "wishlist": []}

        collection = conn.execute(
            "SELECT * FROM games WHERE is_wishlist = 0 AND group_id = ? ORDER BY name ASC",
            (active_group_id,)
        ).fetchall()
        wishlist = conn.execute(
            "SELECT * FROM games WHERE is_wishlist = 1 AND group_id = ? ORDER BY name ASC",
            (active_group_id,)
        ).fetchall()
        return {
            "collection": [dict(g) for g in collection],
            "wishlist": [dict(g) for g in wishlist]
        }


@router.patch("/game/{game_id}/wishlist")
def toggle_wishlist(game_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        current = conn.execute("SELECT is_wishlist FROM games WHERE id = ?", (game_id,)).fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="Spiel nicht gefunden")
        new_val = 0 if current["is_wishlist"] == 1 else 1
        conn.execute("UPDATE games SET is_wishlist = ? WHERE id = ?", (new_val, game_id))
        conn.commit()
        return {"status": "Erfolg", "is_wishlist": new_val}