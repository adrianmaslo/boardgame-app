import sqlite3

DATABASE_NAME = "games.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("""CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            bgg_id INTEGER UNIQUE,
            is_coop INTEGER DEFAULT 0
        )""")
        c.execute("CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL)")
        c.execute("""CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER,
            play_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            start_time DATETIME,
            duration_seconds INTEGER,
            photo_path TEXT,
            comment TEXT,
            is_coop INTEGER DEFAULT 0,
            FOREIGN KEY (game_id) REFERENCES games (id)
        )""")
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
        c.execute("INSERT OR IGNORE INTO players (name) VALUES (?)", ("Adrian",))
        c.execute("INSERT OR IGNORE INTO players (name) VALUES (?)", ("Lea",))
        conn.commit()