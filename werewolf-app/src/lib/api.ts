const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6501';

// --- Type Definitions ---

export interface GameTemplate {
  name: string;
  player_counts: number[];
  roles: Record<string, number>;
  description: string;
}

export interface GameConfig {
  template_name: string;
  is_private: boolean;
  allow_spectators: boolean;
}

interface RoomCreateRequest {
  host_name: string;
  config: GameConfig;
}

interface RoomCreateResponse {
  room_id: string;
  host_player_id: string;
  token: string;
}

interface RoomJoinResponse {
  player_id: string;
  token: string;
}

// --- API Functions ---

export async function getGameTemplates(): Promise<GameTemplate[]> {
  const response = await fetch(`${API_BASE_URL}/api/game-templates`);
  if (!response.ok) {
    throw new Error('Failed to fetch game templates');
  }
  return response.json();
}

export async function createRoom(hostName: string, config: GameConfig): Promise<RoomCreateResponse> {
  const requestBody: RoomCreateRequest = { host_name: hostName, config };
  const response = await fetch(`${API_BASE_URL}/api/room`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    throw new Error('Failed to create room');
  }
  return response.json();
}

export async function joinRoom(roomId: string, playerName: string): Promise<RoomJoinResponse> {
  const response = await fetch(`${API_BASE_URL}/api/room/${roomId}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ player_name: playerName }),
  });
  if (!response.ok) {
    throw new Error('Failed to join room');
  }
  return response.json();
}