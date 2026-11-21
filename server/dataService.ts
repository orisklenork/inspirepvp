import crypto from 'node:crypto';
import type {
  GameMode,
  MatchParticipantResult,
  MatchRecord,
  PlayerAccountBundle,
  PublicPlayerInfo,
} from '../src/types/game.ts';
import {
  authenticateUser,
  changePassword,
  createSession,
  getAccountBundle,
  getPublicPlayerByPlayerId,
  getRegisteredPlayers,
  isUsernameAvailable,
  recordMatchResult,
  registerAccount,
  removeAvatarUpload,
  resolveSessionUserId,
  revokeSession,
  saveAvatarUpload,
  unlockWeapon,
  updateProfile,
  validateUsernameFormat,
  type ProfileUpdateInput,
} from './store.ts';
import {
  isSupabaseConfigured,
  sbAuthenticateUser,
  sbChangePassword,
  sbGetAccountBundle,
  sbGetPublicPlayerByPlayerId,
  sbGetRegisteredPlayers,
  sbIsUsernameAvailable,
  sbRecordMatchResult,
  sbRegisterAccount,
  sbRemoveAvatarUpload,
  sbSaveAvatarUpload,
  sbUnlockWeapon,
  sbUpdateProfile,
} from './supabaseStore.ts';

const EPHEMERAL_FALLBACK_KEY = crypto.randomBytes(32);

function getStatelessKey(): Buffer {
  const raw =
    process.env.SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  if (!raw) {
    return EPHEMERAL_FALLBACK_KEY;
  }
  return crypto.createHash('sha256').update(`inspiredpvp-session:${raw}`).digest();
}

function sealStatelessSession(userId: string, rememberMe: boolean): {
  token: string;
  maxAgeSec?: number;
} {
  const maxAgeSec = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  const exp = Date.now() + maxAgeSec * 1000;
  const payload = JSON.stringify({ u: userId, e: exp });
  const key = getStatelessKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const token = `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  return { token, maxAgeSec: rememberMe ? maxAgeSec : undefined };
}

function openStatelessSession(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const encrypted = Buffer.from(parts[2], 'base64url');
    const key = getStatelessKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted) as { u?: string; e?: number };
    if (!parsed.u || !parsed.e || parsed.e < Date.now()) {
      return null;
    }
    return parsed.u;
  } catch {
    return null;
  }
}

export async function dataCheckUsername(
  username: string,
  excludeUserId?: string
): Promise<{ available: boolean; valid: boolean; message: string }> {
  const formatError = validateUsernameFormat(username);
  if (formatError) {
    return { available: false, valid: false, message: formatError };
  }
  const available = isSupabaseConfigured()
    ? await sbIsUsernameAvailable(username, excludeUserId)
    : isUsernameAvailable(username, excludeUserId);
  return {
    available,
    valid: true,
    message: available ? 'Username is available.' : 'Username is already taken.',
  };
}

export async function dataResolveSessionUserId(token: string | undefined): Promise<string | null> {
  if (isSupabaseConfigured()) {
    return openStatelessSession(token);
  }
  return resolveSessionUserId(token);
}

export async function dataRevokeSession(token: string | undefined): Promise<void> {
  if (isSupabaseConfigured()) {
    return;
  }
  revokeSession(token);
}

export async function dataGetAccountBundle(userId: string): Promise<PlayerAccountBundle | null> {
  if (isSupabaseConfigured()) {
    return sbGetAccountBundle(userId);
  }
  return getAccountBundle(userId);
}

export async function dataRegisterAccount(
  username: string,
  password: string,
  confirmPassword: string
): Promise<{ bundle: PlayerAccountBundle; session: { token: string; maxAgeSec?: number } }> {
  if (isSupabaseConfigured()) {
    const { bundle, userId } = await sbRegisterAccount(username, password, confirmPassword);
    const session = sealStatelessSession(userId, true);
    return { bundle, session };
  }
  return registerAccount(username, password, confirmPassword);
}

export async function dataAuthenticateUser(
  username: string,
  password: string,
  rememberMe: boolean
): Promise<{ bundle: PlayerAccountBundle; session: { token: string; maxAgeSec?: number } }> {
  if (isSupabaseConfigured()) {
    const { bundle, userId } = await sbAuthenticateUser(username, password);
    const session = sealStatelessSession(userId, rememberMe);
    return { bundle, session };
  }
  return authenticateUser(username, password, rememberMe);
}

export async function dataUpdateProfile(
  userId: string,
  input: ProfileUpdateInput
): Promise<PlayerAccountBundle> {
  if (isSupabaseConfigured()) {
    return sbUpdateProfile(userId, input);
  }
  return updateProfile(userId, input);
}

export async function dataSaveAvatarUpload(
  userId: string,
  imageDataUrl: string
): Promise<PlayerAccountBundle> {
  if (isSupabaseConfigured()) {
    return sbSaveAvatarUpload(userId, imageDataUrl);
  }
  return saveAvatarUpload(userId, imageDataUrl);
}

export async function dataRemoveAvatarUpload(userId: string): Promise<PlayerAccountBundle> {
  if (isSupabaseConfigured()) {
    return sbRemoveAvatarUpload(userId);
  }
  return removeAvatarUpload(userId);
}

export async function dataChangePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    await sbChangePassword(userId, currentPassword, newPassword, confirmNewPassword);
    return;
  }
  changePassword(userId, currentPassword, newPassword, confirmNewPassword);
}

export async function dataUnlockWeapon(
  userId: string,
  weaponId: string
): Promise<PlayerAccountBundle> {
  if (isSupabaseConfigured()) {
    return sbUnlockWeapon(userId, weaponId);
  }
  return unlockWeapon(userId, weaponId);
}

export async function dataRecordMatchResult(
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
  if (isSupabaseConfigured()) {
    return sbRecordMatchResult(userId, payload);
  }
  return recordMatchResult(userId, payload);
}

export async function dataGetRegisteredPlayers(): Promise<PublicPlayerInfo[]> {
  if (isSupabaseConfigured()) {
    return sbGetRegisteredPlayers();
  }
  return getRegisteredPlayers();
}

export async function dataGetPublicPlayer(playerId: string): Promise<PublicPlayerInfo | null> {
  if (isSupabaseConfigured()) {
    return sbGetPublicPlayerByPlayerId(playerId);
  }
  return getPublicPlayerByPlayerId(playerId);
}

export function dataCreateLocalSession(userId: string, rememberMe: boolean) {
  return createSession(userId, rememberMe);
}
