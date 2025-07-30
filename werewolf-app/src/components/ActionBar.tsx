'use client';

import React from 'react';

// --- Enums and Types (matching backend) ---
enum Role {
    WEREWOLF = "狼人",
    VILLAGER = "平民",
    SEER = "预言家",
    WITCH = "女巫",
    HUNTER = "猎人",
    GUARD = "守卫",
    IDIOT = "白痴",
    WOLF_KING = "狼王",
    KNIGHT = "骑士",
    WHITE_WOLF_KING = "白狼王",
    WOLF_BEAUTY = "狼美人",
    SNOW_WOLF = "雪狼",
    GARGOYLE = "石像鬼",
    EVIL_KNIGHT = "恶灵骑士",
    HIDDEN_WOLF = "隐狼",
}

interface GamePlayer {
  id: string;
  profile_id: string;
  name: string;
  avatar_url: string | null;
  is_alive: boolean;
  role: Role | null;
  is_sheriff: boolean;
}

interface GameState {
  room_id: string;
  players: GamePlayer[];
  host_id: string;
  day: number;
  phase: "lobby" | "werewolf_turn" | "witch_turn" | "seer_turn" | "day" | "voting" | "ended";
  werewolf_kill_target?: string | null;
  nightly_deaths: string[];
}

interface WerewolfPanelProps {
  players: GamePlayer[];
}

interface WitchPanelProps {
  werewolf_target: string | null;
  has_save: boolean;
  has_poison: boolean;
  players: GamePlayer[];
}

interface SeerPanelProps {
  players: GamePlayer[];
}

interface GuardPanelProps {
  players: GamePlayer[];
  last_guarded_id: string | null;
}

interface ActionBarProps {
  gameState: GameState;
  myPlayer: GamePlayer;
  onAction: (action: string, payload?: object) => void;
  ws: WebSocket | null;
}

const ActionBar: React.FC<ActionBarProps> = ({ gameState, myPlayer, onAction, ws }) => {
  const [werewolfPanel, setWerewolfPanel] = React.useState<WerewolfPanelProps | null>(null);
  const [witchPanel, setWitchPanel] = React.useState<WitchPanelProps | null>(null);
  const [seerPanel, setSeerPanel] = React.useState<SeerPanelProps | null>(null);
  const [guardPanel, setGuardPanel] = React.useState<GuardPanelProps | null>(null);

  React.useEffect(() => {
    if (ws) {
      ws.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'WEREWOLF_PANEL') {
          setWerewolfPanel(message.payload);
        } else if (message.type === 'WITCH_PANEL') {
          setWitchPanel(message.payload);
        } else if (message.type === 'SEER_PANEL') {
          setSeerPanel(message.payload);
        } else if (message.type === 'GUARD_PANEL') {
          setGuardPanel(message.payload);
        } else if (message.type === 'PHASE_CHANGE') {
          // Reset panels on phase change
          setWerewolfPanel(null);
          setWitchPanel(null);
          setSeerPanel(null);
          setGuardPanel(null);
        }
      });
    }
  }, [ws]);


  if (!myPlayer.is_alive) {
    return <div className="text-center text-red-500">你已经出局了</div>;
  }

  const renderConfirmButton = () => (
    <div className="absolute bottom-4 right-4">
      <button
        onClick={() => onAction('CONFIRM_ACTION')}
        className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg"
      >
        确认
      </button>
    </div>
  );

  // Host action to start the game
  if (gameState.phase === 'lobby' && gameState.host_id === myPlayer.profile_id) {
    return (
        <button
          onClick={() => onAction('START_GAME')}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg text-xl"
        >
          开始游戏
        </button>
    );
  }

  if (werewolfPanel) {
    return (
      <div className="relative w-full">
        <h3 className="text-lg text-white">选择一个目标:</h3>
        {werewolfPanel.players.map(player => (
          <button
            key={player.id}
            onClick={() => onAction('WEREWOLF_VOTE', { target_player_id: player.id })}
            className="bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 rounded m-1"
          >
            {player.name}
          </button>
        ))}
        {renderConfirmButton()}
      </div>
    );
  }

  if (witchPanel) {
    return (
      <div className="relative w-full">
        <h3 className="text-lg text-white">女巫行动:</h3>
        <p className="text-yellow-300 mb-2">狼人目标: {witchPanel.werewolf_target || '无人'}</p>
        {witchPanel.has_save && (
          <button onClick={() => onAction('WITCH_ACTION', { action: 'save' })} className="bg-green-600 px-4 py-2 rounded mr-2">使用解药</button>
        )}
        {witchPanel.has_poison && witchPanel.players.map(player => (
          <button
            key={player.id}
            onClick={() => onAction('WITCH_ACTION', { action: 'poison', target_player_id: player.id })}
            className="bg-purple-800 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded m-1"
          >
            毒杀 {player.name}
          </button>
        ))}
        {renderConfirmButton()}
      </div>
    );
  }
  
  if (seerPanel) {
      return (
          <div className="relative w-full">
              <h3 className="text-lg text-white">预言家查验:</h3>
              {seerPanel.players.map(player => (
                  <button
                      key={player.id}
                      onClick={() => onAction('SEER_CHECK', { target_player_id: player.id })}
                      className="bg-blue-800 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-1"
                    >
                      查验 {player.name}
                  </button>
              ))}
              {renderConfirmButton()}
          </div>
      );
  }

  if (guardPanel) {
      return (
          <div className="relative w-full">
              <h3 className="text-lg text-white">守卫守护:</h3>
              {guardPanel.players.map(player => (
                  <button
                      key={player.id}
                      onClick={() => onAction('GUARD_ACTION', { target_player_id: player.id })}
                      disabled={player.id === guardPanel.last_guarded_id}
                      className={`font-bold py-2 px-4 rounded m-1 ${player.id === guardPanel.last_guarded_id ? 'bg-gray-600' : 'bg-yellow-700 hover:bg-yellow-600'} text-white`}
                  >
                      守护 {player.name}
                  </button>
              ))}
              {renderConfirmButton()}
          </div>
      );
  }
  
  if (gameState.phase === 'voting') {
    return (
      <div className="relative w-full">
        <h3 className="text-lg text-white">投票放逐:</h3>
        {gameState.players.map(player => {
            if (!player.is_alive) return null;
            return (
                <button
                  key={player.id}
                  onClick={() => onAction('VOTE_PLAYER', { target_player_id: player.id })}
                  className="bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 rounded m-1"
                >
                  {player.name}
                </button>
            );
        })}
      </div>
    );
  }

  return <div className="text-white">等待下一阶段... ({gameState.phase})</div>;
};

export default ActionBar;
