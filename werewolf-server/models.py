from pydantic import BaseModel, Field
from typing import List, Dict, Literal, Optional

class Player(BaseModel):
    """Represents a player in the game."""
    id: str # In-game temporary ID
    profile_id: str # Persistent profile ID
    name: str
    avatar_url: str
    is_alive: bool = True
    role: Optional[str] = None
    is_sheriff: bool = False

class GameConfig(BaseModel):
    """Defines the configuration for a game."""
    roles: List[str]

class Game(BaseModel):
    """Represents the state of a single game room."""
    room_id: str
    players: List[Player] = []
    host_id: str
    game_config: GameConfig
    day: int = 0
    phase: Literal["lobby", "werewolf_turn", "witch_turn", "seer_turn", "day", "voting", "ended"] = "lobby"
    werewolf_kill_target: Optional[str] = None
    werewolf_votes: Dict[str, str] = {}
    witch_has_save: bool = True
    witch_has_poison: bool = True
    witch_used_potion_tonight: bool = False
    witch_save_target: Optional[str] = None
    seer_check_result: Optional[Dict[str, str]] = None
    day_votes: Dict[str, str] = {}
    nightly_deaths: List[str] = []