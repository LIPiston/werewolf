import json
import os
from typing import Dict, Any, Optional
import uuid

DATA_DIR = './data'
PLAYERS_DIR = os.path.join(DATA_DIR, 'players')
AVATARS_DIR = os.path.join(DATA_DIR, 'avatars')
DEFAULT_AVATAR = '😢'

def ensure_data_dirs():
    """Ensures that the necessary data directories exist."""
    os.makedirs(PLAYERS_DIR, exist_ok=True)
    os.makedirs(AVATARS_DIR, exist_ok=True)

def get_player_profile_path(player_id: str) -> str:
    """Returns the full path to a player's profile JSON file."""
    return os.path.join(PLAYERS_DIR, f"{player_id}.json")

def read_player_profile(player_id: str) -> Optional[Dict[str, Any]]:
    """Reads a player's profile from their JSON file."""
    profile_path = get_player_profile_path(player_id)
    if not os.path.exists(profile_path):
        return None
    with open(profile_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def write_player_profile(player_id: str, data: Dict[str, Any]):
    """Writes data to a player's profile JSON file."""
    with open(get_player_profile_path(player_id), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def create_new_player(name: str) -> Dict[str, Any]:
    """Creates a new player profile and returns it."""
    player_id = str(uuid.uuid4())
    profile = {
        'id': player_id,
        'name': name,
        'avatar_url': DEFAULT_AVATAR, # Can be an emoji or a URL
        'stats': {
            'games_played': 0,
            'wins': 0,
            'losses': 0,
            'roles': {
                'werewolf': 0,
                'god': 0, # Seer, Witch, Hunter etc.
                'villager': 0
            }
        }
    }
    write_player_profile(player_id, profile)
    return profile
