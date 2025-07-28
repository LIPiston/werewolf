'use client';

import React from 'react';

interface GamePlayer {
  id: string;
  profile_id: string;
  is_alive: boolean;
  name?: string; // Name might be fetched from a profile
}

interface GameState {
  phase: string;
  players: GamePlayer[];
  werewolf_kill_target?: string | null;
}

interface PlayerProfile {
  id: string;
  name: string;
}

interface ActionBarProps {
  gameState: GameState;
  myProfile: PlayerProfile;
  myRole: string | undefined;
  onAction: (action: string, payload: { target_player_id: string } | { action: string }) => void;
}

const ActionBar: React.FC<ActionBarProps> = ({ gameState, myProfile, myRole, onAction }) => {
  const me = gameState.players.find(p => p.profile_id === myProfile.id);

  if (!me || !me.is_alive) {
    return <div className="text-center text-red-500">你已经出局了</div>;
  }

  const renderPlayerButtons = (actionType: string) => {
    return gameState.players.map(player => {
      if (!player.is_alive || player.id === me.id) return null;
      return (
        <button 
          key={player.id}
          onClick={() => onAction(actionType, { target_player_id: player.id })}
          className="bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 rounded m-1"
        >
          {player.name || `Player ${player.id}`}
        </button>
      );
    });
  };

  switch (gameState.phase) {
    case 'werewolf_turn':
      if (myRole === 'werewolf') {
        return (
          <div>
            <h3 className="text-lg text-white">选择一个目标:</h3>
            {renderPlayerButtons('WEREWOLF_VOTE')}
          </div>
        );
      }
      return <div className="text-white">等待狼人行动...</div>;

    case 'witch_turn':
      if (myRole === 'witch') {
        return (
          <div>
            <h3 className="text-lg text-white">女巫行动:</h3>
            <p className="text-yellow-300 mb-2">狼人目标: {gameState.werewolf_kill_target || '无人'}</p>
            <button onClick={() => onAction('WITCH_ACTION', { action: 'save' })} className="bg-green-600 px-4 py-2 rounded mr-2">使用解药</button>
            {renderPlayerButtons('WITCH_ACTION')}
          </div>
        );
      }
      return <div className="text-white">等待女巫行动...</div>;

    case 'seer_turn':
        if (myRole === 'seer') {
            return (
                <div>
                    <h3 className="text-lg text-white">预言家查验:</h3>
                    {renderPlayerButtons('SEER_CHECK')}
                </div>
            );
        }
        return <div className="text-white">等待预言家行动...</div>;

    case 'voting':
      return (
        <div>
          <h3 className="text-lg text-white">投票放逐:</h3>
          {renderPlayerButtons('VOTE_PLAYER')}
        </div>
      );

    default:
      return <div className="text-white">等待下一阶段...</div>;
  }
};

export default ActionBar;
