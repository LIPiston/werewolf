'use client';

import React, { useState } from 'react';

// --- Enums and Types matching the backend ---
enum Stage {
    WAITING = "WAITING",
    ROLE_ASSIGN = "ROLE_ASSIGN",
    NIGHT_START = "NIGHT_START",
    NIGHT_SKILLS = "NIGHT_SKILLS",
    NIGHT_RESOLVE = "NIGHT_RESOLVE",
    DAWN = "DAWN",
    SPEECH_ORDER = "SPEECH_ORDER",
    SPEECH = "SPEECH",
    VOTE = "VOTE",
    VOTE_RESOLVE = "VOTE_RESOLVE",
    GAME_OVER = "GAME_OVER",
}

enum Role {
    VILLAGER = "平民",
    WEREWOLF = "狼人",
    SEER = "预言家",
    WITCH = "女巫",
    HUNTER = "猎人",
    IDIOT = "白痴",
    GUARD = "守卫",
    KNIGHT = "骑士",
    WOLF_KING = "狼王",
    WHITE_WOLF_KING = "白狼王",
    WOLF_BEAUTY = "狼美人",
    SNOW_WOLF = "雪狼",
    GARGOYLE = "石像鬼",
    EVIL_KNIGHT = "恶灵骑士",
    HIDDEN_WOLF = "隐狼",
}

interface Player {
    id: string;
    name: string;
    avatar_url: string | null;
    is_alive: boolean;
    role: Role | null;
    is_host: boolean;
    is_ready: boolean;
    seat: number | null;
}

interface GameConfig {
  template_name: string;
  is_private: boolean;
  allow_spectators: boolean;
}

interface GameState {
    room_id: string;
    players: Player[];
    stage: Stage;
    timer: number;
    day: number;
    host_id: string;
    game_config: GameConfig;
    speech_order: string[];
    winner: 'GOOD' | 'WOLF' | null;
}

interface ActionBarProps {
  gameState: GameState;
  myPlayer: Player;
  onAction: (type: string, payload?: object) => void;
}

