import crypto from 'node:crypto';
import type {
  GameMode,
  MatchParticipantResult,
  MatchRecord,
  PlayerAccountBundle,
  PlayerProfile,
  PlayerStatistics,
  PublicPlayerInfo,
} from '../src/types/game.ts';
import { validateUsernameFormat, type ProfileUpdateInput } from './store.ts';

const VALID_AVATAR_IDS = new Set([
  'vanguard',
  'specter',
  'bastion',
  'medic',
  'emblem_amber',
  'emblem_steel',
]);
const VALID_CHARACTER_IDS = new Set(['vanguard', 'specter', 'bastion', 'medic']);
const VALID_WEAPON_IDS = new Set([
  'pulse_rifle',
  'phantom_ak',
  'tactical_sidearm',
  'desert_hawk',
  'valkyrie_smg',
  'scatter_cannon',
  'rail_carbine',
  'awp_viper',
  'titan_lmg',
]);
const VALID_BACKGROUND_IDS = new Set([
  'foundry_hangar',
  'sector_courtyard',
  'obsidian_grid',
  'amber_bunker',
  'emerald_recon',
]);
const VALID_THEME_IDS = new Set([
  'amber_vanguard',
  'obsidian_steel',
  'emerald_recon',
  'sky_interceptor',
  'crimson_ace',
]);
const WEAPON_COSTS: Record<string, number> = {
  pulse_rifle: 0,
  phantom_ak: 350,
  tactical_sidearm: 0,
  desert_hawk: 300,
  valkyrie_smg: 450,
  scatter_cannon: 600,
  rail_carbine: 850,
  awp_viper: 1100,
  titan_lmg: 1250,
};

export interface DbProfileRow {
  user_id: string;
  player_id: string;
  username: string;
  display_name: string;
  profile_picture_url: string | null;
  selected_avatar_id: string;
  bio: string;
  profile_background_id: string;
  profile_theme_id: string;
  favorite_weapon_id: string;
  selected_character_id: string;
  badges: string[];
  showcase_badges: string[];
  inventory: string[];
  coins: number;
  level: number;
  xp: number;
  created_at: string;
  updated_at: string;
}

interface DbStatsRow {
  user_id: string;
  total_kills: number;
  total_deaths: number;
  total_wins: number;
  total_losses: number;
  total_matches_played: number;
  win_rate: number;
  updated_at: string;
}

interface DbMatchRow {
  id: string;
  user_id: string;
  mode: GameMode;
  outcome: 'victory' | 'defeat';
  kills: number;
  deaths: number;
  score: number;
  coins_earned: number;
  xp_earned: number;
  duration_sec: number;
  participants: MatchParticipantResult[];
  played_at: string;
}

export function isSupabaseConfigured(): boolean {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return Boolean(url && key);
}

export function getSupabaseKeyRole(): string {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!key) return 'none';
  if (key.startsWith('sb_secret_')) return 'sb_secret';
  if (key.startsWith('sb_publishable_')) return 'sb_publishable';
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
        role?: string;
      };
      if (payload.role) return payload.role;
    } catch {
      // ignore malformed JWT
    }
  }
  return 'unknown';
}

function getConfig(): { url: string; serviceKey: string } {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceKey) {
    throw new Error('Supabase environment variables are not configured.');
  }
  const role = getSupabaseKeyRole();
  if (role === 'anon' || role === 'sb_publishable') {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is set to a public/anon key. Please set it to your Supabase service_role (secret) key.'
    );
  }
  return { url, serviceKey };
}

function serviceHeaders(extra?: Record<string, string>): Record<string, string> {
  const { serviceKey } = getConfig();
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export async function sbRest<T>(pathAndQuery: string, init: RequestInit = {}): Promise<T> {
  const { url } = getConfig();
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      ...serviceHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const rawMsg =
      data?.message || data?.error_description || data?.error || `Database error (${res.status})`;
    if (typeof rawMsg === 'string' && rawMsg.toLowerCase().includes('permission denied')) {
      throw new Error(
        `${rawMsg}. Run the updated supabase/schema.sql (including the GRANT statements) in your Supabase SQL Editor.`
      );
    }
    throw new Error(rawMsg);
  }
  return data as T;
}

