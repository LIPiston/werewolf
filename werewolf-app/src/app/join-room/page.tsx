'use client';

import { useState } from 'react';
import { useProfile } from '@/lib/ProfileContext';
import { joinGame } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function JoinRoom() {
  const { profile } = useProfile();
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      setError("You must be logged in to join a room.");
      return;
    }
    setError(null);
    try {
      const data = await joinGame(roomId, profile.id);
      // We no longer need to store player_id or is_host in localStorage
      // The backend and game state will manage this.
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
      <h1 className="text-4xl font-bold text-white mb-8">加入房间</h1>
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4 w-full max-w-sm">
        <label htmlFor="roomId" className="text-white text-lg">房间 ID:</label>
        <input
          type="text"
          id="roomId"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="p-3 rounded-lg bg-gray-700 text-white"
        />
        <button type="submit" className="px-6 py-3 bg-green-600 text-white rounded-lg">
          加入
        </button>
        {error && <p className="text-red-500">{error}</p>}
      </form>
    </div>
  );
}