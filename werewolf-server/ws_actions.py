from fastapi import WebSocket
from typing import Dict
from models import Game, Player, Role, WOLF_ROLES
import game_manager
from connections import connection_manager

async def handle_ws_action(websocket: WebSocket, room_id: str, player_id: str, data: Dict):
    """Handles WebSocket actions from clients."""
    action_type = data.get("type")
    if not action_type:
        return

    game = game_manager.game_manager.get_game(room_id)
    if not game:
        return

    # player_id from the URL is the temporary in-game Player ID
    player = next((p for p in game.players if p.id == player_id), None)
    
    if action_type == "START_GAME":
        # The game.host_id stores the PROFILE_ID of the host.
        # We need to find the host's temporary Player object to check if the start request
        # came from the correct connection (identified by the temporary player.id).
        host_player = next((p for p in game.players if p.profile_id == game.host_id), None)
        if host_player and host_player.id == player_id:
            await handle_start_game(game)
        return

    if not player:
        return

    if action_type == "TAKE_SEAT":
        await handle_take_seat(game, player, data.get("payload"))
    elif action_type == "WEREWOLF_VOTE":
        await handle_werewolf_vote(game, player, data.get("payload"))
    elif action_type == "WITCH_ACTION":
        await handle_witch_action(game, player, data.get("payload"))
    elif action_type == "SEER_CHECK":
        await handle_seer_check(game, player, data.get("payload"))
    elif action_type == "VOTE_PLAYER":
        await handle_day_vote(game, player, data.get("payload"))
    elif action_type == "GUARD_ACTION":
        await handle_guard_action(game, player, data.get("payload"))
    elif action_type == "RUN_FOR_SHERIFF":
        await handle_run_for_sheriff(game, player)
    elif action_type == "SHERIFF_VOTE":
        await handle_sheriff_vote(game, player, data.get("payload"))
    elif action_type == "PASS_TURN":
        await handle_pass_turn(game, player)


async def handle_run_for_sheriff(game: Game, player: Player):
    if game.phase == "sheriff_election" and player.is_alive and player.id not in game.sheriff_candidates:
        game.sheriff_candidates.append(player.id)
        await connection_manager.broadcast(game.room_id, {
            "type": "GAME_STATE_UPDATE",
            "payload": game.dict()
        })

async def handle_sheriff_vote(game: Game, player: Player, payload: Dict):
    if game.phase == "sheriff_vote" and player.is_alive:
        target_player_id = payload.get("target_player_id")
        if target_player_id in game.sheriff_candidates:
            game.sheriff_votes[player.id] = target_player_id
            # Maybe send a confirmation to the player?
            await connection_manager.broadcast(game.room_id, {
                "type": "GAME_STATE_UPDATE",
                "payload": game.dict()
            })

async def handle_pass_turn(game: Game, player: Player):
    if game.phase in ["day_discussion", "sheriff_speech"] and player.id == game.current_speaker_id:
        await game_manager.game_manager.advance_speaker(game)


async def handle_start_game(game: Game):
    """Handles the host's request to start the game."""
    if game.phase == "lobby":
        await game_manager.game_manager.start_game(game.room_id)

async def handle_take_seat(game: Game, player: Player, payload: Dict):
    """Handles a player taking a seat."""
    seat_number = payload.get("seat_number")
    if isinstance(seat_number, int):
        await game_manager.game_manager.take_seat(game.room_id, player.id, seat_number)

async def handle_day_vote(game: Game, player: Player, payload: Dict):
    """Handles a player voting to exile another player."""
    if game.phase != "voting" or not player.is_alive:
        return

    target_player_id = payload.get("target_player_id")
    if not target_player_id:
        return

    game.day_votes[player.id] = target_player_id

    # Broadcast the full state update
    await connection_manager.broadcast(game.room_id, {
        "type": "GAME_STATE_UPDATE",
        "payload": game.dict()
    })

    # Check if all living players have voted
    living_players = [p for p in game.players if p.is_alive]
    if len(game.day_votes) == len(living_players):
        # All votes are in, process the results
        await game_manager.game_manager.game_loop(game.room_id)