export function mapProfileRow(row: DbProfileRow): PlayerProfile {
  return {
    userId: row.user_id,
    playerId: row.player_id,
    username: row.username,
    displayName: row.display_name,
    profilePictureUrl: row.profile_picture_url,
    selectedAvatarId: row.selected_avatar_id,
    bio: row.bio,
    profileBackgroundId: row.profile_background_id,
    profileThemeId: row.profile_theme_id,
    favoriteWeaponId: row.favorite_weapon_id,
    selectedCharacterId: row.selected_character_id,
    badges: Array.isArray(row.badges) ? row.badges : ['recruit'],
    showcaseBadges: Array.isArray(row.showcase_badges) ? row.showcase_badges : ['recruit'],
    inventory: Array.isArray(row.inventory)
      ? row.inventory
      : ['pulse_rifle', 'tactical_sidearm'],
    coins: Number(row.coins) || 0,
    level: Number(row.level) || 1,
    xp: Number(row.xp) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStatsRow(row: DbStatsRow): PlayerStatistics {
  return {
    userId: row.user_id,
    totalKills: Number(row.total_kills) || 0,
    totalDeaths: Number(row.total_deaths) || 0,
    totalWins: Number(row.total_wins) || 0,
    totalLosses: Number(row.total_losses) || 0,
    totalMatchesPlayed: Number(row.total_matches_played) || 0,
    winRate: Number(row.win_rate) || 0,
    updatedAt: row.updated_at,
  };
}

function mapMatchRow(row: DbMatchRow): MatchRecord {
  return {
    id: row.id,
    mode: row.mode,
    outcome: row.outcome,
    kills: Number(row.kills) || 0,
    deaths: Number(row.deaths) || 0,
    score: Number(row.score) || 0,
    coinsEarned: Number(row.coins_earned) || 0,
    xpEarned: Number(row.xp_earned) || 0,
    durationSec: Number(row.duration_sec) || 0,
    playedAt: row.played_at,
    participants: Array.isArray(row.participants) ? row.participants : [],
  };
}

function detectImageType(buffer: Buffer): { ext: 'jpg' | 'png' | 'webp'; mime: string } | null {
  if (buffer.length < 16) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

export async function sbIsUsernameAvailable(
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  const lower = encodeURIComponent(username.trim().toLowerCase());
  const rows = await sbRest<{ user_id: string }[]>(
    `username_registry?username_lower=eq.${lower}&select=user_id`
  );
  if (!rows.length) return true;
  if (excludeUserId && rows.every((r) => r.user_id === excludeUserId)) return true;
  return false;
}

export async function sbGetAccountBundle(userId: string): Promise<PlayerAccountBundle | null> {
  const uid = encodeURIComponent(userId);
  const [profiles, statsRows, matchRows] = await Promise.all([
    sbRest<DbProfileRow[]>(`profiles?user_id=eq.${uid}&limit=1`),
    sbRest<DbStatsRow[]>(`player_statistics?user_id=eq.${uid}&limit=1`),
    sbRest<DbMatchRow[]>(`matches?user_id=eq.${uid}&order=played_at.desc&limit=20`),
  ]);

  if (!profiles[0] || !statsRows[0]) {
    return null;
  }

  return {
    profile: mapProfileRow(profiles[0]),
    stats: mapStatsRow(statsRows[0]),
    recentMatches: matchRows.map(mapMatchRow),
  };
}

export async function sbRegisterAccount(
  rawUsername: string,
  password: string,
  confirmPassword: string
): Promise<{ bundle: PlayerAccountBundle; userId: string }> {
  const formatErr = validateUsernameFormat(rawUsername);
  if (formatErr) throw new Error(formatErr);
  if (typeof password !== 'string' || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  if (password.length > 128) {
    throw new Error('Password cannot exceed 128 characters.');
  }
  if (password !== confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  const username = rawUsername.trim();
  const available = await sbIsUsernameAvailable(username);
  if (!available) {
    throw new Error('That username is already taken. Please choose another.');
  }

  const { url } = getConfig();
  const internalEmail = `${crypto.randomUUID()}@users.inspiredpvp.local`;

  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { username },
    }),
  });
  const createData = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !createData?.id) {
    throw new Error(createData?.msg || createData?.message || 'Could not create player account.');
  }

  const userId = String(createData.id);
  const bundle = await sbGetAccountBundle(userId);
  if (!bundle) {
    throw new Error('Account created, but profile initialization failed.');
  }
  return { bundle, userId };
}

