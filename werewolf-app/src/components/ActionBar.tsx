'use client';

import React, { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/WebSocketContext';

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
  phase: "lobby" | "guard_turn" | "werewolf_turn" | "seer_turn" | "witch_turn" | "night_results" | "day_discussion" | "voting" | "vote_result" | "sheriff_election" | "sheriff_speech" | "sheriff_vote" | "sheriff_result" | "ended";
  werewolf_kill_target?: string | null;
  nightly_deaths: string[];
  current_speaker_id?: string | null;
  sheriff_candidates?: string[];
}

interface WerewolfPanelProps {
  players: GamePlayer[];
  teammates?: { id: string; name: string; seat: number }[];
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

const ActionPanel = ({ title, children, onConfirm }: { title: string; children: React.ReactNode; onConfirm?: () => void }) => (
    <div className="w-full text-center">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className="flex flex-wrap items-center justify-center gap-2">
            {children}
        </div>
        {onConfirm && (
            <div className="mt-4">
                <ActionButton onClick={onConfirm} className="bg-green-600">
                    确认
                </ActionButton>
            </div>
        )}
    </div>
);

const ActionBar: React.FC<ActionBarProps> = ({ gameState, myPlayer, onAction }) => {
  const { lastMessage } = useWebSocket();
  const [werewolfPanel, setWerewolfPanel] = useState<WerewolfPanelProps | null>(null);
  const [witchPanel, setWitchPanel] = useState<WitchPanelProps | null>(null);
  const [seerPanel, setSeerPanel] = useState<SeerPanelProps | null>(null);
  const [guardPanel, setGuardPanel] = useState<GuardPanelProps | null>(null);
  const [seerResult, setSeerResult] = useState<{ target_name: string; role: string } | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [witchAction, setWitchAction] = useState<{ action: 'save' | 'poison'; target_player_id?: string } | null>(null);


  useEffect(() => {
    if (!lastMessage) return;

    const message = JSON.parse(lastMessage.data);

    switch (message.type) {
      case 'WEREWOLF_PANEL':
        setWerewolfPanel(message.payload);
        break;
      case 'WITCH_PANEL':
        setWitchPanel(message.payload);
        break;
      case 'SEER_PANEL':
        setSeerPanel(message.payload);
        setSelectedTarget(null);
        break;
      case 'GUARD_PANEL':
        setGuardPanel(message.payload);
        setSelectedTarget(null);
        break;
      case 'SEER_RESULT':
        // This is now handled by the page-level alert
        break;
      case 'PHASE_CHANGE':
        // Reset all panels and selections on phase change
        setWerewolfPanel(null);
        setWitchPanel(null);
        setSeerPanel(null);
        setGuardPanel(null);
        setSelectedTarget(null);
        setWitchAction(null);
        break;
    }
  }, [lastMessage]);


  if (!myPlayer.is_alive) {
    return <div className="text-center text-xl font-semibold text-red-500">你已经出局了</div>;
  }

  if (gameState.phase === 'lobby' && gameState.host_id === myPlayer.profile_id) {
    return (
        <button
          onClick={() => onAction('START_GAME')}
          className="px-8 py-3 text-lg font-bold text-white capitalize transition-colors duration-300 transform bg-blue-600 rounded-md hover:bg-blue-500 focus:outline-none focus:ring focus:ring-blue-300 focus:ring-opacity-80"
        >
          开始游戏
        </button>
    );
  }

  if (werewolfPanel) {
    return (
      <ActionPanel title="狼人请选择目标" onConfirm={() => { if (selectedTarget) { onAction('WEREWOLF_VOTE', { target_player_id: selectedTarget }); setWerewolfPanel(null); } }}>
        {werewolfPanel.players.map(player => (
          <ActionButton
            key={player.id}
            onClick={() => setSelectedTarget(player.id)}
            className={selectedTarget === player.id ? "bg-red-500 ring-2 ring-white" : "bg-red-800"}
          >
            {player.name}
          </ActionButton>
        ))}
      </ActionPanel>
    );
  }

  if (witchPanel) {
    return (
      <ActionPanel title="女巫请行动" onConfirm={() => { if (witchAction) { onAction('WITCH_ACTION', witchAction); setWitchPanel(null); } }}>
        <p className="w-full text-yellow-300 mb-2">狼人目标: {witchPanel.werewolf_target || '无人'}</p>
        {witchPanel.has_save && (
          <ActionButton
            onClick={() => setWitchAction({ action: 'save' })}
            className={witchAction?.action === 'save' ? "bg-green-500 ring-2 ring-white" : "bg-green-600"}
          >
            使用解药
          </ActionButton>
        )}
        {witchPanel.has_poison && witchPanel.players.map(player => (
          <ActionButton
            key={player.id}
            onClick={() => setWitchAction({ action: 'poison', target_player_id: player.id })}
            className={witchAction?.target_player_id === player.id ? "bg-purple-500 ring-2 ring-white" : "bg-purple-800"}
          >
            毒杀 {player.name}
          </ActionButton>
        ))}
      </ActionPanel>
    );
  }
  
  if (seerPanel) {
      return (
          <ActionPanel title="预言家请查验" onConfirm={() => { if (selectedTarget) { onAction('SEER_CHECK', { target_player_id: selectedTarget }); setSeerPanel(null); } }}>
              {seerPanel.players.map(player => (
                  <ActionButton
                    key={player.id}
                    onClick={() => setSelectedTarget(player.id)}
                    className={selectedTarget === player.id ? "bg-blue-500 ring-2 ring-white" : "bg-blue-800"}
                  >
                      查验 {player.name}
                  </ActionButton>
              ))}
          </ActionPanel>
      );
  }

  if (guardPanel) {
      return (
          <ActionPanel title="守卫请守护" onConfirm={() => { if (selectedTarget) { onAction('GUARD_ACTION', { target_player_id: selectedTarget }); setGuardPanel(null); } }}>
              {guardPanel.players.map(player => (
                  <ActionButton
                      key={player.id}
                      onClick={() => setSelectedTarget(player.id)}
                      disabled={player.id === guardPanel.last_guarded_id}
                      className={`${selectedTarget === player.id ? "bg-yellow-500 ring-2 ring-white" : "bg-yellow-700"} ${player.id === guardPanel.last_guarded_id ? 'bg-gray-600 cursor-not-allowed' : ''}`}
                  >
                      守护 {player.name}
                  </ActionButton>
              ))}
          </ActionPanel>
      );
  }

  if (gameState.phase === 'sheriff_election') {
    const alreadyRan = gameState.sheriff_candidates?.includes(myPlayer.id);
    return (
        <ActionPanel title="竞选警长">
            <ActionButton onClick={() => onAction('RUN_FOR_SHERIFF')} className="bg-yellow-600" disabled={alreadyRan}>
                {alreadyRan ? "已参选" : "参与竞选"}
            </ActionButton>
        </ActionPanel>
    );
  }

  if ((gameState.phase === 'sheriff_speech' || gameState.phase === 'day_discussion') && gameState.current_speaker_id === myPlayer.id) {
    return (
        <ActionPanel title="轮到你发言">
            <ActionButton onClick={() => onAction('PASS_TURN')} className="bg-gray-600">
                结束发言
            </ActionButton>
        </ActionPanel>
    );
  }

  if (gameState.phase === 'sheriff_vote') {
      return (
          <ActionPanel title="警长投票">
              {gameState.sheriff_candidates?.map(candidateId => {
                  const candidate = gameState.players.find(p => p.id === candidateId);
                  if (!candidate) return null;
                  return (
                      <ActionButton
                          key={candidate.id}
                          onClick={() => onAction('SHERIFF_VOTE', { target_player_id: candidate.id })}
                          className="bg-blue-800"
                      >
                          投票给 {candidate.name}
                      </ActionButton>
                  );
              })}
          </ActionPanel>
      );
  }
  
  if (gameState.phase === 'voting') {
    return (
      <ActionPanel title="投票放逐">
        {gameState.players.filter(p => p.is_alive).map(player => (
            <ActionButton
              key={player.id}
              onClick={() => onAction('VOTE_PLAYER', { target_player_id: player.id })}
              className="bg-red-800"
            >
              {player.name}
            </ActionButton>
        ))}
      </ActionPanel>
    );
  }

  return <div className="text-white text-lg">等待下一阶段... ({gameState.phase})</div>;
};

export default ActionBar;
