import os, datetime, random
from fastapi import APIRouter, HTTPException
from database import get_db_connection

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/dashboard")
def get_dashboard_stats():
    p1 = os.getenv("PLAYER_1_NAME", "Adrian")
    p2 = os.getenv("PLAYER_2_NAME", "Lea")
    
    with get_db_connection() as conn:
        c = conn.cursor()
        
        # 1. Gesamtsiege pro Spieler
        wins_rows = c.execute("""
            SELECT p.name, COUNT(sc.id) as win_count 
            FROM players p
            LEFT JOIN scores sc ON p.id = sc.player_id AND sc.is_winner = 1
            GROUP BY p.name
        """).fetchall()
        wins = {p1: 0, p2: 0}
        for row in wins_rows:
            wins[row["name"]] = row["win_count"]
            
        # 2. Meistgespieltes Spiel (Dauerbrenner)
        most_played = c.execute("""
            SELECT g.name, g.image_url, COUNT(s.id) as count FROM sessions s 
            JOIN games g ON s.game_id = g.id 
            GROUP BY s.game_id ORDER BY count DESC LIMIT 1
        """).fetchone()
        
        # 3. Player 1's Fortress
        best_p1 = c.execute("""
            SELECT g.name, g.image_url, COUNT(*) as wins FROM scores sc
            JOIN sessions s ON sc.session_id = s.id
            JOIN games g ON s.game_id = g.id
            JOIN players p ON sc.player_id = p.id
            WHERE p.name = ? AND sc.is_winner = 1
            GROUP BY s.game_id ORDER BY wins DESC LIMIT 1
        """, (p1,)).fetchone()

        # 4. Player 2's Empire
        best_p2 = c.execute("""
            SELECT g.name, g.image_url, COUNT(*) as wins FROM scores sc
            JOIN sessions s ON sc.session_id = s.id
            JOIN games g ON s.game_id = g.id
            JOIN players p ON sc.player_id = p.id
            WHERE p.name = ? AND sc.is_winner = 1
            GROUP BY s.game_id ORDER BY wins DESC LIMIT 1
        """, (p2,)).fetchone()
        
        # 5. Dynamische Streak-Berechnung
        streaks = {}
        for p_name in [p1, p2]:
            results = c.execute("""
                SELECT sc.is_winner 
                FROM scores sc
                JOIN players p ON p.id = sc.player_id
                JOIN sessions s ON s.id = sc.session_id
                WHERE p.name = ?
                ORDER BY s.play_date DESC
            """, (p_name,)).fetchall()
            
            count = 0
            for r in results:
                if r["is_winner"] == 0:
                    count += 1
                else:
                    break
            
            if count >= 3:
                streaks[p_name] = f"💔 {count} Niederlagen in Folge"

        # 6. Echte Achievements (Badges)
        achievements = {p1: [], p2: []}
        
        night_owls = c.execute("""
            SELECT p.name FROM sessions s
            JOIN scores sc ON s.id = sc.session_id
            JOIN players p ON sc.player_id = p.id
            WHERE strftime('%H', datetime(play_date, 'localtime')) IN ('00', '01', '02', '03', '04', '05') AND sc.is_winner = 1
        """).fetchall()
        for no in night_owls:
            if no["name"] in achievements:
                if "🦇 Nachtschwärmer" not in achievements[no["name"]]:
                    achievements[no["name"]].append("🦇 Nachtschwärmer")
            
        marathons = c.execute("""
            SELECT p.name FROM sessions s
            JOIN scores sc ON s.id = sc.session_id
            JOIN players p ON sc.player_id = p.id
            WHERE duration_seconds >= 10800 AND sc.is_winner = 1
        """).fetchall()
        for m in marathons:
            if m["name"] in achievements:
                if "🏃‍♂️ Marathon-Gamer" not in achievements[m["name"]]:
                    achievements[m["name"]].append("🏃‍♂️ Marathon-Gamer")
            
        for p_name in [p1, p2]:
            asc_results = c.execute("""
                SELECT sc.is_winner 
                FROM scores sc
                JOIN players p ON p.id = sc.player_id
                JOIN sessions s ON s.id = sc.session_id
                WHERE p.name = ?
                ORDER BY s.play_date ASC
            """, (p_name,)).fetchall()
            
            loss_streak = 0
            for r in asc_results:
                if r["is_winner"] == 0:
                    loss_streak += 1
                else:
                    if loss_streak >= 3:
                        if "👑 Comeback-König" not in achievements[p_name]:
                            achievements[p_name].append("👑 Comeback-König")
                        break
                    loss_streak = 0

        return {
            "wins": wins,
            "most_played": dict(most_played) if most_played else None,
            "best_player1": dict(best_p1) if best_p1 else None,
            "best_player2": dict(best_p2) if best_p2 else None,
            "streaks": streaks,
            "achievements": achievements,
            "player1_name": p1,
            "player2_name": p2
        }

