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

// === Game Management ===

export async function getGameTemplates() {
    const response = await fetch(`${API_BASE_URL}/game-templates`);
    if (!response.ok) throw new Error("Failed to get game templates");
    return response.json();
}

export async function createGame(templateName: string, hostProfileId: string) {
  const gameConfig = { template_name: templateName };
  const response = await fetch(`${API_BASE_URL}/games/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host_profile_id: hostProfileId, game_config: gameConfig }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create game");
  }
  return response.json();
}

export async function getGame(roomId: string) {
    const response = await fetch(`${API_BASE_URL}/games/${roomId}`);
    if (!response.ok) throw new Error("Failed to get game state");
    return response.json();
}

export async function joinGame(roomId: string, profileId: string) {
  const response = await fetch(`${API_BASE_URL}/games/${roomId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_id: profileId }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to join game");
  }
  return response.json();
}