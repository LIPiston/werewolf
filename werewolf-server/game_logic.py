from collections import Counter
from typing import List, Optional, Dict
from models import GameState, Player, Role, NightResultPayload, VoteResultPayload

def process_night_actions(game: GameState) -> NightResultPayload:
    """
    Processes all recorded night actions and determines the outcome.
    - Resolves werewolf kill vs. guard protection vs. witch save.
    - Resolves witch poison.
    - Resolves seer check.
    """
    actions = game.night_actions
    dead_players = []
    saved_by_witch = None
    poisoned_by_witch = None
    seer_check_result = None

    # 1. Determine Werewolf Kill Target
    wolf_votes = [
        action['target']
        for actor_id, action in actions.items()
        if game.players[int(actor_id[1:])].role == Role.WEREWOLF and action.get('action') == 'KILL' and action.get('target')
    ]
    kill_target = Counter(wolf_votes).most_common(1)[0][0] if wolf_votes else None

    # 2. Guard's Protection
    guard_action = next((a for a in actions.values() if a.get('action') == 'GUARD'), None)
    guarded_player = guard_action['target'] if guard_action else None

    # 3. Witch's Actions
    witch_action = next((a for a in actions.values() if a.get('action') in ['SAVE', 'POISON']), None)
    
    # 4. Resolve Deaths
    # Death by werewolf
    if kill_target and kill_target != guarded_player:
        if witch_action and witch_action.get('action') == 'SAVE' and game.witch_has_save:
            saved_by_witch = kill_target
            game.witch_has_save = False
        else:
            dead_players.append(kill_target)

    # Death by poison
    if witch_action and witch_action.get('action') == 'POISON' and game.witch_has_poison:
        poisoned_by_witch = witch_action['target']
        if poisoned_by_witch not in dead_players:
            dead_players.append(poisoned_by_witch)
        game.witch_has_poison = False

    # 5. Seer's Check
    seer_action = next((a for a in actions.values() if a.get('action') == 'CHECK'), None)
    if seer_action and seer_action.get('target'):
        target_id = seer_action['target']
        target_player = next((p for p in game.players if p.id == target_id), None)
        if target_player:
            seer_check_result = {target_id: target_player.role}

    # 6. Update player statuses
    for player in game.players:
        if player.id in dead_players:
            player.is_alive = False

    return NightResultPayload(
        dead=dead_players,
        saved=saved_by_witch,
        poisoned=poisoned_by_witch,
        checked=seer_check_result
    )

def process_day_votes(game: GameState) -> VoteResultPayload:
    """
    Processes the day's votes to determine who is eliminated.
    """
    if not game.day_votes:
        return VoteResultPayload(eliminated=None, votes=game.day_votes)

    vote_counts = Counter(game.day_votes.values())
    
    # Handle ties - if the top two have the same number of votes, no one is eliminated.
    if len(vote_counts) > 1:
        top_two = vote_counts.most_common(2)
        if top_two[0][1] == top_two[1][1]:
            return VoteResultPayload(eliminated=None, votes=game.day_votes)

    # Determine eliminated player
    eliminated_player_id = vote_counts.most_common(1)[0][0] if vote_counts else None
    
    if eliminated_player_id:
        player = next((p for p in game.players if p.id == eliminated_player_id), None)
        if player:
            # Special case for Idiot
            if player.role == Role.IDIOT:
                # The idiot is revealed but not eliminated. They lose voting rights.
                # This logic can be handled in the game manager after receiving the result.
                pass 
            else:
                player.is_alive = False

    return VoteResultPayload(eliminated=eliminated_player_id, votes=game.day_votes)

def determine_speech_order(game: GameState) -> List[str]:
    """
    Determines the speaking order for the day.
    Starts from the player after the last one who died, or random if it's day 1.
    """
    living_players = sorted([p for p in game.players if p.is_alive], key=lambda p: p.seat)
    if not living_players:
        return []

    if game.day == 1:
        # On Day 1, speech order is typically random or based on sheriff election
        # For simplicity, we'll start from a random player
        start_index = random.randint(0, len(living_players) - 1)
    else:
        # Find the first dead player from the last night to determine speech order
        last_night_dead_seats = sorted([
            p.seat for p in game.players if not p.is_alive and p.id in game.speech_order
        ], reverse=True)

        if last_night_dead_seats:
            start_seat = (last_night_dead_seats[0] + 1) % 12
            # Find the first living player from that seat onwards
            start_player = next((p for p in living_players if p.seat >= start_seat), living_players[0])
            start_index = living_players.index(start_player)
        else: #平安夜
            start_index = random.randint(0, len(living_players) - 1)


    # Create a circular list of player IDs
    ordered_ids = [p.id for p in living_players]
    return ordered_ids[start_index:] + ordered_ids[:start_index]


def check_game_over(game: GameState) -> bool:
    """
    Checks if the game has reached a conclusion.
    Updates game.winner if it has.
    """
    living_players = [p for p in game.players if p.is_alive]
    good_roles = {Role.VILLAGER, Role.SEER, Role.WITCH, Role.HUNTER, Role.IDIOT}
    
    living_gods = [p for p in living_players if p.role in {Role.SEER, Role.WITCH, Role.HUNTER, Role.IDIOT}]
    living_villagers = [p for p in living_players if p.role == Role.VILLAGER]
    living_wolves = [p for p in living_players if p.role == Role.WEREWOLF]

    # Rule: Kill all gods
    if not living_gods:
        game.winner = "WOLF"
        return True

    # Rule: Kill all villagers
    if not living_villagers:
        game.winner = "WOLF"
        return True
        
    # Rule: Kill all wolves
    if not living_wolves:
        game.winner = "GOOD"
        return True

    return False
