from typing import Dict, List, Optional
from models import Game

def process_day_votes(game: Game) -> Optional[str]:
    """Processes the day votes and returns the exiled player's ID."""
    if not game.day_votes:
        return None

    # Count votes
    vote_counts = {}
    for target_id in game.day_votes.values():
        vote_counts[target_id] = vote_counts.get(target_id, 0) + 1

    # Determine the target
    max_votes = 0
    targets = []
    for target_id, count in vote_counts.items():
        if count > max_votes:
            max_votes = count
            targets = [target_id]
        elif count == max_votes:
            targets.append(target_id)

    # If there is a tie, no one is exiled
    if len(targets) == 1:
        return targets[0]
    else:
        return None # Tie, no one is exiled
