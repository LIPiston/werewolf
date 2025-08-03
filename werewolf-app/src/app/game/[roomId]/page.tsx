'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import PlayerAvatar from '@/components/PlayerAvatar';
import GameLog from '@/components/GameLog';
import ActionBar from '@/components/ActionBar';
import { joinRoom } from '@/lib/api';

// --- Enums and Types matching the new backend ---
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

interface GameState {
    room_id: string;
    players: Player[];
    stage: Stage;
    timer: number;
    day: number;
    host_id: string;
    game_config: {
        template_name: string;
        is_private: boolean;
        allow_spectators: boolean;
    };
    speech_order: string[];
    winner: 'GOOD' | 'WOLF' | null;
}

const MAX_PLAYERS = 12;

function GamePageContent() {
    const { roomId } = useParams<{ roomId: string }>();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [gameLog, setGameLog] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number>(0);
    const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
    const socketRef = useRef<WebSocket | null>(null);

    const connectWebSocket = useCallback((token: string) => {
        if (socketRef.current) {
            socketRef.current.close();
        }

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:6501/ws';
        const ws = new WebSocket(`${wsUrl}?token=${token}`);
        socketRef.current = ws;

        ws.onopen = () => {
            setGameLog(prev => [...prev, "已成功连接到服务器。"]);
        };

        ws.onmessage = (event: MessageEvent) => {
            const message = JSON.parse(event.data);
            const { type, payload } = message;

            switch (type) {
                case 'CONNECTED':
                    setMyPlayerId(payload.player_id);
                    break;
                case 'STAGE_CHANGE':
                    setGameState(payload);
                    setCountdown(payload.timer);
                    setGameLog(prev => [...prev, `进入阶段: ${payload.stage} (${payload.timer}s)`]);
                    break;
                case 'NIGHT_RESULT':
                    const { dead, saved, poisoned } = payload;
                    let nightLog = `昨夜, ${dead.join(', ')} 号玩家死亡。`;
                    if (saved) nightLog += ` ${saved} 号玩家被女巫救了。`;
                    if (poisoned) nightLog += ` ${poisoned} 号玩家被女巫毒了。`;
                    if (dead.length === 0 && !saved && !poisoned) nightLog = "昨夜是平安夜。";
                    setGameLog(prev => [...prev, nightLog]);
                    break;
                case 'VOTE_RESULT':
                    const { eliminated, votes } = payload;
                    const voteLog = Object.entries(votes).map(([voter, target]) => `${voter} -> ${target}`).join('; ');
                    setGameLog(prev => [...prev, `投票结果: ${voteLog}`]);
                    if (eliminated) {
                        setGameLog(prev => [...prev, `${eliminated} 号玩家被投票出局。`]);
                    } else {
                        setGameLog(prev => [...prev, `平票，无人出局。`]);
                    }
                    break;
                case 'GAME_OVER':
                    setGameLog(prev => [...prev, `游戏结束! ${payload.winner} 阵营胜利!`]);
                    break;
                default:
                    setGameLog(prev => [...prev, `收到未知消息: ${type}`]);
            }
        };

        ws.onclose = () => {
            setGameLog(prev => [...prev, "与服务器连接断开。"]);
        };

        ws.onerror = (err) => {
            console.error("WebSocket error:", err);
            setError("WebSocket 连接错误。");
        };
    }, []);

    useEffect(() => {
        const joinAndConnect = async () => {
            try {
                const storedToken = sessionStorage.getItem(`werewolf_token_${roomId}`);
                if (storedToken) {
                    connectWebSocket(storedToken);
                    return;
                }

                const playerName = prompt("请输入你的昵称:") || `玩家${Math.floor(Math.random() * 1000)}`;
                const { player_id, token } = await joinRoom(roomId, playerName);

                sessionStorage.setItem(`werewolf_token_${roomId}`, token);
                setMyPlayerId(player_id);
                connectWebSocket(token);
            } catch (err) {
                console.error("Failed to join room:", err);
                setError("加入房间失败。");
            } finally {
                setIsLoading(false);
            }
        };

        joinAndConnect();

        return () => {
            socketRef.current?.close();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, connectWebSocket]);
    
    useEffect(() => {
        if (countdown > 0) {
            const timerId = setInterval(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
            return () => clearInterval(timerId);
        }
    }, [countdown]);


    const handleAction = useCallback((type: string, payload: object = {}) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type, payload }));
        } else {
            console.error("WebSocket is not connected.");
        }
    }, []);

    const renderPlayerSlot = (seatIndex: number) => {
        const player = gameState?.players.find(p => p.seat === seatIndex);
        
        return (
            <div key={seatIndex} className="w-20 h-24 bg-gray-800 rounded-lg shadow-lg flex flex-col items-center justify-center p-1 transition-all duration-300">
                {player ? (
                    <div className={`relative text-center ${!player.is_alive ? 'opacity-40 grayscale' : ''}`}>
                         <PlayerAvatar profile={{id: player.id, name: player.name, avatar_url: player.avatar_url}} />
                         <p className="text-white text-sm font-medium mt-2 truncate">{player.name}</p>
                         <p className="text-gray-400 text-xs">{player.seat}号位 {player.is_ready ? '✔️' : ''}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center">
                        <span className="text-gray-500 text-lg font-semibold">{seatIndex}号</span>
                        <span className="text-gray-600 text-sm mt-1">空位</span>
                    </div>
                )}
            </div>
        );
    };

    if (isLoading) return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white"><div className="text-xl">正在加入房间...</div></div>;
    if (error) return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-red-500"><div className="text-xl">{error}</div></div>;
    if (!gameState) return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white"><div className="text-xl">等待服务器状态...</div></div>;

    const me = gameState.players.find(p => p.id === myPlayerId);
    const seatIndices = Array.from({ length: MAX_PLAYERS }, (_, i) => i);

    return (
        <div className="bg-gray-900 text-white h-screen flex flex-col overflow-hidden">
            <header className="bg-gray-800 shadow-md">
                <div className="container mx-auto px-6 py-3 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-white">房间: {roomId}</h1>
                    <div className="text-center">
                        <span className="text-lg font-semibold text-green-400">{gameState.stage}</span>
                        {countdown > 0 && (
                           <>
                               <span className="mx-2 text-gray-500">|</span>
                               <span className="text-lg font-semibold text-red-400">{countdown}s</span>
                           </>
                        )}
                    </div>
                    <div className="text-sm">玩家: {gameState.players.length}/{MAX_PLAYERS}</div>
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
    // WebSocketProvider might not be needed anymore if we manage the socket directly
    // For now, we keep it to avoid breaking other components if they use it.
    return <GamePageContent />;
}
