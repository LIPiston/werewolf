from collections import Counter
from typing import Literal
from models import Game, WOLF_ROLES
from connections import connection_manager

# This is a forward declaration, to be replaced by the actual GameManager instance
game_manager = None

def initialize_game_manager(manager):
    global game_manager
    game_manager = manager

def process_day_votes(game: Game):
    """
    Processes the votes at the end of the day to determine who is exiled.
    Returns the ID of the exiled player, or None if there's a tie or no votes.
    """
    if not game.day_votes:
        return None

    vote_counts = Counter()
    for voter_id, target_id in game.day_votes.items():
        voter = next((p for p in game.players if p.id == voter_id), None)
        weight = 1.5 if voter and voter.is_sheriff else 1
        vote_counts[target_id] += weight

    if not vote_counts:
        return None

    max_votes = max(vote_counts.values())
    top_voted_players = [player_id for player_id, count in vote_counts.items() if count == max_votes]

    if len(top_voted_players) == 1:
        return top_voted_players[0]
    
    return None

async def process_werewolf_votes(game: Game) -> Literal['SUCCESS', 'TIE', 'NO_VOTES']:
    """
    Processes the werewolf votes and sets the kill target.
    Returns a status indicating the outcome.
    """
    if not game.werewolf_votes:
        game.werewolf_kill_target = None
        return 'NO_VOTES'

    votes = list(game.werewolf_votes.values())
    vote_counts = Counter(votes)
    
    max_votes = 0
    if vote_counts:
        max_votes = max(vote_counts.values())

    top_voted_players = [player_id for player_id, count in vote_counts.items() if count == max_votes]

    if len(top_voted_players) > 1:
        # Tie detected, reset votes. The manager will handle re-running the turn.
        print(f"--- Room {game.room_id}: Werewolf vote tied. ---")
        game.werewolf_votes = {}
        await connection_manager.broadcast(game.room_id, {
            "type": "GAME_STATE_UPDATE",
            "payload": game.dict()
        })
        werewolves = [p for p in game.players if p.role in WOLF_ROLES and p.is_alive]
        for werewolf in werewolves:
            await connection_manager.send_to_player(game.room_id, werewolf.id, {
                "type": "GAME_EVENT",
                "payload": {"message": "狼人投票平票，请重新投票！"}
            })
        return 'TIE'
    elif len(top_voted_players) == 1:
        # Clear winner
        target_id = top_voted_players[0]
        game.werewolf_kill_target = target_id
        print(f"--- Room {game.room_id}: Werewolves decided to kill {target_id} ---")
        return 'SUCCESS'
    else: # No votes were actually cast
        print(f"--- Room {game.room_id}: No werewolf target selected. ---")
        game.werewolf_kill_target = None
        return 'NO_VOTES'