@router.get("/game/{game_id}")
def get_game_specific_stats(game_id: int):
    with get_db_connection() as conn:
        c = conn.cursor()
        
        game = c.execute("SELECT name, win_condition FROM games WHERE id = ?", (game_id,)).fetchone()
        if not game:
            return {"error": "Spiel nicht gefunden"}
            
        win_condition = game["win_condition"]
            
        wins_query = c.execute("""
            SELECT p.name, COUNT(sc.id) as win_count 
            FROM players p
            LEFT JOIN scores sc ON p.id = sc.player_id 
            JOIN sessions s ON s.id = sc.session_id
            WHERE s.game_id = ? AND sc.is_winner = 1
            GROUP BY p.name
        """, (game_id,)).fetchall()

        if win_condition == 1:
            highscores_query = c.execute("""
                SELECT p.name, MIN(sc.score_value) as max_score
                FROM scores sc
                JOIN players p ON p.id = sc.player_id
                JOIN sessions s ON s.id = sc.session_id
                WHERE s.game_id = ?
                GROUP BY p.name
            """, (game_id,)).fetchall()
        else:
            highscores_query = c.execute("""
                SELECT p.name, MAX(sc.score_value) as max_score
                FROM scores sc
                JOIN players p ON p.id = sc.player_id
                JOIN sessions s ON s.id = sc.session_id
                WHERE s.game_id = ?
                GROUP BY p.name
            """, (game_id,)).fetchall()

        history_query = c.execute("""
            SELECT s.* FROM sessions s 
            WHERE s.game_id = ? 
            ORDER BY s.play_date DESC
        """, (game_id,)).fetchall()
        
        full_history = []
        for s in history_query:
            scs = c.execute("""
                SELECT p.name, sc.score_value, sc.is_winner 
                FROM scores sc 
                JOIN players p ON sc.player_id = p.id 
                WHERE session_id = ?
            """, (s["id"],)).fetchall()
            
            rds = c.execute("""
                SELECT round_number, p.name, points 
                FROM round_scores rs
                JOIN players p ON p.id = rs.player_id
                WHERE session_id = ? 
                ORDER BY round_number ASC
            """, (s["id"],)).fetchall()
            
            full_history.append({
                **dict(s), 
                "scores": [dict(sc) for sc in scs],
                "rounds": [dict(r) for r in rds]
            })

        return {
            "game_name": game["name"],
            "win_condition": win_condition,
            "wins": {row["name"]: row["win_count"] for row in wins_query},
            "highscores": {row["name"]: row["max_score"] for row in highscores_query},
            "total_plays": len(full_history),
            "history": full_history
        }