export async function sbAuthenticateUser(
  rawUsername: string,
  password: string
): Promise<{ bundle: PlayerAccountBundle; userId: string }> {
  if (typeof rawUsername !== 'string' || typeof password !== 'string') {
    throw new Error('Username and password are required.');
  }
  const lower = rawUsername.trim().toLowerCase();
  if (!lower || !password) {
    throw new Error('Please enter both your username and password.');
  }

  const rows = await sbRest<{ user_id: string }[]>(
    `username_registry?username_lower=eq.${encodeURIComponent(lower)}&select=user_id&limit=1`
  );
  if (!rows[0]?.user_id) {
    throw new Error('Invalid username or password.');
  }

  const userId = rows[0].user_id;
  const { url } = getConfig();

  const userRes = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: serviceHeaders(),
  });
  const userData = await userRes.json().catch(() => ({}));
  const internalEmail = userData?.email;
  if (!userRes.ok || !internalEmail) {
    throw new Error('Invalid username or password.');
  }

  const tokenRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ email: internalEmail, password }),
  });
  if (!tokenRes.ok) {
    throw new Error('Invalid username or password.');
  }

  const bundle = await sbGetAccountBundle(userId);
  if (!bundle) {
    throw new Error('Player profile could not be loaded.');
  }
  return { bundle, userId };
}

export async function sbChangePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): Promise<void> {
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }
  if (newPassword.length > 128) {
    throw new Error('New password cannot exceed 128 characters.');
  }
  if (newPassword !== confirmNewPassword) {
    throw new Error('New passwords do not match.');
  }

  const { url } = getConfig();
  const userRes = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: serviceHeaders(),
  });
  const userData = await userRes.json().catch(() => ({}));
  const internalEmail = userData?.email;
  if (!userRes.ok || !internalEmail) {
    throw new Error('Account not found.');
  }

  const verifyRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ email: internalEmail, password: currentPassword }),
  });
  if (!verifyRes.ok) {
    throw new Error('Current password is incorrect.');
  }

  const updateRes = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: serviceHeaders(),
    body: JSON.stringify({ password: newPassword }),
  });
  if (!updateRes.ok) {
    throw new Error('Failed to update password.');
  }
}

export async function sbUpdateProfile(
  userId: string,
  input: ProfileUpdateInput
): Promise<PlayerAccountBundle> {
  const existing = await sbGetAccountBundle(userId);
  if (!existing) throw new Error('Player profile not found.');

  const uid = encodeURIComponent(userId);
  const profilePatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof input.username === 'string') {
    const trimmed = input.username.trim();
    if (trimmed !== existing.profile.username) {
      const err = validateUsernameFormat(trimmed);
      if (err) throw new Error(err);
      const ok = await sbIsUsernameAvailable(trimmed, userId);
      if (!ok) throw new Error('That username is already taken.');
      await sbRest(`username_registry?user_id=eq.${uid}`, {
        method: 'PATCH',
        body: JSON.stringify({
          username: trimmed,
          username_lower: trimmed.toLowerCase(),
          updated_at: new Date().toISOString(),
        }),
      });
      profilePatch.username = trimmed;
    }
  }

  if (typeof input.displayName === 'string') {
    const clean = input.displayName.trim().slice(0, 28);
    if (clean.length < 2) throw new Error('Display name must be at least 2 characters.');
    profilePatch.display_name = clean;
  }

  if (typeof input.bio === 'string') {
    profilePatch.bio = input.bio.trim().slice(0, 220);
  }

  if (typeof input.selectedAvatarId === 'string' && VALID_AVATAR_IDS.has(input.selectedAvatarId)) {
    profilePatch.selected_avatar_id = input.selectedAvatarId;
  }

  if (
    typeof input.profileBackgroundId === 'string' &&
    VALID_BACKGROUND_IDS.has(input.profileBackgroundId)
  ) {
    profilePatch.profile_background_id = input.profileBackgroundId;
  }

  if (typeof input.profileThemeId === 'string' && VALID_THEME_IDS.has(input.profileThemeId)) {
    profilePatch.profile_theme_id = input.profileThemeId;
  }

  if (
    typeof input.selectedCharacterId === 'string' &&
    VALID_CHARACTER_IDS.has(input.selectedCharacterId)
  ) {
    profilePatch.selected_character_id = input.selectedCharacterId;
  }

  if (
    typeof input.favoriteWeaponId === 'string' &&
    VALID_WEAPON_IDS.has(input.favoriteWeaponId) &&
    existing.profile.inventory.includes(input.favoriteWeaponId)
  ) {
    profilePatch.favorite_weapon_id = input.favoriteWeaponId;
  }

  if (Array.isArray(input.showcaseBadges)) {
    profilePatch.showcase_badges = input.showcaseBadges
      .filter((b): b is string => typeof b === 'string' && existing.profile.badges.includes(b))
      .slice(0, 3);
  }

  await sbRest(`profiles?user_id=eq.${uid}`, {
    method: 'PATCH',
    body: JSON.stringify(profilePatch),
  });

  return (await sbGetAccountBundle(userId))!;
}

