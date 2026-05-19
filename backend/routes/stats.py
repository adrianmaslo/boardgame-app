import datetime, random
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from database import get_db_connection
from auth_utils import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


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


def _get_group_players(conn, group_id: int):
    """Gibt alle Mitglieder der Gruppe als Dict {user_id: display_name} zurück."""
    members = conn.execute("""
        SELECT u.id, gm.display_name, gm.avatar_color
        FROM group_members gm JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ? ORDER BY gm.joined_at ASC
    """, (group_id,)).fetchall()
    return {m["id"]: {"name": m["display_name"], "color": m["avatar_color"]} for m in members}


@router.get("/dashboard")
def get_dashboard_stats(group_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        active_group_id = _get_active_group_id(conn, current_user["id"], group_id)
        if not active_group_id:
            return {"wins": {}, "most_played": None, "players": []}

        players = _get_group_players(conn, active_group_id)
        player_ids = list(players.keys())

        # 1. Gesamtsiege pro Spieler
        wins = {players[pid]["name"]: 0 for pid in player_ids}
        wins_rows = conn.execute("""
            SELECT sc.player_id, COUNT(sc.id) as win_count
            FROM scores sc JOIN sessions s ON s.id = sc.session_id
            WHERE sc.is_winner = 1 AND s.group_id = ?
            GROUP BY sc.player_id
        """, (active_group_id,)).fetchall()
        for row in wins_rows:
            if row["player_id"] in players:
                wins[players[row["player_id"]]["name"]] = row["win_count"]

        # 2. Meistgespieltes Spiel
        most_played = conn.execute("""
            SELECT g.name, g.image_url, COUNT(s.id) as count FROM sessions s
            JOIN games g ON s.game_id = g.id WHERE s.group_id = ?
            GROUP BY s.game_id ORDER BY count DESC LIMIT 1
        """, (active_group_id,)).fetchone()

        # 3. Bestes Spiel pro Spieler (meiste Siege darin)
        best_per_player = {}
        for pid in player_ids[:2]:  # Nur erste 2 für Dashboard-Karten
            best = conn.execute("""
                SELECT g.name, g.image_url, COUNT(*) as wins FROM scores sc
                JOIN sessions s ON sc.session_id = s.id
                JOIN games g ON s.game_id = g.id
                WHERE sc.player_id = ? AND sc.is_winner = 1 AND s.group_id = ?
                GROUP BY s.game_id ORDER BY wins DESC LIMIT 1
            """, (pid, active_group_id)).fetchone()
            best_per_player[players[pid]["name"]] = dict(best) if best else None

        # 4. Streaks
        streaks = {}
        for pid, pdata in players.items():
            results = conn.execute("""
                SELECT sc.is_winner FROM scores sc
                JOIN sessions s ON s.id = sc.session_id
                WHERE sc.player_id = ? AND s.group_id = ?
                ORDER BY s.play_date DESC
            """, (pid, active_group_id)).fetchall()
            count = 0
            for r in results:
                if r["is_winner"] == 0:
                    count += 1
                else:
                    break
            if count >= 3:
                streaks[pdata["name"]] = f"💔 {count} Niederlagen in Folge"

        # 5. Achievements
        achievements = {pdata["name"]: [] for pdata in players.values()}

        night_owls = conn.execute("""
            SELECT sc.player_id FROM sessions s
            JOIN scores sc ON s.id = sc.session_id
            WHERE strftime('%H', datetime(play_date, 'localtime')) IN ('00','01','02','03','04','05')
            AND sc.is_winner = 1 AND s.group_id = ?
        """, (active_group_id,)).fetchall()
        for no in night_owls:
            if no["player_id"] in players:
                name = players[no["player_id"]]["name"]
                if "🦇 Nachtschwärmer" not in achievements[name]:
                    achievements[name].append("🦇 Nachtschwärmer")

        marathons = conn.execute("""
            SELECT sc.player_id FROM sessions s
            JOIN scores sc ON s.id = sc.session_id
            WHERE duration_seconds >= 10800 AND sc.is_winner = 1 AND s.group_id = ?
        """, (active_group_id,)).fetchall()
        for m in marathons:
            if m["player_id"] in players:
                name = players[m["player_id"]]["name"]
                if "🏃‍♂️ Marathon-Gamer" not in achievements[name]:
                    achievements[name].append("🏃‍♂️ Marathon-Gamer")

        player_names = list(wins.keys())
        return {
            "wins": wins,
            "most_played": dict(most_played) if most_played else None,
            "best_per_player": best_per_player,
            # Legacy-Kompatibilität
            "best_player1": list(best_per_player.values())[0] if best_per_player else None,
            "best_player2": list(best_per_player.values())[1] if len(best_per_player) > 1 else None,
            "streaks": streaks,
            "achievements": achievements,
            "player1_name": player_names[0] if player_names else "",
            "player2_name": player_names[1] if len(player_names) > 1 else "",
            "players": [{"id": pid, **pdata} for pid, pdata in players.items()]
        }


@router.get("/game/{game_id}")
def get_game_specific_stats(game_id: int, group_id: Optional[int] = None,
                             current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        active_group_id = _get_active_group_id(conn, current_user["id"], group_id)

        game = conn.execute("SELECT name, win_condition FROM games WHERE id = ?", (game_id,)).fetchone()
        if not game:
            return {"error": "Spiel nicht gefunden"}

        win_condition = game["win_condition"]
        players = _get_group_players(conn, active_group_id) if active_group_id else {}

        wins_query = conn.execute("""
            SELECT sc.player_id, COUNT(sc.id) as win_count
            FROM scores sc JOIN sessions s ON s.id = sc.session_id
            WHERE s.game_id = ? AND sc.is_winner = 1 AND s.group_id = ?
            GROUP BY sc.player_id
        """, (game_id, active_group_id)).fetchall()

        if win_condition == 1:
            highscores_query = conn.execute("""
                SELECT sc.player_id, MIN(sc.score_value) as max_score
                FROM scores sc JOIN sessions s ON s.id = sc.session_id
                WHERE s.game_id = ? AND s.group_id = ? GROUP BY sc.player_id
            """, (game_id, active_group_id)).fetchall()
        else:
            highscores_query = conn.execute("""
                SELECT sc.player_id, MAX(sc.score_value) as max_score
                FROM scores sc JOIN sessions s ON s.id = sc.session_id
                WHERE s.game_id = ? AND s.group_id = ? GROUP BY sc.player_id
            """, (game_id, active_group_id)).fetchall()

        history_query = conn.execute("""
            SELECT s.* FROM sessions s WHERE s.game_id = ? AND s.group_id = ?
            ORDER BY s.play_date DESC
        """, (game_id, active_group_id)).fetchall()

        full_history = []
        for s in history_query:
            scs = conn.execute("""
                SELECT gm.display_name as name, sc.score_value, sc.is_winner
                FROM scores sc JOIN group_members gm ON sc.player_id = gm.user_id AND gm.group_id = ?
                WHERE sc.session_id = ?
            """, (active_group_id, s["id"])).fetchall()
            if not scs:
                scs = conn.execute("""
                    SELECT p.name, sc.score_value, sc.is_winner FROM scores sc
                    JOIN players p ON sc.player_id = p.id WHERE session_id = ?
                """, (s["id"],)).fetchall()
            rds = conn.execute("""
                SELECT round_number, gm.display_name as name, points
                FROM round_scores rs JOIN group_members gm ON rs.player_id = gm.user_id AND gm.group_id = ?
                WHERE rs.session_id = ? ORDER BY round_number ASC
            """, (active_group_id, s["id"])).fetchall()
            full_history.append({**dict(s), "scores": [dict(sc) for sc in scs], "rounds": [dict(r) for r in rds]})

        def pid_to_name(pid):
            return players.get(pid, {}).get("name", f"Spieler {pid}")

        return {
            "game_name": game["name"],
            "win_condition": win_condition,
            "wins": {pid_to_name(r["player_id"]): r["win_count"] for r in wins_query},
            "highscores": {pid_to_name(r["player_id"]): r["max_score"] for r in highscores_query},
            "total_plays": len(full_history),
            "history": full_history
        }


@router.get("/game/{game_id}/advanced")
def get_advanced_game_stats(game_id: int, group_id: Optional[int] = None,
                             current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        active_group_id = _get_active_group_id(conn, current_user["id"], group_id)
        players = _get_group_players(conn, active_group_id) if active_group_id else {}

        total_games = conn.execute(
            "SELECT COUNT(*) FROM sessions WHERE game_id = ? AND group_id = ?",
            (game_id, active_group_id)
        ).fetchone()[0]
        if total_games == 0:
            return {"total_games": 0}

        avg_time = conn.execute(
            "SELECT AVG(duration_seconds) FROM sessions WHERE game_id = ? AND group_id = ?",
            (game_id, active_group_id)
        ).fetchone()[0]
        max_time = conn.execute(
            "SELECT MAX(duration_seconds) FROM sessions WHERE game_id = ? AND group_id = ?",
            (game_id, active_group_id)
        ).fetchone()[0]

        win_cond_row = conn.execute("SELECT win_condition FROM games WHERE id = ?", (game_id,)).fetchone()
        win_condition = win_cond_row[0] if win_cond_row else 0

        if win_condition == 1:
            avg_scores_rows = conn.execute("""
                SELECT sc.player_id, AVG(sc.score_value) as avg_score, MIN(sc.score_value) as max_score
                FROM scores sc JOIN sessions s ON sc.session_id = s.id
                WHERE s.game_id = ? AND s.group_id = ? GROUP BY sc.player_id
            """, (game_id, active_group_id)).fetchall()
            all_time_high = conn.execute("""
                SELECT sc.player_id, sc.score_value FROM scores sc
                JOIN sessions s ON sc.session_id = s.id
                WHERE s.game_id = ? AND s.group_id = ? ORDER BY sc.score_value ASC LIMIT 1
            """, (game_id, active_group_id)).fetchone()
        else:
            avg_scores_rows = conn.execute("""
                SELECT sc.player_id, AVG(sc.score_value) as avg_score, MAX(sc.score_value) as max_score
                FROM scores sc JOIN sessions s ON sc.session_id = s.id
                WHERE s.game_id = ? AND s.group_id = ? GROUP BY sc.player_id
            """, (game_id, active_group_id)).fetchall()
            all_time_high = conn.execute("""
                SELECT sc.player_id, sc.score_value FROM scores sc
                JOIN sessions s ON sc.session_id = s.id
                WHERE s.game_id = ? AND s.group_id = ? ORDER BY sc.score_value DESC LIMIT 1
            """, (game_id, active_group_id)).fetchone()

        player_stats = {}
        for row in avg_scores_rows:
            name = players.get(row["player_id"], {}).get("name", f"Spieler {row['player_id']}")
            player_stats[name] = {"avg": round(row["avg_score"], 1), "max": row["max_score"]}

        high_name = players.get(all_time_high["player_id"], {}).get("name", "") if all_time_high else None
        return {
            "total_games": total_games,
            "win_condition": win_condition,
            "avg_time_mins": round(avg_time / 60) if avg_time else 0,
            "max_time_mins": round(max_time / 60) if max_time else 0,
            "player_stats": player_stats,
            "all_time_high": {"name": high_name, "score_value": all_time_high["score_value"]} if all_time_high else None
        }


@router.get("/daily_photo")
def get_daily_photo(group_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        active_group_id = _get_active_group_id(conn, current_user["id"], group_id)
        if not active_group_id:
            return {"photo": None}

        photos = conn.execute("""
            SELECT s.photo_path, s.play_date, g.name as game_name
            FROM sessions s JOIN games g ON s.game_id = g.id
            WHERE s.photo_path IS NOT NULL AND s.photo_path != '' AND s.group_id = ?
        """, (active_group_id,)).fetchall()

        if not photos:
            return {"photo": None}

        seed = datetime.date.today().toordinal()
        random.seed(seed)
        selected = random.choice(photos)
        random.seed()

        return {
            "photo": {
                "path": "/" + selected["photo_path"].replace("uploads/", "photos/"),
                "date": selected["play_date"],
                "game": selected["game_name"]
            }
        }


@router.get("/chart_data")
def get_chart_data(group_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        active_group_id = _get_active_group_id(conn, current_user["id"], group_id)
        if not active_group_id:
            return {"labels": [], "datasets": []}

        players = _get_group_players(conn, active_group_id)
        colors = ["#00f0ff", "#ff00e5", "#7c3aed", "#f59e0b"]

        sessions = conn.execute("""
            SELECT s.play_date, sc.is_winner, sc.player_id
            FROM sessions s JOIN scores sc ON sc.session_id = s.id
            WHERE sc.is_winner = 1 AND s.group_id = ?
            ORDER BY s.play_date ASC
        """, (active_group_id,)).fetchall()

        labels = []
        cumulative = {pid: 0 for pid in players}
        data_series = {pid: [] for pid in players}

        for idx, row in enumerate(sessions):
            try:
                dt = datetime.datetime.fromisoformat(row["play_date"].replace('Z', '+00:00'))
                labels.append(dt.strftime("%d.%m."))
            except:
                labels.append(f"#{idx+1}")
            if row["player_id"] in cumulative:
                cumulative[row["player_id"]] += 1
            for pid in players:
                data_series[pid].append(cumulative[pid])

        datasets = []
        for i, (pid, pdata) in enumerate(players.items()):
            color = pdata["color"] if pdata.get("color") else colors[i % len(colors)]
            datasets.append({
                "label": pdata["name"],
                "data": data_series[pid],
                "borderColor": color,
                "tension": 0.3,
                "backgroundColor": color.replace("#", "rgba(").rstrip(")") + ", 0.1)",
                "fill": True
            })

        return {"labels": labels, "datasets": datasets}