import sqlite3
import json
from typing import Dict, List, Optional

DATABASE_URL = "werewolf.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row # This allows accessing columns by name
    return conn

def create_tables():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            max_players INTEGER NOT NULL,
            status TEXT NOT NULL,
            current_day INTEGER NOT NULL,
            game_log TEXT,
            roles_config TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            room_id TEXT,
            profile_id TEXT, -- Foreign key to the player's profile
            is_host BOOLEAN,
            role TEXT,
            is_alive BOOLEAN
        )
    """)
    conn.commit()
    conn.close()

def insert_room(room_data: Dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO rooms (id, max_players, status, current_day, game_log, roles_config) VALUES (?, ?, ?, ?, ?, ?)",
        (room_data["id"], room_data["max_players"], room_data["status"],
         room_data["current_day"], json.dumps(room_data["game_log"]), json.dumps(room_data["roles_config"]))
    )
    conn.commit()
    conn.close()

def get_room(room_id: str) -> Optional[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM rooms WHERE id = ?", (room_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        room = dict(row)
        room["game_log"] = json.loads(room["game_log"]) if room["game_log"] else []
        room["roles_config"] = json.loads(room["roles_config"]) if room["roles_config"] else {}
        return room
    return None

def update_room(room_data: Dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE rooms SET max_players = ?, status = ?, current_day = ?, game_log = ?, roles_config = ? WHERE id = ?",
        (room_data["max_players"], room_data["status"], room_data["current_day"],
         json.dumps(room_data["game_log"]), json.dumps(room_data["roles_config"]), room_data["id"])
    )
    conn.commit()
    conn.close()

def insert_player(player_data):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("INSERT INTO players (id, room_id, profile_id, is_host, role, is_alive) VALUES (?, ?, ?, ?, ?, ?)",
              (player_data['id'], player_data['room_id'], player_data['profile_id'], player_data['is_host'], player_data['role'], player_data['is_alive']))
    conn.commit()
    conn.close()

def get_player(player_id: str) -> Optional[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM players WHERE id = ?", (player_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        player = dict(row)
        player["is_host"] = bool(player["is_host"])
        player["is_alive"] = bool(player["is_alive"])
        return player
    return None

def get_players_in_room(room_id: str) -> List[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM players WHERE room_id = ?", (room_id,))
    rows = cursor.fetchall()
    conn.close()
    players = []
    for row in rows:
        player = dict(row)
        player["is_host"] = bool(player["is_host"])
        player["is_alive"] = bool(player["is_alive"])
        players.append(player)
    return players

def update_player(player_data):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE players SET is_host = ?, role = ?, is_alive = ? WHERE id = ?",
              (player_data['is_host'], player_data['role'], player_data['is_alive'], player_data['id']))
    conn.commit()
    conn.close()

def delete_room(room_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
    cursor.execute("DELETE FROM players WHERE room_id = ?", (room_id,)) # Delete associated players
    conn.commit()
    conn.close()