async function sbDeleteOldAvatar(profilePictureUrl: string | null): Promise<void> {
  if (!profilePictureUrl) return;
  const marker = '/storage/v1/object/public/avatars/';
  const idx = profilePictureUrl.indexOf(marker);
  if (idx === -1) return;
  const objectPath = profilePictureUrl.slice(idx + marker.length);
  if (!objectPath || objectPath.includes('..')) return;
  const { url, serviceKey } = getConfig();
  await fetch(`${url}/storage/v1/object/avatars/${objectPath}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  }).catch(() => {});
}

export async function sbSaveAvatarUpload(
  userId: string,
  dataUrl: string
): Promise<PlayerAccountBundle> {
  const existing = await sbGetAccountBundle(userId);
  if (!existing) throw new Error('Player profile not found.');

  if (typeof dataUrl !== 'string') throw new Error('Invalid image payload.');
  const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Unsupported image format. Please upload JPG, JPEG, PNG, or WEBP.');
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Image exceeds the 5 MB file size limit.');
  }
  const detected = detectImageType(buffer);
  if (!detected) {
    throw new Error('File contents do not match a valid JPG, PNG, or WEBP image.');
  }

  const { url, serviceKey } = getConfig();
  const objectPath = `${userId}/avatar_${crypto.randomUUID()}.${detected.ext}`;

  const uploadRes = await fetch(`${url}/storage/v1/object/avatars/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': detected.mime,
      'x-upsert': 'true',
    },
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Failed to upload image to storage (${uploadRes.status}): ${errText}`);
  }

  await sbDeleteOldAvatar(existing.profile.profilePictureUrl);

  const publicUrl = `${url}/storage/v1/object/public/avatars/${objectPath}`;
  await sbRest(`profiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      profile_picture_url: publicUrl,
      updated_at: new Date().toISOString(),
    }),
  });

  return (await sbGetAccountBundle(userId))!;
}

export async function sbRemoveAvatarUpload(userId: string): Promise<PlayerAccountBundle> {
  const existing = await sbGetAccountBundle(userId);
  if (!existing) throw new Error('Player profile not found.');

  await sbDeleteOldAvatar(existing.profile.profilePictureUrl);

  await sbRest(`profiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      profile_picture_url: null,
      updated_at: new Date().toISOString(),
    }),
  });

  return (await sbGetAccountBundle(userId))!;
}

export async function sbUnlockWeapon(
  userId: string,
  weaponId: string
): Promise<PlayerAccountBundle> {
  const existing = await sbGetAccountBundle(userId);
  if (!existing) throw new Error('Player profile not found.');
  if (!VALID_WEAPON_IDS.has(weaponId)) throw new Error('Unknown weapon selected.');
  if (existing.profile.inventory.includes(weaponId)) return existing;

  const cost = WEAPON_COSTS[weaponId] ?? 500;
  if (existing.profile.coins < cost) {
    throw new Error(`Not enough coins. Need ${cost} coins to unlock.`);
  }

  const nextInventory = [...existing.profile.inventory, weaponId];
  const nextBadges = [...existing.profile.badges];
  if (nextInventory.length >= 3 && !nextBadges.includes('armory_collector')) {
    nextBadges.push('armory_collector');
  }

  await sbRest(`profiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      coins: existing.profile.coins - cost,
      inventory: nextInventory,
      badges: nextBadges,
      updated_at: new Date().toISOString(),
    }),
  });

  return (await sbGetAccountBundle(userId))!;
}

