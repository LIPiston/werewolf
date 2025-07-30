from enum import Enum
from pydantic import BaseModel, Field, ConfigDict, field_serializer
from typing import List, Dict, Literal, Optional, Any

# --- Game-related Enums and Models ---

class Role(str, Enum):
    """Enumeration of all possible roles in the game."""
    WEREWOLF = "狼人"
    VILLAGER = "平民"
    SEER = "预言家"
    WITCH = "女巫"
    HUNTER = "猎人"
    GUARD = "守卫"
    IDIOT = "白痴"
    WOLF_KING = "狼王"
    KNIGHT = "骑士"
    WHITE_WOLF_KING = "白狼王"
    WOLF_BEAUTY = "狼美人"
    SNOW_WOLF = "雪狼"
    GARGOYLE = "石像鬼"
    EVIL_KNIGHT = "恶灵骑士"
    HIDDEN_WOLF = "隐狼"


WOLF_ROLES = {
    Role.WEREWOLF,
    Role.WOLF_KING,
    Role.WHITE_WOLF_KING,
    Role.WOLF_BEAUTY,
    Role.SNOW_WOLF,
    Role.HIDDEN_WOLF,
    Role.GARGOYLE
}


class GameTemplate(BaseModel):
    """Represents a game setup template (板子)."""
    name: str
    player_counts: List[int]
    roles: Dict[Role, int]
    description: str

class GameConfig(BaseModel):
    model_config = ConfigDict(extra='allow')
    """Defines the configuration for a game."""
    template_name: str

# --- Player and Profile Models ---

class ProfileStats(BaseModel):
    games_played: int = 0
    wins: int = 0
    losses: int = 0
    roles: Dict[str, int] = {
        'werewolf': 0,
        'god': 0,
        'villager': 0
    }

class Profile(BaseModel):
    id: str
    name: str
    avatar_url: Optional[str] = None
    stats: ProfileStats

class Player(BaseModel):
    """Represents a player in the game."""
    id: str # In-game temporary ID
    profile_id: str # Persistent profile ID
    name: str
    avatar_url: Optional[str] = None
    is_alive: bool = True
    role: Optional[Role] = None

    @field_serializer('role')
    def serialize_role(self, role: Role, _info):
        return role.value if role else None
    is_sheriff: bool = False
    seat: Optional[int] = Field(default=None, ge=0, lt=12)

# --- Game State Model ---

class Game(BaseModel):
    """Represents the state of a single game room."""
    room_id: str
    players: List[Player] = []
    host_id: str
    game_config: Any
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
    last_guarded_id: Optional[str] = None

# --- Pre-defined Game Templates ---

GAME_TEMPLATES: List[GameTemplate] = [
    GameTemplate(
        name="新手9人局",
        player_counts=[9],
        roles={ Role.WEREWOLF: 3, Role.VILLAGER: 3, Role.SEER: 1, Role.WITCH: 1, Role.HUNTER: 1 },
        description="3狼, 3民, 预言家, 女巫, 猎人"
    ),
    GameTemplate(
        name="预女猎白 标准板",
        player_counts=[12],
        roles={ Role.WEREWOLF: 4, Role.VILLAGER: 4, Role.SEER: 1, Role.WITCH: 1, Role.HUNTER: 1, Role.IDIOT: 1 },
        description="4狼, 4民, 预女猎白"
    ),
    GameTemplate(
        name="狼王守卫",
        player_counts=[12],
        roles={ Role.WEREWOLF: 3, Role.WOLF_KING: 1, Role.VILLAGER: 4, Role.SEER: 1, Role.WITCH: 1, Role.HUNTER: 1, Role.GUARD: 1 },
        description="3狼, 狼王, 4民, 预女猎守"
    ),
    GameTemplate(
        name="白狼王骑士",
        player_counts=[12],
        roles={ Role.WEREWOLF: 3, Role.WHITE_WOLF_KING: 1, Role.VILLAGER: 4, Role.SEER: 1, Role.WITCH: 1, Role.KNIGHT: 1, Role.GUARD: 1 },
        description="3狼, 白狼王, 4民, 预女骑守"
    ),
    GameTemplate(
        name="6人明牌局",
        player_counts=[6],
        roles={
            Role.WEREWOLF: 2,
            Role.VILLAGER: 2,
            Role.SEER: 1,
            Role.HUNTER: 1,
        },
        description="2狼, 2民, 预言家, 猎人"
    ),
    GameTemplate(
        name="6人暗牌局",
        player_counts=[6],
        roles={
            Role.WEREWOLF: 2,
            Role.VILLAGER: 2,
            Role.SEER: 1,
            Role.GUARD: 1,
        },
        description="2狼, 2民, 预言家, 守卫"
    ),
]