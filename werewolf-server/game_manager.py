from typing import Dict, Optional
from models import Game, GameConfig, Player
import uuid
from connections import connection_manager
import profile_manager
from game_logic import process_day_votes

class GameManager:
    """Manages all active game rooms."""
    _instance = None
    games: Dict[str, Game] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GameManager, cls).__new__(cls)
            cls.games = {}
        return cls._instance

    def create_game(self, host_id: str, game_config: GameConfig) -> Game:
        """Creates a new game room and returns it."""
        room_id = str(uuid.uuid4())[:6]
        game = Game(room_id=room_id, host_id=host_id, game_config=game_config)
        self.games[room_id] = game
        return game

    def get_game(self, room_id: str) -> Optional[Game]:
        """Retrieves a game by its room ID."""
        return self.games.get(room_id)

    async def game_loop(self, room_id: str):
        """The main game loop that advances the game state."""
        game = self.get_game(room_id)
        if not game or game.phase == "ended":
            return

        # Night phase transitions
        if game.phase == "werewolf_turn":
            # After werewolves vote, move to witch's turn
            game.phase = "witch_turn"
            await connection_manager.broadcast(room_id, {
                "type": "PHASE_CHANGE",
                "payload": {"phase": "witch_turn"}
            })
            # Notify the witch about the werewolf target
            witch = next((p for p in game.players if p.role == "witch"), None)
            if witch and witch.is_alive:
                await connection_manager.send_to_player(room_id, witch.id, {
                    "type": "WITCH_INFO",
                    "payload": {"werewolf_target": game.werewolf_kill_target}
                })
            # Wait for witch to act
            await asyncio.sleep(15) # 15 seconds for the witch to act
            await self.game_loop(room_id) # Continue the loop

        elif game.phase == "witch_turn":
            # After witch's turn, move to seer's turn (or day)
            game.phase = "seer_turn"
            await connection_manager.broadcast(room_id, {
                "type": "PHASE_CHANGE",
                "payload": {"phase": "seer_turn"}
            })
            # Wait for seer to act
            await asyncio.sleep(15) # 15 seconds for the seer to act
            await self.game_loop(room_id) # Continue the loop

        elif game.phase == "seer_turn":
            # After seer's turn, process night results and move to day
            self.process_night_results(game)
            game.phase = "day"
            game.day += 1
            await connection_manager.broadcast(room_id, {
                "type": "PHASE_CHANGE",
                "payload": {
                    "phase": "day", 
                    "day": game.day,
                    "deaths": game.nightly_deaths
                }
            })
            game.nightly_deaths = [] # Reset for next night
            game.werewolf_votes = {}
            game.werewolf_kill_target = None
            game.witch_used_potion_tonight = False
            # Wait for day discussion
            await asyncio.sleep(30) # 30 seconds for discussion
            await self.game_loop(room_id) # Continue the loop

        elif game.phase == "day":
            # After discussion, move to voting
            game.phase = "voting"
            await connection_manager.broadcast(room_id, {
                "type": "PHASE_CHANGE",
                "payload": {"phase": "voting"}
            })
            # Wait for voting
            await asyncio.sleep(20) # 20 seconds for voting
            await self.game_loop(room_id) # Continue the loop

        elif game.phase == "voting":
            # After voting, process results and move to night
            exiled_player_id = process_day_votes(game)
            if exiled_player_id:
                exiled_player = next((p for p in game.players if p.id == exiled_player_id), None)
                if exiled_player:
                    exiled_player.is_alive = False

            await connection_manager.broadcast(room_id, {
                "type": "VOTE_RESULT",
                "payload": {"exiled_player_id": exiled_player_id}
            })

            # Check for game over
            if self.check_game_over(game):
                game.phase = "ended"
                # Broadcast game over message
            else:
                game.phase = "werewolf_turn"
                await connection_manager.broadcast(room_id, {
                    "type": "PHASE_CHANGE",
                    "payload": {"phase": "werewolf_turn"}
                })
            game.day_votes = {}
            await self.game_loop(room_id) # Continue the loop

    def check_game_over(self, game: Game) -> bool:
        """Checks if the game is over and updates player stats."""
        living_players = [p for p in game.players if p.is_alive]
        werewolves = [p for p in living_players if p.role == "werewolf"]
        villagers = [p for p in living_players if p.role != "werewolf"]

        winner = None
        if not werewolves:
            winner = "good"
        elif len(werewolves) >= len(villagers):
            winner = "bad"

        if winner:
            self.update_player_stats(game, winner)
            return True

        return False

    def update_player_stats(self, game: Game, winner: str):
        """Updates the stats for all players in the game."""
        for player in game.players:
            profile = profile_manager.read_player_profile(player.profile_id)
            if not profile:
                continue

            profile['stats']['games_played'] += 1

            is_winner = (winner == "good" and player.role != "werewolf") or \
                        (winner == "bad" and player.role == "werewolf")

            if is_winner:
                profile['stats']['wins'] += 1
            else:
                profile['stats']['losses'] += 1

            if player.role == 'werewolf':
                profile['stats']['roles']['werewolf'] += 1
            elif player.role in ['seer', 'witch', 'hunter']:
                profile['stats']['roles']['god'] += 1
            else:
                profile['stats']['roles']['villager'] += 1
            
            profile_manager.write_player_profile(player.profile_id, profile)

    def process_night_results(self, game: Game):
        """Calculates the results of the night's actions."""
        if game.werewolf_kill_target and game.werewolf_kill_target != game.witch_save_target:
            game.nightly_deaths.append(game.werewolf_kill_target)

        # Update player statuses
        for player_id in game.nightly_deaths:
            player = next((p for p in game.players if p.id == player_id), None)
            if player:
                player.is_alive = False

game_manager = GameManager()
