'use client';

import Image from 'next/image';

interface PlayerProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  stats?: {
    games_played: number;
    wins: number;
    losses: number;
    roles: { [key: string]: number };
  };
}

interface PlayerAvatarProps {
  profile: PlayerProfile;
  width?: number;
  height?: number;
}

export default function PlayerAvatar({ profile, width = 72, height = 72 }: PlayerAvatarProps) {
  const avatarSrc = profile.avatar_url 
    ? `http://localhost:8000${profile.avatar_url}`
    : '/user-regular-full.svg';

  return (
    <div className="relative rounded-full p-1 ring-2 ring-gray-600 bg-gray-800">
      <Image
        src={avatarSrc}
        alt={`${profile.name}'s avatar`}
        width={width}
        height={height}
        className="object-cover rounded-full"
        priority
      />
    </div>
  );
}