async def handle_seer_check(game: Game, player: Player, payload: Dict):
    """Handles the seer checking a player's identity."""
    if game.phase != "seer_turn" or player.role != Role.SEER or not player.is_alive:
        return

    target_player_id = payload.get("target_player_id")
    if not target_player_id:
        return

    target_player = next((p for p in game.players if p.id == target_player_id), None)
    if not target_player:
        return

    is_wolf = target_player.role in WOLF_ROLES
    result_text = "好人" if not is_wolf else "坏人"
    
    # Store the check result for logging or other server-side logic if needed
    game.seer_check_result = {
        "target_id": target_player_id,
        "target_name": target_player.name,
        "is_wolf": is_wolf
    }

    # Send a game event with the result only to the seer
    await connection_manager.send_to_player(game.room_id, player.id, {
        "type": "GAME_EVENT",
        "payload": {
            "message": f"查验结果: {target_player.name} 的身份是 {result_text}。"
        }
    })

    # Immediately continue the game loop after the seer acts
    # The phase will be advanced by the phase_timer or a CONFIRM action
    await game_manager.game_manager.advance_game_phase(game)

async def handle_witch_action(game: Game, player: Player, payload: Dict):
    """Handles the witch using a potion."""
    if game.phase != "witch_turn" or player.role != Role.WITCH or not player.is_alive or game.witch_used_potion_tonight:
        return

    action = payload.get("action") # "save" or "poison"
    target_player_id = payload.get("target_player_id")

    if action == "save" and game.witch_has_save:
        # Logic to save a player
        game.witch_has_save = False
        game.witch_used_potion_tonight = True
        game.witch_save_target = game.werewolf_kill_target

    elif action == "poison" and game.witch_has_poison and target_player_id:
        # Logic to poison a player
        game.witch_has_poison = False
        game.witch_used_potion_tonight = True
        game.nightly_deaths.append(target_player_id)

    # Immediately continue the game loop after the witch acts
    # The phase will be advanced by the phase_timer or a CONFIRM action
    await game_manager.game_manager.advance_game_phase(game)

async def handle_werewolf_vote(game: Game, player: Player, payload: Dict):
    """Handles a werewolf voting to kill a player."""
    if game.phase != "werewolf_turn" or player.role not in WOLF_ROLES or not player.is_alive:
        return

    target_player_id = payload.get("target_player_id")
    if not target_player_id:
        return

    game.werewolf_votes[player.id] = target_player_id

    # Broadcast the full state update to all players
    # This will show vote counts in real-time
    await connection_manager.broadcast(game.room_id, {
        "type": "GAME_STATE_UPDATE",
        "payload": game.dict()
    })

    # Check if all living werewolves have voted
    werewolves = [p for p in game.players if p.role in WOLF_ROLES and p.is_alive]
    if len(game.werewolf_votes) == len(werewolves):
        # All werewolves have voted, process the results
        await game_manager.game_manager.process_werewolf_votes(game)


async def handle_guard_action(game: Game, player: Player, payload: Dict):
    """Handles the guard protecting a player."""
    if game.phase != "guard_turn" or player.role != Role.GUARD or not player.is_alive:
        return

    target_player_id = payload.get("target_player_id")
    if not target_player_id:
        return
        
    # Guard cannot guard the same person two nights in a row
    if target_player_id == game.last_guarded_id:
        # Maybe send an error message back to the guard?
        print(f"Guard {player.name} tried to guard the same player twice.")
        return

    game.guard_target = target_player_id
    
    # Send confirmation to the guard
    await connection_manager.send_to_player(game.room_id, player.id, {
        "type": "ACTION_CONFIRMED",
        "payload": {"action": "guard", "target": target_player_id}
    })

    await game_manager.game_manager.advance_game_phase(game)
