'use client';

import { useState } from 'react';
import { useProfile } from '@/lib/ProfileContext';
import { createProfile } from '@/lib/api';
import Link from 'next/link';

export default function Home() {
  const { profile, setProfile, isLoading } = useProfile();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name cannot be empty.");
      return;
    }
    try {
      const newProfile = await createProfile(name);
      setProfile(newProfile);
    } catch (err) {
    }
  };

  if (isLoading) {
    return <div className="text-center text-white">Loading...</div>;
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl font-bold text-white mb-4">创建你的角色</h1>
        <form onSubmit={handleCreateProfile} className="flex flex-col space-y-4 w-full max-w-sm">
          <input
            type="text"
            placeholder="输入你的昵称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="p-3 rounded-lg bg-gray-700 text-white border border-gray-600"
          />
          <button type="submit" className="px-6 py-3 bg-green-600 text-white rounded-lg">
            创建
          </button>
          {error && <p className="text-red-500">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white">
      <h1 className="text-5xl font-bold mb-4">欢迎, {profile.name}!</h1>
      <div className="flex space-x-4">
        <Link href="/create-room" className="px-6 py-3 bg-blue-600 rounded-lg">创建房间</Link>
        <Link href="/join-room" className="px-6 py-3 bg-green-600 rounded-lg">加入房间</Link>
        <Link href="/profile" className="px-6 py-3 bg-gray-600 rounded-lg">个人资料</Link>
      </div>
    </div>
  );
}