# --- HIER SIND JETZT DIE COOLEST ADVANCED STATS SAUBER EINGEBAUT ---
@router.get("/game/{game_id}/advanced")
def get_advanced_game_stats(game_id: int):
    with get_db_connection() as conn:
        c = conn.cursor()
        
        total_games = c.execute("SELECT COUNT(*) FROM sessions WHERE game_id = ?", (game_id,)).fetchone()[0]
        if total_games == 0:
            return {"total_games": 0}
            
        avg_time = c.execute("SELECT AVG(duration_seconds) FROM sessions WHERE game_id = ?", (game_id,)).fetchone()[0]
        max_time = c.execute("SELECT MAX(duration_seconds) FROM sessions WHERE game_id = ?", (game_id,)).fetchone()[0]
        
        win_cond_row = c.execute("SELECT win_condition FROM games WHERE id = ?", (game_id,)).fetchone()
        win_condition = win_cond_row[0] if win_cond_row else 0
        
        if win_condition == 1:
            avg_scores_rows = c.execute("""
                SELECT p.name, AVG(sc.score_value) as avg_score, MIN(sc.score_value) as max_score
                FROM scores sc
                JOIN players p ON sc.player_id = p.id
                JOIN sessions s ON sc.session_id = s.id
                WHERE s.game_id = ?
                GROUP BY p.name
            """, (game_id,)).fetchall()
            
            all_time_high = c.execute("""
                SELECT p.name, sc.score_value FROM scores sc
                JOIN players p ON sc.player_id = p.id
                JOIN sessions s ON sc.session_id = s.id
                WHERE s.game_id = ?
                ORDER BY sc.score_value ASC LIMIT 1
            """, (game_id,)).fetchone()
        else:
            avg_scores_rows = c.execute("""
                SELECT p.name, AVG(sc.score_value) as avg_score, MAX(sc.score_value) as max_score
                FROM scores sc
                JOIN players p ON sc.player_id = p.id
                JOIN sessions s ON sc.session_id = s.id
                WHERE s.game_id = ?
                GROUP BY p.name
            """, (game_id,)).fetchall()
            
            all_time_high = c.execute("""
                SELECT p.name, sc.score_value FROM scores sc
                JOIN players p ON sc.player_id = p.id
                JOIN sessions s ON sc.session_id = s.id
                WHERE s.game_id = ?
                ORDER BY sc.score_value DESC LIMIT 1
            """, (game_id,)).fetchone()

        player_stats = {}
        for row in avg_scores_rows:
            player_stats[row["name"]] = {
                "avg": round(row["avg_score"], 1),
                "max": row["max_score"]
            }

        return {
            "total_games": total_games,
            "win_condition": win_condition,
            "avg_time_mins": round(avg_time / 60) if avg_time else 0,
            "max_time_mins": round(max_time / 60) if max_time else 0,
            "player_stats": player_stats,
            "all_time_high": dict(all_time_high) if all_time_high else None
        }

@router.get("/daily_photo")
def get_daily_photo():
    with get_db_connection() as conn:
        c = conn.cursor()
        photos = c.execute("""
            SELECT s.photo_path, s.play_date, g.name as game_name 
            FROM sessions s
            JOIN games g ON s.game_id = g.id
            WHERE s.photo_path IS NOT NULL AND s.photo_path != ''
        """).fetchall()
        
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
def get_chart_data():
    p1 = os.getenv("PLAYER_1_NAME", "Adrian")
    p2 = os.getenv("PLAYER_2_NAME", "Lea")
    with get_db_connection() as conn:
        c = conn.cursor()
        sessions = c.execute("""
            SELECT s.play_date, sc.is_winner, p.name 
            FROM sessions s
            JOIN scores sc ON sc.session_id = s.id
            JOIN players p ON p.id = sc.player_id
            WHERE sc.is_winner = 1
            ORDER BY s.play_date ASC
        """).fetchall()
        
        labels = []
        p1_data = []
        p2_data = []
        p1_cum = 0
        p2_cum = 0
        
        for idx, row in enumerate(sessions):
            # Parse date format to show day/month
            try:
                dt = datetime.datetime.fromisoformat(row["play_date"].replace('Z', '+00:00'))
                labels.append(dt.strftime("%d.%m."))
            except:
                labels.append(f"#{idx+1}")
                
            if row["name"] == p1: p1_cum += 1
            elif row["name"] == p2: p2_cum += 1
                
            p1_data.append(p1_cum)
            p2_data.append(p2_cum)
            
        return {
            "labels": labels,
            "datasets": [
                {"label": p1, "data": p1_data, "borderColor": "#00f0ff", "tension": 0.3, "backgroundColor": "rgba(0, 240, 255, 0.1)", "fill": True},
                {"label": p2, "data": p2_data, "borderColor": "#ff00e5", "tension": 0.3, "backgroundColor": "rgba(255, 0, 229, 0.1)", "fill": True}
            ]
        }