'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-tighter mb-4 text-yellow-400">
          狼人杀
        </h1>
        <p className="text-xl text-gray-400 mb-12">
          一场谎言与推理的较量
        </p>
        <div className="space-x-4">
          <Link href="/create-room" passHref>
            <button className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-all duration-300 ease-in-out transform hover:scale-105">
              创建房间
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}
