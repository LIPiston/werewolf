'use client';

import { useProfile } from '@/lib/ProfileContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createProfile } from '@/lib/api';

export default function Home() {
  const { profile, setProfile } = useProfile();
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleJoin = () => {
    router.push('/join-room');
  };

  const handleCreate = () => {
    router.push('/create-room');
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("请输入你的名字。");
      return;
    }
    setError(null);
    try {
      const newProfile = await createProfile(name);
      setProfile(newProfile);
    } catch {
      setError("创建个人资料失败。");
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <header className="bg-gray-900 shadow">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <a href="#" className="text-2xl font-bold text-white lg:text-3xl hover:text-gray-300">狼人杀</a>
          {profile && (
            <div className="flex items-center">
              <span className="text-white">欢迎, {profile.name}</span>
            </div>
          )}
        </div>
      </header>
      
      <main className="container mx-auto px-6 py-16 text-center">
        <div className="mx-auto max-w-lg">
            <h1 className="text-3xl font-bold text-white lg:text-5xl">终极谎言与欺骗游戏</h1>
            <p className="mt-6 text-gray-300">召集你的朋友，揭露狼人，或者在为时已晚之前欺骗村民。</p>
            
            {profile ? (
              <div className="mt-10 flex justify-center space-x-4">
                <button onClick={handleCreate} className="w-full transform rounded-md bg-blue-600 px-8 py-2.5 text-sm font-medium capitalize tracking-wide text-white transition-colors duration-300 hover:bg-blue-500 focus:outline-none focus:ring focus:ring-blue-300 focus:ring-opacity-80 sm:w-auto">创建房间</button>
                <button onClick={handleJoin} className="w-full transform rounded-md border border-transparent bg-gray-700 px-8 py-2.5 text-sm font-medium capitalize tracking-wide text-white transition-colors duration-300 hover:bg-gray-600 focus:outline-none focus:ring focus:ring-gray-300 focus:ring-opacity-80 sm:w-auto">加入房间</button>
              </div>
            ) : (
              <form onSubmit={handleProfileSubmit} className="mt-8">
                <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="输入你的名字"
                    className="w-full rounded-md border bg-gray-800 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring focus:ring-blue-300 focus:ring-opacity-40"
                  />
                  <button type="submit" className="w-full transform rounded-md bg-blue-600 px-8 py-2.5 text-sm font-medium capitalize tracking-wide text-white transition-colors duration-300 hover:bg-blue-500 focus:outline-none focus:ring focus:ring-blue-300 focus:ring-opacity-80 sm:w-auto">
                    设置名字并开始
                  </button>
                </div>
                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
              </form>
            )}
        </div>
      </main>
    </div>
  );
}
