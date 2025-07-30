'use client';

import React, { useEffect, useRef } from 'react';

interface GameLogProps {
  logs: string[];
}

const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div ref={logContainerRef} className="w-full h-full bg-gray-900 bg-opacity-50 rounded-lg p-4 overflow-y-auto">
      <div>
        {logs.map((log, index) => (
          <p key={index} className="text-gray-300 text-sm mb-2 last:mb-0">
            <span className="text-gray-500 mr-2">»</span>
            {log}
          </p>
        ))}
      </div>
    </div>
  );
};

export default GameLog;
