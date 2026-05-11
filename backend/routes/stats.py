from fastapi import APIRouter
from database import get_db_connection

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/dashboard")
def get_dashboard_stats():
    with get_db_connection() as conn:
        c = conn.cursor()
        
        # 1. Gesamtsiege pro Spieler
        wins = c.execute("""
            SELECT p.name, COUNT(sc.id) as win_count 
            FROM players p
            LEFT JOIN scores sc ON p.id = sc.player_id AND sc.is_winner = 1
            GROUP BY p.name
        """).fetchall()
        
        # 2. Dynamische Streak-Berechnung (zählt alle Niederlagen bis zum letzten Sieg)
        streaks = {}
        for p_name in ["Adrian", "Lea"]:
            # Alle Ergebnisse des Spielers holen (von neu nach alt)
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
                    break # Serie gerissen durch einen Sieg
            
            if count >= 3:
                streaks[p_name] = f"Pechsträhne! {count} Niederlagen in Folge."

        return {
            "wins": {row["name"]: row["win_count"] for row in wins},
            "streaks": streaks,
            "achievements": ["🔥 Serie läuft!"] if any(s for s in streaks) else []
        }

@router.get("/game/{game_id}")
def get_game_specific_stats(game_id: int):
    with get_db_connection() as conn:
        c = conn.cursor()
        
        # 1. Grundinfos zum Spiel
        game = c.execute("SELECT name FROM games WHERE id = ?", (game_id,)).fetchone()
        if not game:
            return {"error": "Spiel nicht gefunden"}
            
        # 2. Siege Adrian vs. Lea für dieses Spiel
        wins_query = c.execute("""
            SELECT p.name, COUNT(sc.id) as win_count 
            FROM players p
            LEFT JOIN scores sc ON p.id = sc.player_id 
            JOIN sessions s ON s.id = sc.session_id
            WHERE s.game_id = ? AND sc.is_winner = 1
            GROUP BY p.name
        """, (game_id,)).fetchall()

        # 3. Highscores für dieses Spiel
        highscores_query = c.execute("""
            SELECT p.name, MAX(sc.score_value) as max_score
            FROM scores sc
            JOIN players p ON p.id = sc.player_id
            JOIN sessions s ON s.id = sc.session_id
            WHERE s.game_id = ?
            GROUP BY p.name
        """, (game_id,)).fetchall()

        # 4. Historie nur für dieses Spiel laden
        history_query = c.execute("""
            SELECT s.* FROM sessions s 
            WHERE s.game_id = ? 
            ORDER BY s.play_date DESC
        """, (game_id,)).fetchall()
        
        full_history = []
        for s in history_query:
            # Endergebnisse der Session
            scs = c.execute("""
                SELECT p.name, sc.score_value, sc.is_winner 
                FROM scores sc 
                JOIN players p ON sc.player_id = p.id 
                WHERE session_id = ?
            """, (s["id"],)).fetchall()
            
            # Runden der Session
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
            "wins": {row["name"]: row["win_count"] for row in wins_query},
            "highscores": {row["name"]: row["max_score"] for row in highscores_query},
            "total_plays": len(full_history),
            "history": full_history
        }