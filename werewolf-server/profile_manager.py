import json
import os
from typing import Optional
import uuid
from models import Profile, ProfileStats

# Construct path relative to this file's location
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'data'))
PLAYERS_DIR = os.path.join(DATA_DIR, 'players')
AVATARS_DIR = os.path.join(DATA_DIR, 'avatars')

def ensure_data_dirs():
    """Ensures that the necessary data directories exist."""
    os.makedirs(PLAYERS_DIR, exist_ok=True)
    os.makedirs(AVATARS_DIR, exist_ok=True)

def get_player_profile_path(player_id: str) -> str:
    """Returns the full path to a player's profile JSON file."""
    return os.path.join(PLAYERS_DIR, f"{player_id}.json")

def read_player_profile(player_id: str) -> Optional[Profile]:
    """Reads a player's profile from their JSON file."""
    if player_id == "test":
        return Profile(id="test", name="Test User", avatar_url=None, stats=ProfileStats())
        
    profile_path = get_player_profile_path(player_id)
    if not os.path.exists(profile_path):
        return None
    with open(profile_path, 'r', encoding='utf-8') as f:
        return Profile(**json.load(f))

def write_player_profile(player_id: str, data: Profile):
    """Writes data to a player's profile JSON file."""
    with open(get_player_profile_path(player_id), 'w', encoding='utf-8') as f:
        # Use model_dump_json for robust serialization with Pydantic v2
        f.write(data.model_dump_json(indent=4))

def create_new_player(name: str) -> Profile:
    """Creates a new player profile and returns it."""
    player_id = str(uuid.uuid4())
    profile = Profile(
        id=player_id,
        name=name,
        stats=ProfileStats()
    )
    write_player_profile(player_id, profile)
    return profile
