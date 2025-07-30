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

export default function PlayerAvatar({ profile, width = 64, height = 64 }: PlayerAvatarProps) {
  const avatarSrc = profile.avatar_url 
    ? `http://localhost:8000${profile.avatar_url}`
    : '/user-regular-full.svg'; // Default to the local SVG

  return (
    <div className="relative rounded-full overflow-hidden bg-gray-700 flex items-center justify-center" style={{ width, height }}>
      <Image
        src={avatarSrc}
        alt={`${profile.name}'s avatar`}
        width={width}
        height={height}
        className="object-cover"
      />
    </div>
  );
}