export async function sbRecordMatchResult(
  userId: string,
  payload: {
    mode: GameMode;
    outcome: 'victory' | 'defeat';
    kills: number;
    deaths: number;
    score: number;
    durationSec: number;
    participants: MatchParticipantResult[];
  }
): Promise<{ bundle: PlayerAccountBundle; match: MatchRecord }> {
  const existing = await sbGetAccountBundle(userId);
  if (!existing) throw new Error('Player profile not found.');

  const { profile, stats } = existing;
  const kills = Math.max(0, Math.min(999, Math.round(Number(payload.kills) || 0)));
  const deaths = Math.max(0, Math.min(99, Math.round(Number(payload.deaths) || 0)));
  const score = Math.max(0, Math.min(50000, Math.round(Number(payload.score) || 0)));
  const durationSec = Math.max(5, Math.min(3600, Math.round(Number(payload.durationSec) || 60)));
  const outcome = payload.outcome === 'victory' ? 'victory' : 'defeat';
  const allowedModes: GameMode[] = [
    '1v1_duel',
    'zombie_survival',
    'training_range',
    'skirmish_3v3',
    'solo_survival',
  ];
  const mode: GameMode = allowedModes.includes(payload.mode) ? payload.mode : '1v1_duel';

  const coinsEarned =
    mode === 'zombie_survival'
      ? (outcome === 'victory' ? 220 : 65) + Math.min(120, kills) * 8
      : (outcome === 'victory' ? 180 : 75) + Math.min(30, kills) * 22;
  const xpEarned =
    mode === 'zombie_survival'
      ? (outcome === 'victory' ? 180 : 55) + Math.min(120, kills) * 7
      : (outcome === 'victory' ? 140 : 60) + Math.min(30, kills) * 18;

  const nextKills = stats.totalKills + kills;
  const nextDeaths = stats.totalDeaths + deaths;
  const nextWins = stats.totalWins + (outcome === 'victory' ? 1 : 0);
  const nextLosses = stats.totalLosses + (outcome === 'defeat' ? 1 : 0);
  const nextMatches = stats.totalMatchesPlayed + 1;
  const nextWinRate = Number(((nextWins / nextMatches) * 100).toFixed(1));

  let nextXp = profile.xp + xpEarned;
  let nextLevel = profile.level;
  while (nextXp >= 250 + (nextLevel - 1) * 150) {
    nextXp -= 250 + (nextLevel - 1) * 150;
    nextLevel += 1;
  }

  const nextBadges = [...profile.badges];
  if (outcome === 'victory' && !nextBadges.includes('first_victory')) {
    nextBadges.push('first_victory');
  }
  if (kills >= 6 && !nextBadges.includes('sharpshooter')) {
    nextBadges.push('sharpshooter');
  }
  if (nextMatches >= 5 && !nextBadges.includes('veteran')) {
    nextBadges.push('veteran');
  }
  if (outcome === 'victory' && deaths === 0 && !nextBadges.includes('unstoppable')) {
    nextBadges.push('unstoppable');
  }

  const sanitizedParticipants: MatchParticipantResult[] = Array.isArray(payload.participants)
    ? payload.participants.slice(0, 10).map((p) => ({
        playerId: String(p.playerId ?? '').slice(0, 20),
        username: String(p.username ?? 'Operative').slice(0, 24),
        displayName: String(p.displayName ?? p.username ?? 'Operative').slice(0, 28),
        profilePictureUrl: p.isUser ? profile.profilePictureUrl : p.profilePictureUrl ?? null,
        selectedAvatarId: p.isUser
          ? profile.selectedAvatarId
          : String(p.selectedAvatarId ?? 'vanguard'),
        profileThemeId: p.isUser
          ? profile.profileThemeId
          : String(p.profileThemeId ?? 'obsidian_steel'),
        level: Number(p.level) || 1,
        characterId: String(p.characterId ?? 'vanguard'),
        weaponId: String(p.weaponId ?? 'pulse_rifle'),
        team: p.team === 'rivals' ? 'rivals' : 'allies',
        kills: Math.max(0, Math.min(99, Number(p.kills) || 0)),
        deaths: Math.max(0, Math.min(99, Number(p.deaths) || 0)),
        score: Math.max(0, Math.min(20000, Number(p.score) || 0)),
        isUser: Boolean(p.isUser),
      }))
    : [];

  const nowIso = new Date().toISOString();
  const uid = encodeURIComponent(userId);

  const [insertedMatches] = await Promise.all([
    sbRest<DbMatchRow[]>('matches', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId,
        mode,
        outcome,
        kills,
        deaths,
        score,
        coins_earned: coinsEarned,
        xp_earned: xpEarned,
        duration_sec: durationSec,
        participants: sanitizedParticipants,
        played_at: nowIso,
      }),
    }),
    sbRest(`player_statistics?user_id=eq.${uid}`, {
      method: 'PATCH',
      body: JSON.stringify({
        total_kills: nextKills,
        total_deaths: nextDeaths,
        total_wins: nextWins,
        total_losses: nextLosses,
        total_matches_played: nextMatches,
        win_rate: nextWinRate,
        updated_at: nowIso,
      }),
    }),
    sbRest(`profiles?user_id=eq.${uid}`, {
      method: 'PATCH',
      body: JSON.stringify({
        coins: profile.coins + coinsEarned,
        xp: nextXp,
        level: nextLevel,
        badges: nextBadges,
        updated_at: nowIso,
      }),
    }),
  ]);

  const bundle = (await sbGetAccountBundle(userId))!;
  const match = mapMatchRow(insertedMatches[0]);
  return { bundle, match };
}

