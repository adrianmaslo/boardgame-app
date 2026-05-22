import sqlite3
import os
import random
import string

DATABASE_NAME = "games.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def generate_invite_code(length=6):
    """Generiert einen zufälligen 6-stelligen Einladungs-Code (Buchstaben + Ziffern, kein 0/O/I/l)."""
    chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(random.choices(chars, k=length))

def init_db():
    with get_db_connection() as conn:
        c = conn.cursor()

        # ── Bestehende Tabellen ──────────────────────────────────────────────
        c.execute("""CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            bgg_id INTEGER UNIQUE,
            is_coop INTEGER DEFAULT 0,
            win_condition INTEGER DEFAULT 0
        )""")

        new_game_columns = [
            "image_url TEXT",
            "min_players INTEGER",
            "max_players INTEGER",
            "playing_time INTEGER",
            "weight REAL",
            "category TEXT DEFAULT 'Standard'",
            "is_wishlist INTEGER DEFAULT 0",
            "group_id INTEGER REFERENCES groups(id)"
        ]
        for col in new_game_columns:
            try:
                c.execute(f"ALTER TABLE games ADD COLUMN {col}")
            except sqlite3.OperationalError:
                pass

        c.execute("""CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER,
            play_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            start_time DATETIME,
            duration_seconds INTEGER,
            photo_path TEXT,
            comment TEXT,
            is_coop INTEGER DEFAULT 0,
            group_id INTEGER REFERENCES groups(id),
            FOREIGN KEY (game_id) REFERENCES games (id)
        )""")
        try:
            c.execute("ALTER TABLE sessions ADD COLUMN group_id INTEGER REFERENCES groups(id)")
        except sqlite3.OperationalError:
            pass

        c.execute("""CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            player_id INTEGER,
            score_value INTEGER,
            is_winner INTEGER DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES sessions (id),
            FOREIGN KEY (player_id) REFERENCES players (id)
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS round_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            round_number INTEGER,
            player_id INTEGER,
            points INTEGER,
            FOREIGN KEY (session_id) REFERENCES sessions (id)
        )""")

        # ── Neue Tabellen: Auth & Gruppen ────────────────────────────────────
        c.execute("""CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            avatar_color TEXT DEFAULT '#6366f1',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")

        new_user_columns = [
            "avatar_icon TEXT",
            "favorite_game_id INTEGER REFERENCES games(id)"
        ]
        for col in new_user_columns:
            try:
                c.execute(f"ALTER TABLE users ADD COLUMN {col}")
            except sqlite3.OperationalError:
                pass

        c.execute("""CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            invite_code TEXT UNIQUE NOT NULL,
            admin_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES users(id)
        )""")

        c.execute("""CREATE TABLE IF NOT EXISTS group_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            display_name TEXT NOT NULL,
            avatar_color TEXT DEFAULT '#6366f1',
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(group_id, user_id),
            FOREIGN KEY (group_id) REFERENCES groups(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )""")

        new_gm_columns = [
            "avatar_icon TEXT",
            "favorite_game_id INTEGER REFERENCES games(id)"
        ]
        for col in new_gm_columns:
            try:
                c.execute(f"ALTER TABLE group_members ADD COLUMN {col}")
            except sqlite3.OperationalError:
                pass

        # Alte players Tabelle bleibt für Legacy-Kompatibilität
        c.execute("CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL)")

        # Neue guests Tabelle
        c.execute("""CREATE TABLE IF NOT EXISTS guests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id),
            UNIQUE(group_id, name)
        )""")

        # ── Legacy-Migration: Bestehende Daten in Default-Gruppe migrieren ───
        _migrate_legacy_data(c)

        # ── Migration: Gast-IDs in round_scores vereinheitlichen (negativ setzen) ───
        c.execute("""
            UPDATE round_scores 
            SET player_id = (
                SELECT s.player_id 
                FROM scores s 
                WHERE s.session_id = round_scores.session_id 
                  AND (s.player_id = round_scores.player_id OR s.player_id = -round_scores.player_id)
            )
            WHERE EXISTS (
                SELECT 1 
                FROM scores s 
                WHERE s.session_id = round_scores.session_id 
                  AND (s.player_id = round_scores.player_id OR s.player_id = -round_scores.player_id)
            )
        """)

        conn.commit()

def _migrate_legacy_data(c):
    """
    Migriert bestehende (hardcodierte Adrian/Lea) Daten in eine 
    Legacy-Gruppe, falls noch keine User existieren.
    """
    user_count = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if user_count > 0:
        return  # Migration bereits erfolgt

    p1_name = os.getenv("PLAYER_1_NAME", "Adrian")
    p2_name = os.getenv("PLAYER_2_NAME", "Lea")

    # Prüfen ob alte Sessions existieren
    session_count = c.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
    if session_count == 0:
        # Saubere Installation, keine Migration nötig
        # Aber wir stellen sicher dass players-Tabelle existiert
        return

    # Placeholder-User für bestehende Daten anlegen (ohne echtes Passwort)
    from auth_utils import hash_password
    
    # Admin-User (Player 1)
    placeholder_pw = hash_password("changeme123")
    c.execute(
        "INSERT OR IGNORE INTO users (username, password_hash, avatar_color) VALUES (?, ?, ?)",
        (p1_name.lower(), placeholder_pw, "#00f0ff")
    )
    p1_user_id = c.execute("SELECT id FROM users WHERE username = ?", (p1_name.lower(),)).fetchone()["id"]

    # Player 2 User
    c.execute(
        "INSERT OR IGNORE INTO users (username, password_hash, avatar_color) VALUES (?, ?, ?)",
        (p2_name.lower(), placeholder_pw, "#ff00e5")
    )
    p2_user_id = c.execute("SELECT id FROM users WHERE username = ?", (p2_name.lower(),)).fetchone()["id"]

    # Default-Gruppe erstellen
    invite_code = generate_invite_code()
    c.execute(
        "INSERT OR IGNORE INTO groups (name, invite_code, admin_id) VALUES (?, ?, ?)",
        (f"{p1_name} & {p2_name}", invite_code, p1_user_id)
    )
    group_id = c.execute("SELECT id FROM groups WHERE admin_id = ?", (p1_user_id,)).fetchone()["id"]

    # Beide als Mitglieder hinzufügen
    c.execute(
        "INSERT OR IGNORE INTO group_members (group_id, user_id, display_name, avatar_color) VALUES (?, ?, ?, ?)",
        (group_id, p1_user_id, p1_name, "#00f0ff")
    )
    c.execute(
        "INSERT OR IGNORE INTO group_members (group_id, user_id, display_name, avatar_color) VALUES (?, ?, ?, ?)",
        (group_id, p2_user_id, p2_name, "#ff00e5")
    )

    # Alle bestehenden Sessions & Games der Gruppe zuweisen
    c.execute("UPDATE sessions SET group_id = ? WHERE group_id IS NULL", (group_id,))
    c.execute("UPDATE games SET group_id = ? WHERE group_id IS NULL", (group_id,))

    print(f"✅ Legacy-Migration: {session_count} Sessions → Gruppe '{p1_name} & {p2_name}' (ID: {group_id})")
    print(f"   Einladungs-Code: {invite_code}")
    print(f"   Temporäres Passwort für '{p1_name.lower()}' und '{p2_name.lower()}': changeme123")