'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';

interface WebSocketContextType {
  lastMessage: MessageEvent | null;
  setLastMessage: (message: MessageEvent | null) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);

  return (
    <WebSocketContext.Provider value={{ lastMessage, setLastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};