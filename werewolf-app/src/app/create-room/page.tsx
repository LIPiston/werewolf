'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom, getGameTemplates, GameTemplate, GameConfig } from '@/lib/api';

const Modal = ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="flex justify-end">
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Toggle = ({ label, enabled, setEnabled }: { label: string; enabled: boolean; setEnabled: (enabled: boolean) => void }) => (
    <div className="flex items-center justify-between w-full">
        <span className="text-gray-300">{label}</span>
        <button
            onClick={() => setEnabled(!enabled)}
            className={`${enabled ? 'bg-blue-600' : 'bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
        >
            <span className={`${enabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
        </button>
    </div>
);

export default function CreateRoomPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('6人暗牌局');
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowSpectators, setAllowSpectators] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const fetchedTemplates = await getGameTemplates();
        setTemplates(fetchedTemplates);
        if (fetchedTemplates.length > 0 && !fetchedTemplates.some(t => t.name === '6人暗牌局')) {
             setSelectedTemplate(fetchedTemplates[0].name);
        }
      } catch (err) {
        setError("无法加载游戏板子列表。");
      }
    };
    fetchTemplates();
  }, []);

  const handleCreateRoom = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const hostName = prompt("请输入你的昵称:") || `房主${Math.floor(Math.random() * 1000)}`;
      const config: GameConfig = {
        template_name: selectedTemplate,
        is_private: isPrivate,
        allow_spectators: allowSpectators,
      };
      const { room_id, token } = await createRoom(hostName, config);
      sessionStorage.setItem(`werewolf_token_${room_id}`, token);
      router.push(`/game/${room_id}`);
    } catch (err) {
      setError('创建房间失败，请稍后再试。');
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl text-center max-w-sm mx-auto">
        <h1 className="text-4xl font-bold mb-6 text-yellow-400">创建新游戏</h1>
        <p className="text-gray-400 mb-8">
          点击下方按钮，配置并开始一局新游戏。
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          创建房间
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2 className="text-2xl font-bold mb-6 text-center text-white">房间设置</h2>
        <div className="space-y-6">
          <div>
            <label htmlFor="template-select" className="block mb-2 text-sm font-medium text-gray-300">选择板子</label>
            <select
              id="template-select"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            >
              {templates.map(t => <option key={t.name} value={t.name}>{t.name} ({t.description})</option>)}
            </select>
          </div>
          <Toggle label="私密房间" enabled={isPrivate} setEnabled={setIsPrivate} />
          <Toggle label="允许观战" enabled={allowSpectators} setEnabled={setAllowSpectators} />
        </div>
        <div className="mt-8">
          <button
            onClick={handleCreateRoom}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 disabled:bg-gray-500 transition-colors"
          >
            {isLoading ? '正在创建...' : '确认创建'}
          </button>
          {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}