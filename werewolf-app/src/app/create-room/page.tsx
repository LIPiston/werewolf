'use client';

import { useState } from 'react';
import { useProfile } from '@/lib/ProfileContext';
import { createRoom } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function CreateRoom() {
  const { profile } = useProfile();
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      setError("You must be logged in to create a room.");
      return;
    }
    setError(null);
    try {
      const data = await createRoom(maxPlayers, profile.id);
      localStorage.setItem('player_id', data.player_id); // This is the in-game ID
      localStorage.setItem('is_host', 'true');
      router.push(`/game/${data.room_id}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold text-white mb-8">创建房间</h1>
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4 w-full max-w-sm">
        <label htmlFor="maxPlayers" className="text-white text-lg">最大玩家数 (6-12):</label>
        <input
          type="number"
          id="maxPlayers"
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
          min="6"
          max="12"
          className="p-3 rounded-lg bg-gray-700 text-white"
        />
        <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg">
          创建
        </button>
        {error && <p className="text-red-500">{error}</p>}
      </form>
    </div>
  );
}