import asyncio
import random
import uuid
from typing import Dict, Optional, List
from collections import Counter

from models import (
    GameState, Player, Role, Stage, GameConfig, GAME_TEMPLATES,
    StageChangePayload, NightResultPayload, VoteResultPayload, GameOverPayload
)
from connections import connection_manager
import game_logic

class GameManager:
    _instance = None
    games: Dict[str, GameState] = {}
    _locks: Dict[str, asyncio.Lock] = {}
    _timers: Dict[str, asyncio.Task] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GameManager, cls).__new__(cls)
        return cls._instance

    def get_game(self, room_id: str) -> Optional[GameState]:
        return self.games.get(room_id)

    async def create_game(self, host_name: str, config: GameConfig) -> GameState:
        room_id = str(uuid.uuid4())[:6]
        host_id = f"P{random.randint(100, 999)}"
        
        host_player = Player(id=host_id, name=host_name, is_host=True, seat=0)
        
        game = GameState(
            room_id=room_id,
            host_id=host_id,
            players=[host_player],
            game_config=config
        )
        
        self.games[room_id] = game
        self._locks[room_id] = asyncio.Lock()
        return game

    async def join_game(self, room_id: str, player_name: str) -> Optional[Player]:
        async with self._locks[room_id]:
            game = self.get_game(room_id)
            template = next((t for t in GAME_TEMPLATES if t.name == game.game_config.template_name), None)
            if not game or not template or len(game.players) >= max(template.player_counts) or game.stage != Stage.WAITING:
                return None

            occupied_seats = {p.seat for p in game.players}
            available_seats = [i for i in range(max(template.player_counts)) if i not in occupied_seats]
            if not available_seats:
                return None
            
            new_player_id = f"P{random.randint(100, 999)}"
            while any(p.id == new_player_id for p in game.players):
                 new_player_id = f"P{random.randint(100, 999)}"

            player = Player(id=new_player_id, name=player_name, seat=min(available_seats))
            game.players.append(player)
            game.players.sort(key=lambda p: p.seat)
            await self.broadcast_stage_change(room_id, 0)
            return player

    async def set_player_ready(self, room_id: str, player_id: str, ready: bool):
        async with self._locks[room_id]:
            game = self.get_game(room_id)
            if not game or game.stage != Stage.WAITING:
                return

            player = next((p for p in game.players if p.id == player_id), None)
            if player:
                player.is_ready = ready
                await self.broadcast_stage_change(room_id, 0)

            template = next((t for t in GAME_TEMPLATES if t.name == game.game_config.template_name), None)
            if not template: return

            if len(game.players) in template.player_counts and all(p.is_ready for p in game.players):
                await self.advance_stage(room_id)

    def _assign_roles(self, game: GameState):
        template = next((t for t in GAME_TEMPLATES if t.name == game.game_config.template_name), None)
        if not template:
            print(f"Error: Template {game.game_config.template_name} not found!")
            return

        roles: List[Role] = []
        for role, count in template.roles.items():
            roles.extend([role] * count)
        random.shuffle(roles)

        for player, role in zip(game.players, roles):
            player.role = role

    async def advance_stage(self, room_id: str):
        async with self._locks[room_id]:
            game = self.get_game(room_id)
            if not game or game.stage == Stage.GAME_OVER:
                return
            
            if room_id in self._timers:
                self._timers[room_id].cancel()
                del self._timers[room_id]

            current_stage = game.stage
            next_stage = Stage.WAITING 
            timer = 0
            
            if current_stage == Stage.WAITING:
                next_stage, timer = Stage.ROLE_ASSIGN, 5
                self._assign_roles(game)
            elif current_stage == Stage.ROLE_ASSIGN:
                next_stage, timer = Stage.NIGHT_START, 5
            elif current_stage == Stage.NIGHT_START:
                game.day += 1
                game.night_actions = {}
                next_stage, timer = Stage.NIGHT_SKILLS, 30
            elif current_stage == Stage.NIGHT_SKILLS:
                next_stage, timer = Stage.NIGHT_RESOLVE, 5
            elif current_stage == Stage.NIGHT_RESOLVE:
                result = game_logic.process_night_actions(game)
                await connection_manager.broadcast(room_id, {"type": "NIGHT_RESULT", "payload": result.dict()})
                if game_logic.check_game_over(game):
                    next_stage = Stage.GAME_OVER
                else:
                    next_stage, timer = Stage.DAWN, 5
            elif current_stage == Stage.DAWN:
                game.speech_order = game_logic.determine_speech_order(game)
                next_stage, timer = Stage.SPEECH_ORDER, 5
            elif current_stage == Stage.SPEECH_ORDER:
                next_stage, timer = Stage.SPEECH, 30
            elif current_stage == Stage.SPEECH:
                game.day_votes = {}
                next_stage, timer = Stage.VOTE, 30
            elif current_stage == Stage.VOTE:
                next_stage, timer = Stage.VOTE_RESOLVE, 5
            elif current_stage == Stage.VOTE_RESOLVE:
                result = game_logic.process_day_votes(game)
                await connection_manager.broadcast(room_id, {"type": "VOTE_RESULT", "payload": result.dict()})
                if game_logic.check_game_over(game):
                    next_stage = Stage.GAME_OVER
                else:
                    next_stage, timer = Stage.NIGHT_START, 5

            game.stage = next_stage
            
            if next_stage == Stage.GAME_OVER:
                payload = GameOverPayload(winner=game.winner, roles={p.id: p.role for p in game.players})
                await connection_manager.broadcast(room_id, {"type": "GAME_OVER", "payload": payload.dict()})
            else:
                await self.broadcast_stage_change(room_id, timer)
                if timer > 0:
                    self._timers[room_id] = asyncio.create_task(self._stage_timer(room_id, next_stage, timer))

    async def _stage_timer(self, room_id: str, expected_stage: Stage, duration: int):
        await asyncio.sleep(duration)
        game = self.get_game(room_id)
        if game and game.stage == expected_stage:
            await self.advance_stage(room_id)

    async def broadcast_stage_change(self, room_id: str, timer: int):
        game = self.get_game(room_id)
        if not game: return
        
        game.timer = timer
        payload = StageChangePayload(stage=game.stage, timer=timer, players=game.players)
        await connection_manager.broadcast(room_id, {"type": "STAGE_CHANGE", "payload": payload.dict()})

    async def record_player_action(self, room_id: str, player_id: str, action: str, target: Optional[str]):
        async with self._locks[room_id]:
            game = self.get_game(room_id)
            if not game or game.stage != Stage.NIGHT_SKILLS: return

            player = next((p for p in game.players if p.id == player_id), None)
            if not player or not player.is_alive: return

            game.night_actions[player_id] = {"action": action, "target": target}
            
            if self._all_night_actions_received(game):
                await self.advance_stage(room_id)

    def _all_night_actions_received(self, game: GameState) -> bool:
        required_actors = {
            p.id for p in game.players if p.is_alive and p.role in [Role.WEREWOLF, Role.SEER, Role.WITCH, Role.GUARD]
        }
        wolves = {p.id for p in game.players if p.is_alive and p.role == Role.WEREWOLF}
        acted_wolves = wolves.intersection(game.night_actions.keys())
        
        other_actors = required_actors - wolves
        acted_others = other_actors.intersection(game.night_actions.keys())

        all_others_acted = len(acted_others) == len(other_actors)
        wolf_acted = len(acted_wolves) > 0 or not wolves

        return all_others_acted and wolf_acted

    async def record_player_vote(self, room_id: str, player_id: str, target_id: str):
        async with self._locks[room_id]:
            game = self.get_game(room_id)
            if not game or game.stage != Stage.VOTE: return
            
            voter = next((p for p in game.players if p.id == player_id), None)
            target = next((p for p in game.players if p.id == target_id), None)

            if voter and voter.is_alive and target and target.is_alive:
                game.day_votes[player_id] = target_id

            living_players_count = len([p for p in game.players if p.is_alive])
            if len(game.day_votes) == living_players_count:
                await self.advance_stage(room_id)

game_manager = GameManager()
