'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useProfile } from '@/lib/ProfileContext';
import { joinGame, getRooms } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Room {
    room_id: string;
    host_name: string;
    player_count: number;
    max_players: number;
    template_name: string;
}

export default function JoinRoom() {
  const { profile, setPlayerId } = useProfile();
  const [roomId, setRoomId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchRooms() {
      try {
        const data = await getRooms();
        setRooms(data);
      } catch {
        setError("无法加载房间列表。");
      }
    }
    fetchRooms();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      setError("您必须登录才能加入房间。");
      router.push('/');
      return;
    }
    if (!roomId.trim()) {
        setError("请输入房间ID。");
        return;
    }
    setError(null);
    try {
      const data = await joinGame(roomId, profile.id);
      setPlayerId(data.player_id);
      router.push(`/game/${data.room_id}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("发生未知错误。");
      }
    }
  };

  const handleRoomClick = async (id: string) => {
    if (!profile) {
      setError("您必须登录才能加入房间。");
      router.push('/');
      return;
    }
    setError(null);
    try {
      const data = await joinGame(id, profile.id);
      setPlayerId(data.player_id);
      router.push(`/game/${data.room_id}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("发生未知错误。");
      }
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col">
        <header className="bg-gray-900 shadow">
            <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                <Link href="/" className="text-2xl font-bold text-white lg:text-3xl hover:text-gray-300">狼人杀</Link>
                {profile && (
                    <div className="flex items-center">
                        <span className="text-white">欢迎, {profile.name}</span>
                    </div>
                )}
            </div>
        </header>

        <main className="flex-grow container mx-auto p-4 flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold mb-6">选择一个房间</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full max-w-6xl">
                {rooms.map(room => (
                    <div key={room.room_id} onClick={() => handleRoomClick(room.room_id)} className="bg-gray-800 p-4 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                        <h3 className="font-bold text-lg">{room.host_name}的房间</h3>
                        <p className="text-sm text-gray-400">{room.template_name}</p>
                        <p className="text-sm">{room.player_count} / {room.max_players}</p>
                        <p className="text-xs text-gray-500 mt-2 truncate">ID: {room.room_id}</p>
                    </div>
                ))}
            </div>
        </main>

        <footer className="bg-gray-900 py-4">
            <form onSubmit={handleSubmit} className="container mx-auto flex items-center justify-center gap-4">
                <input
                    type="text"
                    id="roomId"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="或手动输入房间 ID"
                    className="w-full max-w-sm px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-md dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 focus:border-blue-400 focus:ring-blue-300 focus:ring-opacity-40 dark:focus:border-blue-300 focus:outline-none focus:ring"
                />
                <button type="submit" className="px-8 py-2.5 leading-5 text-white transition-colors duration-300 transform bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:bg-gray-600">
                    加入
                </button>
            </form>
            {error && <p className="text-center text-sm text-red-500 mt-2">{error}</p>}
        </footer>
    </div>
  );
}