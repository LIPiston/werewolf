'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useProfile } from '@/lib/ProfileContext';
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
  phase: "lobby" | "werewolf_turn" | "witch_turn" | "seer_turn" | "day" | "voting" | "ended";
  nightly_deaths: string[];
}

const MAX_PLAYERS = 12;

export default function GamePage() {
  const { roomId: rawRoomId } = useParams();
  const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId;
  const { profile: myProfile } = useProfile();
  
  const socketRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleAction = useCallback((action: string, payload: object = {}) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: action, payload }));
    } else {
      console.error("WebSocket is not connected or ready.");
    }
  }, []);

  // Single, robust useEffect for all setup
  useEffect(() => {
    if (!roomId || !myProfile) return;

    let isMounted = true;

    const setup = async () => {
      try {
        // 1. Fetch initial state via HTTP
        const initialState = await getGame(roomId);
        if (!isMounted) return;
        setGameState(initialState);
        setGameLog(["成功获取游戏状态。"]);

        // 2. Establish WebSocket connection
        const ws = new WebSocket(`ws://localhost:8000/ws/${roomId}/${myProfile.id}`);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isMounted) setGameLog(prev => [...prev, "已成功连接到服务器。"]);
        };

        ws.onclose = () => {
          if (isMounted) setGameLog(prev => [...prev, "与服务器断开连接。"]);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          const message = JSON.parse(event.data);
          
          if (message.type.includes('UPDATE') || message.type.includes('START')) {
            setGameState(message.payload);
          } else if (message.type === 'PLAYER_JOINED') {
             setGameState(prev => prev ? { ...prev, players: [...prev.players, message.payload] } : null);
             setGameLog(prev => [...prev, `玩家 ${message.payload.name} 已加入。`]);
          } else if (message.type === 'ROLE_ASSIGNMENT') {
              setGameLog(prev => [...prev, `你的身份是: ${message.payload.role}`]);
          } else {
            setGameLog(prev => [...prev, message.payload.log || `收到消息: ${message.type}`])
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
  // This effect runs only once on mount, which is the correct pattern.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myProfile?.id]);

  const me = gameState?.players.find(p => p.profile_id === myProfile?.id);

  const renderPlayerSlot = (seatIndex: number) => {
    const player = gameState?.players.find(p => p.seat === seatIndex);
    const canTakeSeat = !player && me && me.seat === null;

    return (
      <div key={seatIndex} className="w-24 h-24 border-2 border-green-500 rounded-lg flex items-center justify-center p-2">
        {player ? (
          <div className={`text-center ${!player.is_alive ? 'opacity-40' : ''}`}>
             <PlayerAvatar profile={{id: player.profile_id, name: player.name, avatar_url: player.avatar_url}} />
             <p className="text-white text-xs mt-1 truncate">{player.name}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <span className="text-gray-600 text-sm">空位</span>
            {canTakeSeat && (
              <button
                onClick={() => handleAction('TAKE_SEAT', { seat_number: seatIndex })}
                className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs"
              >
                上位
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) return <div className="text-white text-center p-8">正在加载游戏...</div>;
  if (error) return <div className="text-red-500 text-center p-8">{error}</div>;
  if (!gameState || !myProfile) return <div className="text-white text-center p-8">无法加载游戏数据。</div>;

  const seatIndices = Array.from({ length: MAX_PLAYERS }, (_, i) => i);

  return (
    <div className="bg-black text-white h-screen flex flex-col p-4 font-mono">
      <header className="w-full h-12 border-2 border-red-500 mb-4 flex items-center justify-between px-4">
        <h1 className="text-xl font-bold">房间: {roomId}</h1>
        <div className="text-xl">
            <span>第 {gameState.day} 天</span> - <span>{gameState.phase.toUpperCase()}</span>
        </div>
         <div>
            {gameState.nightly_deaths.length > 0 && `死亡: ${gameState.nightly_deaths.length}`}
        </div>
      </header>

      <main className="flex-grow grid grid-cols-[1fr_4fr_1fr] grid-rows-1 gap-4">
        <div className="flex flex-col justify-around items-center">
          {seatIndices.slice(0, 6).map(renderPlayerSlot)}
        </div>
        <div className="border-2 border-white h-full overflow-y-auto p-4 flex flex-col-reverse">
          <GameLog logs={gameLog} />
        </div>
        <div className="flex flex-col justify-around items-center">
          {seatIndices.slice(6, 12).map(renderPlayerSlot)}
        </div>
      </main>

      <footer className="mt-4 shrink-0 p-4 bg-gray-900 rounded-lg min-h-[100px] w-full max-w-4xl flex items-center justify-center">
          {me && (
            <ActionBar 
              gameState={gameState}
              myPlayer={me}
              onAction={handleAction}
              ws={socketRef.current}
            />
          )}
      </footer>
    </div>
  );
}
