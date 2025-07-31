'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useProfile } from '@/lib/ProfileContext';
import { WebSocketProvider, useWebSocket } from '@/lib/WebSocketContext';
import { getGame } from '@/lib/api';
import PlayerAvatar from '@/components/PlayerAvatar';
import GameLog from '@/components/GameLog';
import ActionBar from '@/components/ActionBar';

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
  seat: number | null;
}

interface GameState {
  room_id: string;
  players: GamePlayer[];
  host_id: string;
  day: number;
  phase: "lobby" | "guard_turn" | "werewolf_turn" | "seer_turn" | "witch_turn" | "night_results" | "day_discussion" | "voting" | "vote_result" | "sheriff_election" | "sheriff_speech" | "sheriff_vote" | "sheriff_result" | "ended";
  nightly_deaths: string[];
  phase_end_time?: number | null;
  current_speaker_id?: string | null;
  sheriff_candidates?: string[];
}

interface Teammate {
  id: string;
  name: string;
  seat: number;
}

interface PersonalRoleAssignmentPayload {
    role: string;
    teammates?: Teammate[];
}

const MAX_PLAYERS = 12;

function GamePageContent() {
  const { roomId: rawRoomId } = useParams();
  const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId;
  const { profile: myProfile, playerId } = useProfile();
  const { setLastMessage } = useWebSocket();
  
  const socketRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!gameState?.phase_end_time) {
      setCountdown(null);
      return;
    }

    const intervalId = setInterval(() => {
      const now = Date.now() / 1000;
      const remaining = Math.round(gameState.phase_end_time! - now);
      if (remaining > 0) {
        setCountdown(remaining);
      } else {
        setCountdown(0);
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [gameState?.phase_end_time]);

  const handleAction = useCallback((action: string, payload: object = {}) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: action, payload }));
    } else {
      console.error("WebSocket is not connected or ready.");
    }
  }, []);

  useEffect(() => {
    if (!roomId || !myProfile) return;

    let isMounted = true;

    const setup = async () => {
      try {
        const initialState = await getGame(roomId);
        if (!isMounted) return;
        setGameState(initialState);
        setGameLog(["成功获取游戏状态。"]);

        const idToConnect = playerId || myProfile.id;
        const ws = new WebSocket(`ws://localhost:8000/ws/${roomId}/${idToConnect}`);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isMounted) setGameLog(prev => [...prev, "已成功连接到服务器。"]);
        };

        ws.onclose = () => {
          if (isMounted) setGameLog(prev => [...prev, "与服务器断开连接。"]);
        };

        ws.onmessage = (event: MessageEvent) => {
          if (!isMounted) return;
          
          setLastMessage(event); // Update context with the new message
          const message = JSON.parse(event.data);

          if (message.type.includes('UPDATE') || message.type.includes('START')) {
            setGameState(message.payload);
          } else if (message.type === 'PLAYER_JOINED') {
             setGameState(prev => prev ? { ...prev, players: [...prev.players, message.payload] } : null);
             setGameLog(prev => [...prev, `玩家 ${message.payload.name} 已加入。`]);
          } else if (message.type === 'ROLE_ASSIGNMENT' || message.type === 'PERSONAL_ROLE_ASSIGNMENT') {
             const payload = message.payload as PersonalRoleAssignmentPayload;
             const { role, teammates } = payload;
             let logMessage = `你的身份是: ${role}`;
             if (teammates && teammates.length > 0) {
                 const teammateNames = teammates.map((t) => `${t.seat}号(${t.name})`).join('、');
                 logMessage += ` | 你的狼队友是: ${teammateNames}`;
             }
             setGameLog(prev => [...prev, logMessage]);
          } else if (message.type === 'PHASE_CHANGE') {
            setGameState(prev => prev ? { ...prev, phase: message.payload.phase } : null);
            setGameLog(prev => [...prev, `进入阶段: ${message.payload.phase}`]);
          } else if (message.type === 'NIGHT_RESULTS') {
            const { deaths, day } = message.payload;
            setGameState(prev => prev ? { ...prev, day: day } : null);
            if (deaths.length > 0) {
              setGameLog(prev => [...prev, `第 ${day-1} 天夜晚, ${deaths.join(' 和 ')} 被杀了。`]);
            } else {
              setGameLog(prev => [...prev, `第 ${day-1} 天夜晚, 是一个平安夜。`]);
            }
          } else if (message.type === 'GAME_EVENT') {
            setGameLog(prev => [...prev, message.payload.message]);
          } else if (message.payload?.log) {
            setGameLog(prev => [...prev, message.payload.log]);
          } else if (message.type === 'SEER_RESULT') {
           // No longer show an alert. The action bar will handle the result display.
          } else if (!message.type.endsWith('_PANEL')) { // Don't log panel messages
            setGameLog(prev => [...prev, `收到消息: ${message.type}`]);
          }
        };

        ws.onerror = (err) => {
          console.error("WebSocket error:", err);
          if (isMounted) setError("WebSocket 连接错误。");
        };

      } catch (err) {
        console.error("Setup failed:", err);
        if (isMounted) setError("无法加载或连接到游戏房间。");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    setup();

    return () => {
      isMounted = false;
      socketRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myProfile?.id, playerId, setLastMessage]);

  const me = gameState?.players.find(p => p.profile_id === myProfile?.id);

  const renderPlayerSlot = (seatIndex: number) => {
    const player = gameState?.players.find(p => p.seat === seatIndex);
    const canTakeSeat = !player && me && me.seat === null;

    return (
      <div key={seatIndex} className="w-20 h-24 bg-gray-800 rounded-lg shadow-lg flex flex-col items-center justify-center p-1 transition-all duration-300">
        {player ? (
          <div className={`relative text-center ${!player.is_alive ? 'opacity-40 grayscale' : ''}`}>
             <PlayerAvatar profile={{id: player.profile_id, name: player.name, avatar_url: player.avatar_url}} />
             <p className="text-white text-sm font-medium mt-2 truncate">{player.is_sheriff && '👑 '}{player.name}</p>
             <p className="text-gray-400 text-xs">{player.seat}号位</p>
             {gameState?.current_speaker_id === player.id && (
               <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-yellow-400"></div>
             )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-gray-500 text-lg font-semibold">{seatIndex}号</span>
            <span className="text-gray-600 text-sm mt-1">空位</span>
            {canTakeSeat && (
              <button
                onClick={() => handleAction('TAKE_SEAT', { seat_number: seatIndex })}
                className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-500 transition-colors"
              >
                上位
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white"><div className="text-xl">正在加载游戏...</div></div>;
  if (error) return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-red-500"><div className="text-xl">{error}</div></div>;
  if (!gameState || !myProfile) return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white"><div className="text-xl">无法加载游戏数据。</div></div>;

  const seatIndices = Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1);

  return (
    <div className="bg-gray-900 text-white h-screen flex flex-col overflow-hidden">
        <header className="bg-gray-800 shadow-md">
            <div className="container mx-auto px-6 py-3 flex justify-between items-center">
                <h1 className="text-xl font-bold text-white">房间: {roomId}</h1>
                <div className="text-center">
                    <span className="text-lg font-semibold text-yellow-400">第 {gameState.day} 天</span>
                    <span className="mx-2 text-gray-500">|</span>
                    <span className="text-lg font-semibold text-green-400">{gameState.phase.toUpperCase()}</span>
                    {countdown !== null && (
                       <>
                           <span className="mx-2 text-gray-500">|</span>
                           <span className="text-lg font-semibold text-red-400">{countdown}s</span>
                       </>
                    )}
                </div>
                <div className="text-sm text-red-500">
                    {gameState.nightly_deaths.length > 0 && `死亡: ${gameState.nightly_deaths.length}`}
                </div>
            </div>
        </header>

        <main className="flex-grow container mx-auto p-4 grid grid-cols-12 gap-4">
            <div className="col-span-3 grid grid-cols-2 gap-4 content-around">
                {seatIndices.slice(0, 6).map(renderPlayerSlot)}
            </div>
            
            <div className="col-span-6 bg-gray-800 rounded-lg p-4 flex flex-col">
                <div className="flex-grow overflow-y-auto">
                    <GameLog logs={gameLog} />
                </div>
            </div>

            <div className="col-span-3 grid grid-cols-2 gap-4 content-around">
                {seatIndices.slice(6, 12).map(renderPlayerSlot)}
            </div>
        </main>

        <footer className="container mx-auto p-4">
            <div className="bg-gray-800 rounded-lg shadow-lg p-4 min-h-[120px] w-full flex items-center justify-center">
                {me && (
                    <ActionBar
                      gameState={gameState}
                      myPlayer={me}
                      onAction={handleAction}
                    />
                )}
            </div>
        </footer>
    </div>
  );
}

export default function GamePage() {
    return (
        <WebSocketProvider>
            <GamePageContent />
        </WebSocketProvider>
    );
}
