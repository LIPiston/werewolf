'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useProfile } from '@/lib/ProfileContext';
import { getProfile } from '@/lib/api';
import PlayerAvatar from '@/components/PlayerAvatar';
import GameLog from '@/components/GameLog';
import ActionBar from '@/components/ActionBar';

// Define more specific types as the project grows
interface GamePlayer {
  id: string; // In-game ID
  profile_id: string;
  is_alive: boolean;
  role?: string;
}

interface GameState {
  room_id: string;
  players: GamePlayer[];
  phase: string;
  day: number;
  game_log: string[];
  werewolf_kill_target?: string | null;
}

interface PlayerProfile {
  id: string;
  name: string;
  avatar_url: string;
  stats: {
    games_played: number;
    wins: number;
    losses: number;
    roles: { [key: string]: number };
  };
}

export default function GamePage() {
  const { roomId } = useParams();
  const { profile: myProfile } = useProfile();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, PlayerProfile>>({});
  const [myRole, setMyRole] = useState<string | undefined>(undefined);

  const handleAction = useCallback((action: string, payload: object) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: action, payload }));
    }
  }, [socket]);

  useEffect(() => {
    if (!myProfile || !roomId) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/${roomId}/${myProfile.id}`);

    ws.onopen = () => console.log('WebSocket connected');
    ws.onclose = () => console.log('WebSocket disconnected');

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      console.log('Received message:', message);

      switch (message.type) {
        case 'game_start':
        case 'game_state_update': {
          const newGameState: GameState = message.room;
          setGameState(newGameState);
          const me = newGameState.players.find(p => p.profile_id === myProfile.id);
          if (me && me.role) {
            setMyRole(me.role);
          }
          // Fetch profiles for any new players
          setPlayerProfiles(prevProfiles => {
            const updatedProfiles = { ...prevProfiles };
            (async () => {
              for (const player of newGameState.players) {
                if (!updatedProfiles[player.profile_id]) {
                  try {
                    const pData = await getProfile(player.profile_id);
                    updatedProfiles[player.profile_id] = pData;
                  } catch (e) { console.error(e); }
                }
              }
              setPlayerProfiles(updatedProfiles);
            })();
            return updatedProfiles;
          });
          break;
        }
        case 'phase_change':
          setGameState(prev => prev ? { ...prev, phase: message.payload.phase } : null);
          break;
        // Add more cases for other specific updates
      }
    };

    setSocket(ws);

    return () => ws.close();
  }, [roomId, myProfile]);

  if (!gameState || !myProfile) {
    return <div className="text-white text-center p-8">Loading Game...</div>;
  }

  return (
    <div className="container mx-auto p-4 flex flex-col h-screen">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-white">Room: {roomId} - Day {gameState.day} - {gameState.phase.toUpperCase()}</h1>
      </header>

      <main className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 grid grid-cols-3 lg:grid-cols-4 gap-4 content-start">
          {gameState.players.map((player) => {
            const playerProfile = playerProfiles[player.profile_id];
            if (!playerProfile) return <div key={player.id}>Loading...</div>;
            return (
              <div key={player.id} className={`p-2 rounded-lg text-center ${!player.is_alive ? 'opacity-40' : ''}`}>
                <PlayerAvatar profile={playerProfile} />
                <p className="text-white mt-1 truncate">{playerProfile.name}</p>
              </div>
            );
          })}
        </div>

        <div className="h-full flex flex-col">
          <GameLog logs={gameState.game_log} />
        </div>
      </main>

      <footer className="mt-4 p-4 bg-gray-800 rounded-t-lg">
        <ActionBar 
          gameState={gameState} 
          myProfile={myProfile} 
          myRole={myRole}
          onAction={handleAction} 
        />
      </footer>
    </div>
  );
}
