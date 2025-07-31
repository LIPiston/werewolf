import asyncio
import random
from typing import Dict, Optional
from models import Game, GameConfig, Player, Role, GAME_TEMPLATES, WOLF_ROLES
import importlib
import models # Import the module itself
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
            # Force reload the models module to ensure latest Pydantic schema is used
            importlib.reload(models)
        return cls._instance

    def __init__(self):
        self.PHASE_HANDLERS = {
            "werewolf_turn": self.handle_werewolf_turn,
            "witch_turn": self.handle_witch_turn,
            "seer_turn": self.handle_seer_turn,
            "guard_turn": self.handle_guard_turn,
            "sheriff_election": self.handle_sheriff_election,
            "day_discussion": self.handle_day_discussion,
            "voting": self.handle_voting_phase,
            "vote_result": self.handle_vote_result_phase,
        }

    def create_game(self, host_id: str, game_config: GameConfig) -> Game:
        """Creates a new game room and returns it."""
        room_id = str(uuid.uuid4())[:6]
        game = Game(room_id=room_id, host_id=host_id, game_config=game_config)
        self.games[room_id] = game
        return game

    def get_game(self, room_id: str) -> Optional[Game]:
        """Retrieves a game by its room ID."""
        return self.games.get(room_id)

    def get_all_games(self) -> Dict[str, Game]:
        """Returns all active games."""
        return self.games

    async def take_seat(self, room_id: str, player_id: str, seat_number: int):
        """Allows a player to take a seat."""
        game = self.get_game(room_id)
        if not game or game.phase != "lobby":
            return

        player = next((p for p in game.players if p.id == player_id), None)
        if not player:
            return

        # Check if seat is already taken
        if any(p.seat == seat_number for p in game.players):
            # Handle seat taken error (e.g., send a message back to the player)
            return

        player.seat = seat_number

        await connection_manager.broadcast(room_id, {
            "type": "GAME_STATE_UPDATE",
            "payload": game.dict()
        })

    async def start_game(self, room_id: str):
        """Assigns roles and starts the game."""
        game = self.get_game(room_id)
        if not game or game.phase != "lobby":
            return

        template = next((t for t in GAME_TEMPLATES if t.name == game.game_config.template_name), None)
        if not template:
            # Handle template not found
            print(f"Error: Game template '{game.game_config.template_name}' not found.")
            return

        if len(game.players) not in template.player_counts:
            # Handle incorrect player count
            print(f"Error: Player count {len(game.players)} not supported for template '{template.name}'.")
            return

        # --- Auto-seat unseated players ---
        seated_players = {p.seat for p in game.players if p.seat is not None}
        unseated_players = [p for p in game.players if p.seat is None]
        
        available_seats = [i for i in range(len(game.players)) if i not in seated_players]
        random.shuffle(available_seats)

        for player in unseated_players:
            if not available_seats:
                # This should not happen if player count is correct
                print(f"Error: Not enough seats for all players.")
                return
            player.seat = available_seats.pop(0)
        
        # Sort players by seat number before assigning roles
        game.players.sort(key=lambda p: p.seat)
        
        # --- Role Assignment ---
        roles = []
        for role, count in template.roles.items():
            roles.extend([role] * count)

        random.shuffle(roles)

        for player, role in zip(game.players, roles):
            player.role = role
            print(f"Player {player.name} ({player.id}) is assigned role {role.value}") # 添加日志

        game.phase = "werewolf_turn"
        game.last_guarded_id = None # Initialize last_guarded_id at game start

        # Broadcast game start and individual roles
        await connection_manager.broadcast(room_id, {
            "type": "GAME_START",
            "payload": game.dict(exclude={'game_config', 'host_id'})
        })

        for p in game.players:
            await connection_manager.send_to_player(room_id, p.id, {
                "type": "ROLE_ASSIGNMENT",
                "payload": {"role": p.role.value if p.role else "No Role"}
            })

        # --- Start the game by kicking off the main game loop ---
        print(f"--- Room {room_id}: Kicking off game loop ---")
        await self.game_loop(room_id)


    async def handle_werewolf_turn(self, game: Game):
        """Handles the werewolf turn."""
        print(f"--- Room {game.room_id}: Night {game.day} - Werewolf Turn ---")
        await self.broadcast_phase(game, "werewolf_turn", 30)
        
        # Use WOLF_ROLES to correctly identify all wolf-type players
        werewolves = [p for p in game.players if p.role in WOLF_ROLES and p.is_alive]
        
        if not werewolves:
            print(f"No living werewolves in Room {game.room_id}. Skipping werewolf turn actions.")
            return
            
        # Prepare the list of potential targets (all living players)
        living_players = [p.dict() for p in game.players if p.is_alive]
        
        # Send the panel to all werewolves
        for werewolf in werewolves:
            print(f"Sending WEREWOLF_PANEL to {werewolf.name} ({werewolf.id}), role: {werewolf.role.value}")
            await connection_manager.send_to_player(game.room_id, werewolf.id, {
                "type": "WEREWOLF_PANEL",
                "payload": {"players": living_players}
            })

    async def handle_witch_turn(self, game: Game):
        """Handles the witch's turn."""
        print(f"--- Room {game.room_id}: Night {game.day} - Witch Turn ---")
        await self.broadcast_phase(game, "witch_turn", 30)
        witch = next((p for p in game.players if p.role == Role.WITCH and p.is_alive), None)
        if witch:
            print(f"Sending WITCH_PANEL to {witch.name} ({witch.id}). Werewolf target: {game.werewolf_kill_target}")
            await connection_manager.send_to_player(game.room_id, witch.id, {
                "type": "WITCH_PANEL",
                "payload": {
                    "werewolf_target": game.werewolf_kill_target,
                    "has_save": game.witch_has_save,
                    "has_poison": game.witch_has_poison,
                    "players": [p.dict() for p in game.players if p.is_alive and p.id != witch.id]
                }
            })
        else:
            print(f"No living witch in Room {game.room_id}. Skipping witch turn.")

    async def handle_seer_turn(self, game: Game):
        """Handles the seer's turn."""
        print(f"--- Room {game.room_id}: Night {game.day} - Seer Turn ---")
        await self.broadcast_phase(game, "seer_turn", 30)
        seer = next((p for p in game.players if p.role == Role.SEER and p.is_alive), None)
        if seer:
            print(f"Sending SEER_PANEL to {seer.name} ({seer.id})")
            await connection_manager.send_to_player(game.room_id, seer.id, {
                "type": "SEER_PANEL",
                "payload": {"players": [p.dict() for p in game.players if p.is_alive and p.id != seer.id]}
            })
        else:
            print(f"No living seer in Room {game.room_id}. Skipping seer turn.")

    async def handle_guard_turn(self, game: Game):
        """Handles the guard's turn."""
        print(f"--- Room {game.room_id}: Night {game.day} - Guard Turn ---")
        await self.broadcast_phase(game, "guard_turn", 30)
        guard = next((p for p in game.players if p.role == Role.GUARD and p.is_alive), None)
        if guard:
            print(f"Sending GUARD_PANEL to {guard.name} ({guard.id}). Last guarded: {game.last_guarded_id}")
            await connection_manager.send_to_player(game.room_id, guard.id, {
                "type": "GUARD_PANEL",
                "payload": {
                    "players": [p.dict() for p in game.players if p.is_alive],
                    "last_guarded_id": game.last_guarded_id
                }
            })
        else:
            print(f"No living guard in Room {game.room_id}. Skipping guard turn.")

    async def handle_day_phase(self, game: Game):
        """Handles the day phase."""
        self.process_night_results(game)
        game.day += 1
        await connection_manager.broadcast(game.room_id, {
            "type": "PHASE_CHANGE",
            "payload": {
                "phase": "day",
                "day": game.day,
                "deaths": game.nightly_deaths
            }
        })
        game.nightly_deaths = []
        game.werewolf_votes = {}
        game.werewolf_kill_target = None
        game.witch_used_potion_tonight = False
        await self.broadcast_phase(game, "day", 30)
        
    async def handle_voting_phase(self, game: Game):
        """Handles the voting phase."""
        await self.broadcast_phase(game, "voting", 30)

    async def handle_vote_result_phase(self, game: Game):
        exiled_player_id = process_day_votes(game)
        if exiled_player_id:
            exiled_player = next((p for p in game.players if p.id == exiled_player_id), None)
            if exiled_player:
                exiled_player.is_alive = False

        await connection_manager.broadcast(game.room_id, {
            "type": "VOTE_RESULT",
            "payload": {"exiled_player_id": exiled_player_id}
        })
        game.day_votes = {}
        await self.advance_game_phase(game)


    async def broadcast_phase(self, game: Game, phase: str, duration: int):
        """Broadcasts the phase change and starts a timer."""
        game.phase = phase
        await connection_manager.broadcast(game.room_id, {
            "type": "PHASE_CHANGE",
            "payload": {"phase": phase, "duration": duration}
        })
        asyncio.create_task(self.phase_timer(game.room_id, phase, duration))

    async def phase_timer(self, room_id: str, expected_phase: str, duration: int):
        """Timer for a game phase. Advances the game if the phase hasn't changed."""
        await asyncio.sleep(duration)
        game = self.get_game(room_id)
        if game and game.phase == expected_phase:
            await self.advance_game_phase(game)

    async def process_werewolf_votes(self, game: Game):
        """Processes the votes from the werewolves to determine the kill target."""
        if not game.werewolf_votes:
            print(f"No werewolf votes in Room {game.room_id}. Advancing phase.")
            await self.advance_game_phase(game)
            return

        # Count votes
        from collections import Counter
        vote_counts = Counter(game.werewolf_votes.values())
        
        # Find the player with the most votes
        # In case of a tie, the first one encountered wins.
        # A more complex rule could be implemented here if needed.
        most_voted_player_id = vote_counts.most_common(1)[0][0]
        
        game.werewolf_kill_target = most_voted_player_id
        print(f"Room {game.room_id}: Werewolves decided to kill Player {most_voted_player_id}")

        await self.advance_game_phase(game)

    async def advance_game_phase(self, game: Game):
        """Advances the game to the next phase."""
        if self.check_game_over(game):
            game.phase = "ended"
            await connection_manager.broadcast(game.room_id, {"type": "GAME_OVER", "payload": {"winner": game.winner}})
            return

        current_phase_index = self.PHASE_ORDER.index(game.phase)
        next_phase = self.PHASE_ORDER[(current_phase_index + 1) % len(self.PHASE_ORDER)]
        
        # Skip turns for dead or non-existent roles
        while True:
            role_for_phase = self.PHASE_TO_ROLE.get(next_phase)
            
            # If the phase is for werewolves, check against the WOLF_ROLES set
            if next_phase == "werewolf_turn":
                if any(p.role in WOLF_ROLES and p.is_alive for p in game.players):
                    break
            # For other roles, check if any player has that specific role
            elif role_for_phase and any(p.role == role_for_phase and p.is_alive for p in game.players):
                break
            # If the phase has no specific role (e.g., voting), or if it's a werewolf turn with no wolves, proceed
            elif not role_for_phase:
                 break

            print(f"Skipping phase {next_phase} as no eligible players are alive.")
            current_phase_index = self.PHASE_ORDER.index(next_phase)
            next_phase = self.PHASE_ORDER[(current_phase_index + 1) % len(self.PHASE_ORDER)]
            
        game.phase = next_phase
        await self.game_loop(game.room_id)

    PHASE_ORDER = [
        "werewolf_turn", "witch_turn", "seer_turn", "guard_turn",
        "sheriff_election", "day_discussion", "voting", "vote_result"
    ]
    
    PHASE_TO_ROLE = {
        "werewolf_turn": Role.WEREWOLF,
        "witch_turn": Role.WITCH,
        "seer_turn": Role.SEER,
        "guard_turn": Role.GUARD,
    }


    async def handle_sheriff_election(self, game: Game):
        print(f"--- Room {game.room_id}: Day {game.day} - Sheriff Election ---")
        await self.broadcast_phase(game, "sheriff_election", 45) # 45 seconds for election process
        # This phase will involve player actions (declare candidacy, vote)
        # For now, just a placeholder, actual logic to be implemented on action
        
    async def handle_day_discussion(self, game: Game):
        print(f"--- Room {game.room_id}: Day {game.day} - Day Discussion ---")
        # Announce nightly deaths first
        if game.nightly_deaths:
            deaths_names = [p.name for p in game.players if p.id in game.nightly_deaths]
            await connection_manager.broadcast(game.room_id, {
                "type": "NIGHT_DEATHS",
                "payload": {"deaths": deaths_names}
            })
            # Handle last words (遗言) - this would be a client-side prompt
        else:
            await connection_manager.broadcast(game.room_id, {
                "type": "NIGHT_DEATHS",
                "payload": {"deaths": []}
            })
        game.nightly_deaths = [] # Reset for next night
        game.werewolf_votes = {}
        game.werewolf_kill_target = None
        game.witch_used_potion_tonight = False
        
        await self.broadcast_phase(game, "day_discussion", 45 * len([p for p in game.players if p.is_alive])) # 45 seconds per living player for discussion

    async def game_loop(self, room_id: str):
        """The main game loop that advances the game state."""
        game = self.get_game(room_id)
        if not game or game.phase == "ended":
            return

        print(f"--- Room {game.room_id}: Day {game.day} - Entering phase {game.phase} ---") # 添加日志
        handler = self.PHASE_HANDLERS.get(game.phase)
        if handler:
            await handler(game)
        else:
            print(f"Warning: No handler found for phase {game.phase}")

    def check_game_over(self, game: Game) -> bool:
        """Checks if the game is over and updates player stats."""
        living_players = [p for p in game.players if p.is_alive]
        werewolves = [p for p in living_players if p.role == Role.WEREWOLF]
        villagers = [p for p in living_players if p.role != Role.WEREWOLF]

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

            is_winner = (winner == "good" and player.role != Role.WEREWOLF) or \
                        (winner == "bad" and player.role == Role.WEREWOLF)

            if is_winner:
                profile['stats']['wins'] += 1
            else:
                profile['stats']['losses'] += 1

            if player.role == Role.WEREWOLF:
                profile['stats']['roles']['werewolf'] += 1
            elif player.role in [Role.SEER, Role.WITCH, Role.HUNTER, Role.GUARD]:
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
