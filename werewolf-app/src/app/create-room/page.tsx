'use client';

import { useState, useEffect } from 'react';
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
      } catch (err) {
        setError("无法加载游戏模板。");
      }
    }
    fetchTemplates();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      setError("您必须登录才能创建房间。");
      return;
    }
    if (!selectedTemplate) {
      setError("请选择一个游戏模板。");
      return;
    }
    setError(null);
    try {
      const data = await createGame(selectedTemplate, profile.id);
      // We no longer need to store player_id or is_host in localStorage
      // The backend and game state will manage this.
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
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold text-white mb-8">创建房间</h1>
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4 w-full max-w-sm">
        <label htmlFor="template" className="text-white text-lg">选择板子:</label>
        <select
          id="template"
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="p-3 rounded-lg bg-gray-700 text-white"
        >
          {templates.map(t => (
            <option key={t.name} value={t.name}>
              {t.name} ({t.description})
            </option>
          ))}
        </select>

        <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg">
          创建
        </button>
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </form>
    </div>
  );
}