const ActionButton = ({ onClick, children, className, disabled }: { onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 text-sm font-medium text-white capitalize transition-colors duration-200 transform rounded-md focus:outline-none focus:ring focus:ring-opacity-80 ${className} ${disabled ? 'bg-gray-600 cursor-not-allowed' : 'hover:bg-opacity-80'}`}
  >
    {children}
  </button>
);

const ActionPanel = ({ title, children }: { title: string; children: React.ReactNode; }) => (
    <div className="w-full text-center">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className="flex flex-wrap items-center justify-center gap-2">
            {children}
        </div>
    </div>
);


const ActionBar: React.FC<ActionBarProps> = ({ gameState, myPlayer, onAction }) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  if (!myPlayer.is_alive) {
    return <div className="text-center text-xl font-semibold text-red-500">你已经出局了</div>;
  }

  const handleConfirm = (action: string, target?: string | null) => {
    onAction("ACTION", { action, target: target || selectedTarget });
    setSelectedTarget(null);
  };
  
  const renderWaitingStage = () => {
      return (
          <ActionButton
              onClick={() => onAction("READY", { ready: !myPlayer.is_ready })}
              className={myPlayer.is_ready ? "bg-red-600" : "bg-green-600"}
            >
              {myPlayer.is_ready ? '取消准备' : '准备'}
            </ActionButton>
      )
  }

  const renderNightSkillsStage = () => {
    const livingPlayers = gameState.players.filter(p => p.is_alive && p.id !== myPlayer.id);
    const livingPlayersIncludingSelf = gameState.players.filter(p => p.is_alive);

    switch (myPlayer.role) {
      case Role.WEREWOLF:
      case Role.WOLF_KING:
      case Role.WHITE_WOLF_KING:
      case Role.WOLF_BEAUTY:
      case Role.SNOW_WOLF:
      case Role.HIDDEN_WOLF:
        return (
          <ActionPanel title="狼人请选择击杀目标">
            {livingPlayers.map(player => (
              <ActionButton key={player.id} onClick={() => setSelectedTarget(player.id)} className={selectedTarget === player.id ? "bg-red-500 ring-2 ring-white" : "bg-red-800"}>
                {player.name} ({player.seat}号)
              </ActionButton>
            ))}
            <ActionButton onClick={() => handleConfirm("KILL")} disabled={!selectedTarget} className="bg-green-600 mt-4">确认击杀</ActionButton>
          </ActionPanel>
        );
      case Role.SEER:
        return (
          <ActionPanel title="预言家请查验">
            {livingPlayers.map(player => (
              <ActionButton key={player.id} onClick={() => setSelectedTarget(player.id)} className={selectedTarget === player.id ? "bg-blue-500 ring-2 ring-white" : "bg-blue-800"}>
                查验 {player.name} ({player.seat}号)
              </ActionButton>
            ))}
            <ActionButton onClick={() => handleConfirm("CHECK")} disabled={!selectedTarget} className="bg-green-600 mt-4">确认查验</ActionButton>
          </ActionPanel>
        );
      case Role.WITCH:
        return (
          <ActionPanel title="女巫请用药">
            <ActionButton onClick={() => handleConfirm("SAVE")} className="bg-green-700">使用解药</ActionButton>
            {livingPlayers.map(player => (
              <ActionButton key={player.id} onClick={() => handleConfirm("POISON", player.id)} className="bg-purple-800">
                毒杀 {player.name} ({player.seat}号)
              </ActionButton>
            ))}
          </ActionPanel>
        );
      case Role.GUARD:
          return (
            <ActionPanel title="守卫请守护">
              {livingPlayersIncludingSelf.map(player => (
                <ActionButton key={player.id} onClick={() => setSelectedTarget(player.id)} className={selectedTarget === player.id ? "bg-yellow-500 ring-2 ring-white" : "bg-yellow-700"}>
                  守护 {player.name} ({player.seat}号)
                </ActionButton>
              ))}
              <ActionButton onClick={() => handleConfirm("GUARD")} disabled={!selectedTarget} className="bg-green-600 mt-4">确认守护</ActionButton>
            </ActionPanel>
          );
      case Role.KNIGHT:
        return <div className="text-white">骑士请在白天行动。</div>;
      default:
        return <div className="text-white">夜晚行动中...请耐心等待。</div>;
    }
  };
  
  const renderVoteStage = () => {
      const livingPlayers = gameState.players.filter(p => p.is_alive);
       return (
          <ActionPanel title="投票放逐">
            {livingPlayers.map(player => (
                <ActionButton
                  key={player.id}
                  onClick={() => onAction('VOTE', { target: player.id })}
                  className="bg-red-800"
                >
                  {player.name} ({player.seat}号)
                </ActionButton>
            ))}
          </ActionPanel>
        );
  }
  
  const renderSpeechStage = () => {
      if (!gameState.speech_order || gameState.speech_order.length === 0) {
          return <div className="text-white">等待发言顺序...</div>
      }
      const amISpeaking = gameState.speech_order[0] === myPlayer.id;
      if (amISpeaking) {
          return (
              <ActionButton onClick={() => onAction("SPEECH_DONE", { playerId: myPlayer.id })} className="bg-gray-600">
                结束发言
              </ActionButton>
          )
      }
      const speaker = gameState.players.find(p => p.id === gameState.speech_order[0]);
      return <div className="text-white">听 {speaker?.name || '...'} 发言...</div>
  }

  switch (gameState.stage) {
    case Stage.WAITING:
      return renderWaitingStage();
    case Stage.NIGHT_SKILLS:
      return renderNightSkillsStage();
    case Stage.VOTE:
        return renderVoteStage();
    case Stage.SPEECH:
        return renderSpeechStage();
    case Stage.GAME_OVER:
        return <div className="text-2xl font-bold text-yellow-400">游戏结束! {gameState.winner} 阵营胜利!</div>
    default:
      return <div className="text-white text-lg">等待下一阶段... ({gameState.stage})</div>;
  }
};

export default ActionBar;
