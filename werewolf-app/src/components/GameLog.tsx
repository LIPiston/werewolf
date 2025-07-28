'use client';

import React from 'react';

interface GameLogProps {
  logs: string[];
}

const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  return (
    <div className="w-full h-48 bg-gray-900 bg-opacity-75 rounded-lg p-4 overflow-y-auto border border-gray-700">
      <h2 className="text-xl font-bold text-gray-300 mb-2">游戏日志</h2>
      <ul>
        {logs.map((log, index) => (
          <li key={index} className="text-gray-200 text-sm mb-1 animate-fade-in">
            {log}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GameLog;
