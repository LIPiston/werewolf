from fastapi import WebSocket
from typing import Dict
from models import Game, Player, Role
from game_manager import game_manager
from connections import connection_manager

async def handle_ws_action(websocket: WebSocket, room_id: str, player_id: str, data: Dict):
    """Handles WebSocket actions from clients."""
    action_type = data.get("type")
    if not action_type:
        return

    game = game_manager.get_game(room_id)
    if not game:
        return

    # player_id from the URL is the PROFILE_ID
    player = next((p for p in game.players if p.profile_id == player_id), None)
    
    # Allow START_GAME even if player is just the host
    if action_type == "START_GAME":
        if game.host_id == player_id:
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
    elif action_type == "CONFIRM_ACTION":
        await game_manager.advance_game_phase(game)

async def handle_start_game(game: Game):
    """Handles the host's request to start the game."""
    if game.phase == "lobby":
        await game_manager.start_game(game.room_id)

async def handle_take_seat(game: Game, player: Player, payload: Dict):
    """Handles a player taking a seat."""
    seat_number = payload.get("seat_number")
    if isinstance(seat_number, int):
        await game_manager.take_seat(game.room_id, player.id, seat_number)

async def handle_day_vote(game: Game, player: Player, payload: Dict):
    """Handles a player voting to exile another player."""
    if game.phase != "voting" or not player.is_alive:
        return

    target_player_id = payload.get("target_player_id")
    if not target_player_id:
        return

    game.day_votes[player.id] = target_player_id

    # Broadcast the vote update to all players
    await connection_manager.broadcast(game.room_id, {
        "type": "VOTE_UPDATE",
        "payload": {"votes": game.day_votes}
    })

    # Check if all living players have voted
    living_players = [p for p in game.players if p.is_alive]
    if len(game.day_votes) == len(living_players):
        # All votes are in, process the results
        await game_manager.game_loop(game.room_id)

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

    result = "good" if target_player.role != Role.WEREWOLF else "bad"
    game.seer_check_result = {target_player_id: result}

    # Send the result only to the seer
    await connection_manager.send_to_player(game.room_id, player.id, {
        "type": "SEER_RESULT",
        "payload": game.seer_check_result
    })

    # Immediately continue the game loop after the seer acts
    await game_manager.game_loop(game.room_id)

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
    await game_manager.game_loop(game.room_id)

async def handle_werewolf_vote(game: Game, player: Player, payload: Dict):
    """Handles a werewolf voting to kill a player."""
    if game.phase != "werewolf_turn" or player.role != Role.WEREWOLF or not player.is_alive:
        return

    target_player_id = payload.get("target_player_id")
    if not target_player_id:
        return

    game.werewolf_votes[player.id] = target_player_id

    # Notify other werewolves of the vote
    await connection_manager.broadcast(game.room_id, {
        "type": "WEREWOLF_VOTE_UPDATE",
        "payload": {"votes": game.werewolf_votes}
    })

    # Check if all werewolves have voted
    werewolves = [p for p in game.players if p.role == Role.WEREWOLF and p.is_alive]
    if len(game.werewolf_votes) == len(werewolves):
        # All werewolves have voted, advance to the next phase
        await game_manager.advance_game_phase(game)
