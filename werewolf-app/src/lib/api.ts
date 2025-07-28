const API_BASE_URL = '/api';

// === Profile Management ===

export async function createProfile(name: string) {
  const response = await fetch(`${API_BASE_URL}/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error("Failed to create profile");
  return response.json();
}

export async function getProfile(profileId: string) {
  const response = await fetch(`${API_BASE_URL}/profiles/${profileId}`);
  if (!response.ok) throw new Error("Failed to get profile");
  return response.json();
}

export async function uploadAvatar(profileId: string, formData: FormData) {
  const response = await fetch(`${API_BASE_URL}/profiles/${profileId}/avatar`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload avatar");
  return response.json();
}

export async function updateProfileName(profileId: string, name: string) {
  const response = await fetch(`${API_BASE_URL}/profiles/${profileId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error("Failed to update profile name");
  return response.json();
}

// === Room Management ===

export async function createRoom(maxPlayers: number, hostProfileId: string) {
  const response = await fetch(`${API_BASE_URL}/room/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ max_players: maxPlayers, host_profile_id: hostProfileId }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create room");
  }
  return response.json();
}

export async function joinRoom(roomId: string, playerProfileId: string) {
  const response = await fetch(`${API_BASE_URL}/room/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room_id: roomId, player_profile_id: playerProfileId }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to join room");
  }
  return response.json();
}