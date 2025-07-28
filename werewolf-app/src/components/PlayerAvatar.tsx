import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWolfPackBattalion } from '@fortawesome/free-brands-svg-icons';

interface PlayerProfile {
  id: string;
  name: string;
  avatar_url: string;
  stats: {
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

export default function PlayerAvatar({ profile, width = 96, height = 96 }: PlayerAvatarProps) {
  const avatarSrc = profile.avatar_url.startsWith('/')
    ? `http://localhost:8000${profile.avatar_url}`
    : profile.avatar_url;

  return (
    <div className="relative rounded-full overflow-hidden" style={{ width, height }}>
      {profile.avatar_url ? (
        <Image
          src={avatarSrc}
          alt={`${profile.name}'s avatar`}
          width={width}
          height={height}
          className="object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gray-700 flex items-center justify-center">
          <FontAwesomeIcon icon={faWolfPackBattalion} className="text-white" style={{ fontSize: width * 0.6 }} />
        </div>
      )}
    </div>
  );
}