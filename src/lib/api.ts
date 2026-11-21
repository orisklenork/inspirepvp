import type {
  GameMode,
  MatchParticipantResult,
  MatchRecord,
  PlayerAccountBundle,
  PublicPlayerInfo,
} from '../types/game.ts';

let inMemoryToken: string | null = null;

export function setInMemoryToken(token: string | null): void {
  inMemoryToken = token;
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data as T;
}

export async function checkUsernameAvailability(
  username: string
): Promise<{ available: boolean; valid: boolean; message: string }> {
  const encoded = encodeURIComponent(username);
  return apiRequest(`/api/auth/check-username?username=${encoded}`, { method: 'GET' });
}

export async function registerAccount(
  username: string,
  password: string,
  confirmPassword: string
): Promise<{ account: PlayerAccountBundle; token: string; message: string }> {
  const res = await apiRequest<{ account: PlayerAccountBundle; token: string; message: string }>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ username, password, confirmPassword }),
    }
  );
  setInMemoryToken(res.token);
  return res;
}

export async function loginAccount(
  username: string,
  password: string,
  rememberMe: boolean
): Promise<{ account: PlayerAccountBundle; token: string }> {
  const res = await apiRequest<{ account: PlayerAccountBundle; token: string }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe }),
    }
  );
  setInMemoryToken(res.token);
  return res;
}

export async function logoutAccount(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' });
  setInMemoryToken(null);
}

export async function fetchSession(): Promise<{ account: PlayerAccountBundle; token: string } | null> {
  try {
    const res = await apiRequest<{ account: PlayerAccountBundle; token?: string }>('/api/auth/me', {
      method: 'GET',
    });
    if (res.token) {
      setInMemoryToken(res.token);
    }
    return { account: res.account, token: res.token ?? '' };
  } catch {
    return null;
  }
}

export async function updateProfile(payload: {
  username?: string;
  displayName?: string;
  bio?: string;
  selectedAvatarId?: string;
  profileBackgroundId?: string;
  profileThemeId?: string;
  favoriteWeaponId?: string;
  selectedCharacterId?: string;
  showcaseBadges?: string[];
}): Promise<{ account: PlayerAccountBundle; message: string }> {
  return apiRequest('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function uploadAvatarPicture(
  imageDataUrl: string
): Promise<{ account: PlayerAccountBundle; message: string }> {
  return apiRequest('/api/profile/avatar', {
    method: 'POST',
    body: JSON.stringify({ imageDataUrl }),
  });
}

export async function removeAvatarPicture(): Promise<{
  account: PlayerAccountBundle;
  message: string;
}> {
  return apiRequest('/api/profile/avatar', {
    method: 'DELETE',
  });
}

export async function changeAccountPassword(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): Promise<{ ok: boolean; message: string }> {
  return apiRequest('/api/profile/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
  });
}

export async function unlockArmoryWeapon(
  weaponId: string
): Promise<{ account: PlayerAccountBundle; message: string }> {
  return apiRequest('/api/profile/unlock-weapon', {
    method: 'POST',
    body: JSON.stringify({ weaponId }),
  });
}

export async function recordArenaMatch(payload: {
  mode: GameMode;
  outcome: 'victory' | 'defeat';
  kills: number;
  deaths: number;
  score: number;
  durationSec: number;
  participants: MatchParticipantResult[];
}): Promise<{ bundle: PlayerAccountBundle; match: MatchRecord }> {
  return apiRequest('/api/matches/record', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchBotRoster(): Promise<PublicPlayerInfo[]> {
  const res = await apiRequest<{ bots: PublicPlayerInfo[] }>('/api/roster', { method: 'GET' });
  return res.bots;
}

export async function fetchPublicPlayer(playerId: string): Promise<PublicPlayerInfo> {
  const res = await apiRequest<{ player: PublicPlayerInfo }>(
    `/api/players/${encodeURIComponent(playerId)}`,
    { method: 'GET' }
  );
  return res.player;
}
