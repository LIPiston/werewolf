'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useProfile } from '@/lib/ProfileContext';
import { createGame, getGameTemplates } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface GameTemplate {
    name: string;
    player_counts: number[];
    roles: Record<string, number>;
    description: string;
}

export default function CreateRoom() {
  const { profile } = useProfile();
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const data = await getGameTemplates();
        setTemplates(data);
        if (data.length > 0) {
          setSelectedTemplate(data[0].name);
        }
      } catch {
        setError("无法加载游戏模板。");
      }
    }
    fetchTemplates();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      setError("您必须登录才能创建房间。");
      router.push('/');
      return;
    }
    if (!selectedTemplate) {
      setError("请选择一个游戏模板。");
      return;
    }
    setError(null);
    try {
      const data = await createGame(selectedTemplate, profile.id);
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
    <div className="bg-gray-900 text-white min-h-screen">
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

        <main className="flex items-center justify-center pt-16">
            <section className="w-full max-w-md p-6 mx-auto bg-white rounded-md shadow-md dark:bg-gray-800">
                <h2 className="text-lg font-semibold text-gray-700 capitalize dark:text-white">创建新房间</h2>
        
                <form onSubmit={handleSubmit} className="mt-4">
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="text-gray-700 dark:text-gray-200" htmlFor="template">选择板子</label>
                            <select
                                id="template"
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                className="block w-full px-4 py-2 mt-2 text-gray-700 bg-white border border-gray-200 rounded-md dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 focus:border-blue-400 focus:ring-blue-300 focus:ring-opacity-40 dark:focus:border-blue-300 focus:outline-none focus:ring"
                            >
                              {templates.map(t => (
                                <option key={t.name} value={t.name}>
                                  {t.name} ({t.description})
                                </option>
                              ))}
                            </select>
                        </div>
                    </div>

                    {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        
                    <div className="flex justify-end mt-6">
                        <button type="submit" className="px-8 py-2.5 leading-5 text-white transition-colors duration-300 transform bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:bg-gray-600">
                            创建
                        </button>
                    </div>
                </form>
            </section>
        </main>
    </div>
  );
}