export async function sbGetRegisteredPlayers(limit = 20): Promise<PublicPlayerInfo[]> {
  const [profiles, statsRows] = await Promise.all([
    sbRest<DbProfileRow[]>(
      `profiles?order=level.desc,created_at.desc&limit=${Math.max(1, Math.min(50, limit))}`
    ),
    sbRest<DbStatsRow[]>('player_statistics'),
  ]);

  const statsMap = new Map<string, DbStatsRow>(statsRows.map((s) => [s.user_id, s]));

  return profiles
    .map((p) => {
      const s = statsMap.get(p.user_id);
      if (!s) return null;
      const mappedProfile = mapProfileRow(p);
      const mappedStats = mapStatsRow(s);
      const { userId: _u1, ...safeProfile } = mappedProfile;
      const { userId: _u2, ...safeStats } = mappedStats;
      return {
        isBot: false,
        profile: safeProfile,
        stats: safeStats,
      } satisfies PublicPlayerInfo;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.profile.level - a.profile.level || b.stats.totalKills - a.stats.totalKills);
}

export async function sbGetPublicPlayerByPlayerId(
  playerId: string
): Promise<PublicPlayerInfo | null> {
  const profiles = await sbRest<DbProfileRow[]>(
    `profiles?player_id=eq.${encodeURIComponent(playerId)}&limit=1`
  );
  const p = profiles[0];
  if (!p) return null;

  const statsRows = await sbRest<DbStatsRow[]>(
    `player_statistics?user_id=eq.${encodeURIComponent(p.user_id)}&limit=1`
  );
  const s = statsRows[0];
  if (!s) return null;

  const { userId: _u1, ...safeProfile } = mapProfileRow(p);
  const { userId: _u2, ...safeStats } = mapStatsRow(s);
  return {
    isBot: false,
    profile: safeProfile,
    stats: safeStats,
  };
}
