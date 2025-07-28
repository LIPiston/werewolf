from fastapi import WebSocket
from typing import Dict
from models import Game, Player
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

    player = next((p for p in game.players if p.id == player_id), None)
    if not player:
        return

    if action_type == "WEREWOLF_VOTE":
        await handle_werewolf_vote(game, player, data.get("payload"))
    elif action_type == "WITCH_ACTION":
        await handle_witch_action(game, player, data.get("payload"))
    elif action_type == "SEER_CHECK":
        await handle_seer_check(game, player, data.get("payload"))
    elif action_type == "VOTE_PLAYER":
        await handle_day_vote(game, player, data.get("payload"))

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
    if game.phase != "seer_turn" or player.role != "seer" or not player.is_alive:
        return

    target_player_id = payload.get("target_player_id")
    if not target_player_id:
        return

    target_player = next((p for p in game.players if p.id == target_player_id), None)
    if not target_player:
        return

    result = "good" if target_player.role != "werewolf" else "bad"
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
    if game.phase != "witch_turn" or player.role != "witch" or not player.is_alive or game.witch_used_potion_tonight:
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
    if game.phase != "night" or player.role != "werewolf" or not player.is_alive:
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
    werewolves = [p for p in game.players if p.role == "werewolf" and p.is_alive]
    if len(game.werewolf_votes) == len(werewolves):
        # process_werewolf_votes(game)
        # Potentially trigger the next phase of the night (e.g., witch's turn)
        # For now, we'll just log it
        print(f"Werewolves have decided to kill: {game.werewolf_kill_target}")
