import asyncio
from collections import Counter
from models import Game, Role, WOLF_ROLES
from connections import connection_manager

# This is a forward declaration, to be replaced by the actual GameManager instance
game_manager = None

def initialize_game_manager(manager):
    global game_manager
    game_manager = manager

async def handle_werewolf_turn(game: Game):
    """Handles the werewolf turn."""
    print(f"--- Room {game.room_id}: Night {game.day} - Werewolf Turn ---")
    await game_manager.broadcast_phase(game, "werewolf_turn", 45)
    
    werewolves = [p for p in game.players if p.role in WOLF_ROLES and p.is_alive]
    
    if not werewolves:
        print(f"No living werewolves in Room {game.room_id}. Skipping werewolf turn actions.")
        return
            
    living_players = [p.dict() for p in game.players if p.is_alive]
    werewolf_info = [{"name": w.name, "id": w.id, "seat": w.seat} for w in werewolves]
    
    for werewolf in werewolves:
        print(f"Sending WEREWOLF_PANEL to {werewolf.name} ({werewolf.id}), role: {werewolf.role.value}")
        teammates = [w_info for w_info in werewolf_info if w_info['id'] != werewolf.id]
        await connection_manager.send_to_player(game.room_id, werewolf.id, {
            "type": "WEREWOLF_PANEL",
            "payload": {
                "players": living_players,
                "teammates": teammates
            }
        })

async def handle_witch_turn(game: Game):
    """Handles the witch's turn."""
    print(f"--- Room {game.room_id}: Night {game.day} - Witch Turn ---")
    await game_manager.broadcast_phase(game, "witch_turn", 45)
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

async def handle_seer_turn(game: Game):
    """Handles the seer's turn."""
    print(f"--- Room {game.room_id}: Night {game.day} - Seer Turn ---")
    await game_manager.broadcast_phase(game, "seer_turn", 45)
    seer = next((p for p in game.players if p.role == Role.SEER and p.is_alive), None)
    if seer:
        print(f"Sending SEER_PANEL to {seer.name} ({seer.id})")
        await connection_manager.send_to_player(game.room_id, seer.id, {
            "type": "SEER_PANEL",
            "payload": {"players": [p.dict() for p in game.players if p.is_alive and p.id != seer.id]}
        })
    else:
        print(f"No living seer in Room {game.room_id}. Skipping seer turn.")

async def handle_guard_turn(game: Game):
    """Handles the guard's turn."""
    print(f"--- Room {game.room_id}: Night {game.day} - Guard Turn ---")
    await game_manager.broadcast_phase(game, "guard_turn", 45)
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

async def handle_night_results(game: Game):
    """Processes all night actions, announces deaths, and resets for the day."""
    print(f"--- Room {game.room_id}: Night {game.day} - Processing Results ---")
    deaths = []
    
    kill_target_id = game.werewolf_kill_target
    was_saved_by_guard = (kill_target_id is not None) and (kill_target_id == game.guard_target)
    was_saved_by_witch = (kill_target_id is not None) and (kill_target_id == game.witch_save_target)

    if kill_target_id and not was_saved_by_guard and not was_saved_by_witch:
        deaths.append(kill_target_id)
        
    if game.witch_poison_target and game.witch_poison_target not in deaths:
        deaths.append(game.witch_poison_target)

    game.nightly_deaths = deaths

    death_names = []
    for player_id in deaths:
        player = next((p for p in game.players if p.id == player_id), None)
        if player:
            player.is_alive = False
            death_names.append(player.name)

    await connection_manager.broadcast(game.room_id, {
        "type": "GAME_STATE_UPDATE",
        "payload": game.dict()
    })

    game.day += 1
    game.werewolf_votes = {}
    game.werewolf_kill_target = None
    game.witch_used_potion_tonight = False
    game.witch_save_target = None
    game.witch_poison_target = None
    game.seer_check_result = None
    game.last_guarded_id = game.guard_target
    game.guard_target = None
    
    await game_manager.advance_game_phase(game)
        
async def handle_voting_phase(game: Game):
    """Handles the voting phase."""
    await game_manager.broadcast_phase(game, "voting", 45)

async def handle_vote_result_phase(game: Game):
    vote_counts = Counter()
    for voter_id, target_id in game.day_votes.items():
        voter = next((p for p in game.players if p.id == voter_id), None)
        weight = 1.5 if voter and voter.is_sheriff else 1
        vote_counts[target_id] += weight
    
    exiled_player_id = None
    if vote_counts:
        max_votes = max(vote_counts.values())
        top_voted = [pid for pid, count in vote_counts.items() if count == max_votes]
        if len(top_voted) == 1:
            exiled_player_id = top_voted[0]

    if exiled_player_id:
        exiled_player = next((p for p in game.players if p.id == exiled_player_id), None)
        if exiled_player:
            exiled_player.is_alive = False
    
    await connection_manager.broadcast(game.room_id, {
        "type": "GAME_STATE_UPDATE",
        "payload": game.dict()
    })
    game.day_votes = {}
    await game_manager.advance_game_phase(game)

async def handle_sheriff_election(game: Game):
    """Handles the sheriff election phase where players can volunteer."""
    print(f"--- Room {game.room_id}: Sheriff Election ---")
    game.sheriff_candidates = []
    await game_manager.broadcast_phase(game, "sheriff_election", 15)

async def handle_sheriff_speech(game: Game):
    """Handles the speech phase for sheriff candidates."""
    print(f"--- Room {game.room_id}: Sheriff Speech ---")
    if not game.sheriff_candidates:
        await game_manager.advance_game_phase(game, skip_to="day_discussion")
        return

    game.current_speaker_id = game.sheriff_candidates[0]
    await game_manager.broadcast_phase(game, "sheriff_speech", 45)

async def handle_sheriff_vote(game: Game):
    """Handles the voting for the sheriff."""
    print(f"--- Room {game.room_id}: Sheriff Vote ---")
    game.sheriff_votes = {}
    await game_manager.broadcast_phase(game, "sheriff_vote", 45)

async def handle_sheriff_result(game: Game):
    """Processes sheriff votes and announces the winner."""
    print(f"--- Room {game.room_id}: Sheriff Vote Result ---")
    if not game.sheriff_votes:
         await game_manager.advance_game_phase(game)
         return

    vote_counts = Counter(game.sheriff_votes.values())
    max_votes = 0
    if vote_counts:
        max_votes = max(vote_counts.values())
    
    top_voted = [pid for pid, count in vote_counts.items() if count == max_votes]

    if len(top_voted) == 1:
        sheriff_id = top_voted[0]
        sheriff_player = next((p for p in game.players if p.id == sheriff_id), None)
        if sheriff_player:
            sheriff_player.is_sheriff = True
            await connection_manager.broadcast(game.room_id, {
                "type": "GAME_EVENT",
                "payload": {"message": f"{sheriff_player.name} 当选警长！"}
            })
    else:
         await connection_manager.broadcast(game.room_id, {
            "type": "GAME_EVENT",
            "payload": {"message": "警长投票平票，无人当选。"}
        })

    await game_manager.advance_game_phase(game)

async def handle_day_discussion(game: Game):
    """Handles the day discussion phase."""
    print(f"--- Room {game.room_id}: Day Discussion ---")
    living_players = [p for p in sorted(game.players, key=lambda p: p.seat) if p.is_alive]
    if not living_players:
        await game_manager.advance_game_phase(game)
        return
    
    game.current_speaker_id = living_players[0].id
    await game_manager.broadcast_phase(game, "day_discussion", 45)