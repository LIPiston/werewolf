from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Literal

# 1. 角色定义 (Role Definitions)
class Role(str, Enum):
    """Enumeration of all possible roles in the game."""
    VILLAGER = "平民"
    WEREWOLF = "狼人"
    SEER = "预言家"
    WITCH = "女巫"
    HUNTER = "猎人"
    IDIOT = "白痴"
    GUARD = "守卫"
    KNIGHT = "骑士"
    WOLF_KING = "狼王"
    WHITE_WOLF_KING = "白狼王"
    WOLF_BEAUTY = "狼美人"
    SNOW_WOLF = "雪狼"
    GARGOYLE = "石像鬼"
    EVIL_KNIGHT = "恶灵骑士"
    HIDDEN_WOLF = "隐狼"

# 2. 游戏阶段 (Game Stage)
class Stage(str, Enum):
    """Overall game state machine."""
    WAITING = "WAITING"
    ROLE_ASSIGN = "ROLE_ASSIGN"
    NIGHT_START = "NIGHT_START"
    NIGHT_SKILLS = "NIGHT_SKILLS"
    NIGHT_RESOLVE = "NIGHT_RESOLVE"
    DAWN = "DAWN"
    SPEECH_ORDER = "SPEECH_ORDER"
    SPEECH = "SPEECH"
    VOTE = "VOTE"
    VOTE_RESOLVE = "VOTE_RESOLVE"
    GAME_OVER = "GAME_OVER"

# 3. 玩家与房间 (Player & Room)
class Player(BaseModel):
    """Represents a player in the game."""
    id: str
    name: str
    avatar_url: Optional[str] = None
    is_alive: bool = True
    role: Optional[Role] = None
    is_host: bool = False
    is_ready: bool = False
    seat: Optional[int] = Field(default=None, ge=0, lt=12)

class GameConfig(BaseModel):
    """Defines the configuration for a game."""
    template_name: str
    is_private: bool = False
    allow_spectators: bool = True

class GameState(BaseModel):
    """Represents the complete state of a single game room."""
    room_id: str
    players: List[Player] = []
    stage: Stage = Stage.WAITING
    timer: int = 0
    day: int = 0
    host_id: str
    game_config: GameConfig
    speech_order: List[str] = []
    night_actions: Dict[str, Any] = {}
    day_votes: Dict[str, str] = {}
    witch_has_save: bool = True
    witch_has_poison: bool = True
    winner: Optional[Literal["GOOD", "WOLF"]] = None

# 4. WebSocket 事件模型 (WebSocket Event Models)
class ConnectedPayload(BaseModel):
    player_id: str
    room_id: str

class StageChangePayload(BaseModel):
    stage: Stage
    timer: int
    players: List[Player]

class NightResultPayload(BaseModel):
    dead: List[str]
    saved: Optional[str] = None
    poisoned: Optional[str] = None
    checked: Optional[Dict[str, Role]] = None

class VoteResultPayload(BaseModel):
    eliminated: Optional[str]
    votes: Dict[str, str]

class GameOverPayload(BaseModel):
    winner: Literal["GOOD", "WOLF"]
    roles: Dict[str, Role]

# 5. 板子定义 (Game Template)
class GameTemplate(BaseModel):
    """Represents a game setup template (板子)."""
    name: str
    player_counts: List[int]
    roles: Dict[Role, int]
    description: str

GAME_TEMPLATES: List[GameTemplate] = [
    GameTemplate(
        name="6人暗牌局",
        player_counts=[6],
        roles={Role.WEREWOLF: 2, Role.VILLAGER: 2, Role.SEER: 1, Role.GUARD: 1},
        description="2狼, 2民, 预言家, 守卫"
    ),
    GameTemplate(
        name="预女猎白 标准板",
        player_counts=[12],
        roles={Role.WEREWOLF: 4, Role.VILLAGER: 4, Role.SEER: 1, Role.WITCH: 1, Role.HUNTER: 1, Role.IDIOT: 1},
        description="4狼, 4民, 预女猎白"
    ),
    GameTemplate(
        name="狼王守卫",
        player_counts=[12],
        roles={Role.WEREWOLF: 3, Role.WOLF_KING: 1, Role.VILLAGER: 4, Role.SEER: 1, Role.WITCH: 1, Role.HUNTER: 1, Role.GUARD: 1},
        description="3狼, 狼王, 4民, 预女猎守"
    ),
]

# 6. REST API Models
class RoomCreateRequest(BaseModel):
    host_name: str
    config: GameConfig

class RoomCreateResponse(BaseModel):
    room_id: str
    host_player_id: str
    token: str

class RoomJoinRequest(BaseModel):
    player_name: str

class RoomJoinResponse(BaseModel):
    player_id: str
    token: str