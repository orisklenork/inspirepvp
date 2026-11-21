import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  GameMode,
  MatchParticipantResult,
  MatchRecord,
  PlayerAccountBundle,
  PlayerProfile,
  PlayerStatistics,
  PublicPlayerInfo,
} from '../src/types/game.ts';

export interface UsernameRegistryEntry {
  userId: string;
  username: string;
  usernameLower: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

interface SessionEntry {
  tokenHash: string;
  userId: string;
  expiresAt: number;
  createdAt: string;
}

interface DatabaseState {
  username_registry: Record<string, UsernameRegistryEntry>; // keyed by userId
  profiles: Record<string, PlayerProfile>; // keyed by userId
  player_statistics: Record<string, PlayerStatistics>; // keyed by userId
  matches: Record<string, MatchRecord[]>; // keyed by userId
  sessions: Record<string, SessionEntry>; // keyed by tokenHash
}

const DATA_DIR = process.env.VERCEL
  ? path.resolve('/tmp', 'inspiredpvp-data')
  : path.resolve(process.cwd(), 'data');
export const AVATARS_DIR = path.resolve(DATA_DIR, 'avatars');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

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
  'tactical_sidearm',
  'valkyrie_smg',
  'scatter_cannon',
  'rail_carbine',
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
  tactical_sidearm: 0,
  valkyrie_smg: 450,
  scatter_cannon: 650,
  rail_carbine: 900,
};

export function getRegisteredPlayers(limit = 20): PublicPlayerInfo[] {
  const db = getDb();
  return Object.values(db.profiles)
    .map((profile) => {
      const stats = db.player_statistics[profile.userId];
      if (!stats) return null;
      const { userId: _u1, ...safeProfile } = profile;
      const { userId: _u2, ...safeStats } = stats;
      return {
        isBot: false,
        profile: safeProfile,
        stats: safeStats,
      } satisfies PublicPlayerInfo;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.profile.level - a.profile.level || b.stats.totalKills - a.stats.totalKills)
    .slice(0, limit);
}

function ensureStorageDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

function loadDatabase(): DatabaseState {
  ensureStorageDirs();
  if (!fs.existsSync(DB_FILE)) {
    const empty: DatabaseState = {
      username_registry: {},
      profiles: {},
      player_statistics: {},
      matches: {},
      sessions: {},
    };
    saveDatabase(empty);
    return empty;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DatabaseState>;
    return {
      username_registry: parsed.username_registry ?? {},
      profiles: parsed.profiles ?? {},
      player_statistics: parsed.player_statistics ?? {},
      matches: parsed.matches ?? {},
      sessions: parsed.sessions ?? {},
    };
  } catch {
    return {
      username_registry: {},
      profiles: {},
      player_statistics: {},
      matches: {},
      sessions: {},
    };
  }
}

function saveDatabase(state: DatabaseState): void {
  ensureStorageDirs();
  const tmpFile = `${DB_FILE}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

let dbInstance: DatabaseState | null = null;

function getDb(): DatabaseState {
  if (!dbInstance) {
    dbInstance = loadDatabase();
  }
  return dbInstance;
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const derived = crypto.scryptSync(password, storedSalt, 64);
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (derived.length !== storedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, storedBuf);
}

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateUniquePlayerId(): string {
  const db = getDb();
  const existingIds = new Set<string>(Object.values(db.profiles).map((p) => p.playerId));
  for (let i = 0; i < 100; i++) {
    const num = crypto.randomInt(100000, 999999);
    const candidate = `IP-${num}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }
  return `IP-${Date.now().toString().slice(-6)}`;
}

export function validateUsernameFormat(username: string): string | null {
  if (typeof username !== 'string') {
    return 'Username is required.';
  }
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return 'Username must be between 3 and 20 characters.';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return 'Username can only contain letters, numbers, and underscores.';
  }
  return null;
}

export function isUsernameAvailable(username: string, excludeUserId?: string): boolean {
  const db = getDb();
  const lower = username.trim().toLowerCase();
  return !Object.values(db.username_registry).some(
    (entry) => entry.usernameLower === lower && entry.userId !== excludeUserId
  );
}

export function getAccountBundle(userId: string): PlayerAccountBundle | null {
  const db = getDb();
  const profile = db.profiles[userId];
  const stats = db.player_statistics[userId];
  if (!profile || !stats) {
    return null;
  }
  const recentMatches = (db.matches[userId] ?? []).slice(0, 20);
  return { profile, stats, recentMatches };
}

export function createSession(userId: string, rememberMe: boolean): { token: string; maxAgeSec?: number } {
  const db = getDb();
  const now = Date.now();
  for (const [key, session] of Object.entries(db.sessions)) {
    if (session.expiresAt < now) {
      delete db.sessions[key];
    }
  }
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const maxAgeSec = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  db.sessions[tokenHash] = {
    tokenHash,
    userId,
    expiresAt: now + maxAgeSec * 1000,
    createdAt: new Date(now).toISOString(),
  };
  saveDatabase(db);
  return { token, maxAgeSec: rememberMe ? maxAgeSec : undefined };
}

export function resolveSessionUserId(token: string | undefined): string | null {
  if (!token) {
    return null;
  }
  const db = getDb();
  const tokenHash = hashSessionToken(token);
  const entry = db.sessions[tokenHash];
  if (!entry) {
    return null;
  }
  if (entry.expiresAt < Date.now()) {
    delete db.sessions[tokenHash];
    saveDatabase(db);
    return null;
  }
  return entry.userId;
}

export function revokeSession(token: string | undefined): void {
  if (!token) {
    return;
  }
  const db = getDb();
  const tokenHash = hashSessionToken(token);
  if (db.sessions[tokenHash]) {
    delete db.sessions[tokenHash];
    saveDatabase(db);
  }
}

export function registerAccount(
  rawUsername: string,
  password: string,
  confirmPassword: string
): { bundle: PlayerAccountBundle; session: { token: string; maxAgeSec?: number } } {
  const formatErr = validateUsernameFormat(rawUsername);
  if (formatErr) {
    throw new Error(formatErr);
  }
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
  if (!isUsernameAvailable(username)) {
    throw new Error('That username is already taken. Please choose another.');
  }

  const db = getDb();
  const userId = crypto.randomUUID();
  const playerId = generateUniquePlayerId();
  const nowIso = new Date().toISOString();
  const { hash, salt } = hashPassword(password);

  db.username_registry[userId] = {
    userId,
    username,
    usernameLower: username.toLowerCase(),
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: nowIso,
  };

  db.profiles[userId] = {
    userId,
    playerId,
    username,
    displayName: username,
    profilePictureUrl: null,
    selectedAvatarId: 'vanguard',
    bio: 'Ready for arena deployment.',
    profileBackgroundId: 'foundry_hangar',
    profileThemeId: 'amber_vanguard',
    favoriteWeaponId: 'pulse_rifle',
    selectedCharacterId: 'vanguard',
    badges: ['recruit'],
    showcaseBadges: ['recruit'],
    inventory: ['pulse_rifle', 'tactical_sidearm'],
    coins: 1000,
    level: 1,
    xp: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  db.player_statistics[userId] = {
    userId,
    totalKills: 0,
    totalDeaths: 0,
    totalWins: 0,
    totalLosses: 0,
    totalMatchesPlayed: 0,
    winRate: 0,
    updatedAt: nowIso,
  };

  db.matches[userId] = [];

  const session = createSession(userId, true);
  saveDatabase(db);

  const bundle = getAccountBundle(userId);
  if (!bundle) {
    throw new Error('Failed to initialize player profile.');
  }
  return { bundle, session };
}

export function authenticateUser(
  rawUsername: string,
  password: string,
  rememberMe: boolean
): { bundle: PlayerAccountBundle; session: { token: string; maxAgeSec?: number } } {
  if (typeof rawUsername !== 'string' || typeof password !== 'string') {
    throw new Error('Username and password are required.');
  }
  const lower = rawUsername.trim().toLowerCase();
  if (!lower || !password) {
    throw new Error('Please enter both your username and password.');
  }

  const db = getDb();
  const entry = Object.values(db.username_registry).find((u) => u.usernameLower === lower);
  if (!entry || !verifyPassword(password, entry.passwordHash, entry.passwordSalt)) {
    throw new Error('Invalid username or password.');
  }

  const bundle = getAccountBundle(entry.userId);
  if (!bundle) {
    throw new Error('Player profile could not be loaded.');
  }

  const session = createSession(entry.userId, Boolean(rememberMe));
  return { bundle, session };
}

export function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): void {
  const db = getDb();
  const entry = db.username_registry[userId];
  if (!entry) {
    throw new Error('Account not found.');
  }
  if (!currentPassword || !verifyPassword(currentPassword, entry.passwordHash, entry.passwordSalt)) {
    throw new Error('Current password is incorrect.');
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }
  if (newPassword.length > 128) {
    throw new Error('New password cannot exceed 128 characters.');
  }
  if (newPassword !== confirmNewPassword) {
    throw new Error('New passwords do not match.');
  }
  const { hash, salt } = hashPassword(newPassword);
  entry.passwordHash = hash;
  entry.passwordSalt = salt;
  saveDatabase(db);
}

export interface ProfileUpdateInput {
  username?: string;
  displayName?: string;
  bio?: string;
  selectedAvatarId?: string;
  profileBackgroundId?: string;
  profileThemeId?: string;
  favoriteWeaponId?: string;
  selectedCharacterId?: string;
  showcaseBadges?: string[];
}

export function updateProfile(userId: string, input: ProfileUpdateInput): PlayerAccountBundle {
  const db = getDb();
  const profile = db.profiles[userId];
  const registry = db.username_registry[userId];
  if (!profile || !registry) {
    throw new Error('Player profile not found.');
  }

  if (typeof input.username === 'string') {
    const trimmed = input.username.trim();
    if (trimmed !== profile.username) {
      const err = validateUsernameFormat(trimmed);
      if (err) {
        throw new Error(err);
      }
      if (!isUsernameAvailable(trimmed, userId)) {
        throw new Error('That username is already taken.');
      }
      registry.username = trimmed;
      registry.usernameLower = trimmed.toLowerCase();
      profile.username = trimmed;
    }
  }

  if (typeof input.displayName === 'string') {
    const clean = input.displayName.trim().slice(0, 28);
    if (clean.length < 2) {
      throw new Error('Display name must be at least 2 characters.');
    }
    profile.displayName = clean;
  }

  if (typeof input.bio === 'string') {
    profile.bio = input.bio.trim().slice(0, 220);
  }

  if (typeof input.selectedAvatarId === 'string' && VALID_AVATAR_IDS.has(input.selectedAvatarId)) {
    profile.selectedAvatarId = input.selectedAvatarId;
  }

  if (typeof input.profileBackgroundId === 'string' && VALID_BACKGROUND_IDS.has(input.profileBackgroundId)) {
    profile.profileBackgroundId = input.profileBackgroundId;
  }

  if (typeof input.profileThemeId === 'string' && VALID_THEME_IDS.has(input.profileThemeId)) {
    profile.profileThemeId = input.profileThemeId;
  }

  if (typeof input.selectedCharacterId === 'string' && VALID_CHARACTER_IDS.has(input.selectedCharacterId)) {
    profile.selectedCharacterId = input.selectedCharacterId;
  }

  if (typeof input.favoriteWeaponId === 'string' && VALID_WEAPON_IDS.has(input.favoriteWeaponId)) {
    if (profile.inventory.includes(input.favoriteWeaponId)) {
      profile.favoriteWeaponId = input.favoriteWeaponId;
    }
  }

  if (Array.isArray(input.showcaseBadges)) {
    const validOwned = input.showcaseBadges
      .filter((b): b is string => typeof b === 'string' && profile.badges.includes(b))
      .slice(0, 3);
    profile.showcaseBadges = validOwned;
  }

  profile.updatedAt = new Date().toISOString();
  saveDatabase(db);
  return getAccountBundle(userId)!;
}

function detectImageType(buffer: Buffer): { ext: 'jpg' | 'png' | 'webp' } | null {
  if (buffer.length < 16) {
    return null;
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
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
    return { ext: 'png' };
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp' };
  }
  return null;
}

function deleteOldAvatarFile(profilePictureUrl: string | null): void {
  if (!profilePictureUrl || !profilePictureUrl.startsWith('/api/storage/avatars/')) {
    return;
  }
  const filename = path.basename(profilePictureUrl);
  if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(filename)) {
    return;
  }
  const resolved = path.resolve(AVATARS_DIR, filename);
  if (!resolved.startsWith(AVATARS_DIR + path.sep)) {
    return;
  }
  if (fs.existsSync(resolved)) {
    try {
      fs.unlinkSync(resolved);
    } catch {
      // Ignore cleanup errors
    }
  }
}

export function saveAvatarUpload(userId: string, dataUrl: string): PlayerAccountBundle {
  const db = getDb();
  const profile = db.profiles[userId];
  if (!profile) {
    throw new Error('Player profile not found.');
  }
  if (typeof dataUrl !== 'string') {
    throw new Error('Invalid image payload.');
  }
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

  ensureStorageDirs();
  const filename = `avatar_${crypto.randomUUID()}.${detected.ext}`;
  const targetPath = path.resolve(AVATARS_DIR, filename);
  if (!targetPath.startsWith(AVATARS_DIR + path.sep)) {
    throw new Error('Invalid storage path.');
  }

  fs.writeFileSync(targetPath, buffer);
  deleteOldAvatarFile(profile.profilePictureUrl);

  profile.profilePictureUrl = `/api/storage/avatars/${filename}`;
  profile.updatedAt = new Date().toISOString();
  saveDatabase(db);
  return getAccountBundle(userId)!;
}

export function removeAvatarUpload(userId: string): PlayerAccountBundle {
  const db = getDb();
  const profile = db.profiles[userId];
  if (!profile) {
    throw new Error('Player profile not found.');
  }
  deleteOldAvatarFile(profile.profilePictureUrl);
  profile.profilePictureUrl = null;
  profile.updatedAt = new Date().toISOString();
  saveDatabase(db);
  return getAccountBundle(userId)!;
}

export function unlockWeapon(userId: string, weaponId: string): PlayerAccountBundle {
  const db = getDb();
  const profile = db.profiles[userId];
  if (!profile) {
    throw new Error('Player profile not found.');
  }
  if (!VALID_WEAPON_IDS.has(weaponId)) {
    throw new Error('Unknown weapon selected.');
  }
  if (profile.inventory.includes(weaponId)) {
    return getAccountBundle(userId)!;
  }
  const cost = WEAPON_COSTS[weaponId] ?? 500;
  if (profile.coins < cost) {
    throw new Error(`Not enough coins. Need ${cost} coins to unlock.`);
  }
  profile.coins -= cost;
  profile.inventory.push(weaponId);
  if (profile.inventory.length >= 3 && !profile.badges.includes('armory_collector')) {
    profile.badges.push('armory_collector');
  }
  profile.updatedAt = new Date().toISOString();
  saveDatabase(db);
  return getAccountBundle(userId)!;
}

export function recordMatchResult(
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
): { bundle: PlayerAccountBundle; match: MatchRecord } {
  const db = getDb();
  const profile = db.profiles[userId];
  const stats = db.player_statistics[userId];
  if (!profile || !stats) {
    throw new Error('Player profile not found.');
  }

  const kills = Math.max(0, Math.min(99, Math.round(Number(payload.kills) || 0)));
  const deaths = Math.max(0, Math.min(99, Math.round(Number(payload.deaths) || 0)));
  const score = Math.max(0, Math.min(20000, Math.round(Number(payload.score) || 0)));
  const durationSec = Math.max(5, Math.min(3600, Math.round(Number(payload.durationSec) || 60)));
  const outcome = payload.outcome === 'victory' ? 'victory' : 'defeat';
  const allowedModes: GameMode[] = ['1v1_duel', 'training_range', 'skirmish_3v3', 'solo_survival'];
  const mode: GameMode = allowedModes.includes(payload.mode) ? payload.mode : '1v1_duel';

  const coinsEarned = (outcome === 'victory' ? 180 : 75) + kills * 22;
  const xpEarned = (outcome === 'victory' ? 140 : 60) + kills * 18;

  stats.totalKills += kills;
  stats.totalDeaths += deaths;
  if (outcome === 'victory') {
    stats.totalWins += 1;
  } else {
    stats.totalLosses += 1;
  }
  stats.totalMatchesPlayed += 1;
  stats.winRate =
    stats.totalMatchesPlayed > 0
      ? Number(((stats.totalWins / stats.totalMatchesPlayed) * 100).toFixed(1))
      : 0;
  stats.updatedAt = new Date().toISOString();

  profile.coins += coinsEarned;
  profile.xp += xpEarned;

  while (profile.xp >= 250 + (profile.level - 1) * 150) {
    profile.xp -= 250 + (profile.level - 1) * 150;
    profile.level += 1;
  }

  if (outcome === 'victory' && !profile.badges.includes('first_victory')) {
    profile.badges.push('first_victory');
  }
  if (kills >= 6 && !profile.badges.includes('sharpshooter')) {
    profile.badges.push('sharpshooter');
  }
  if (stats.totalMatchesPlayed >= 5 && !profile.badges.includes('veteran')) {
    profile.badges.push('veteran');
  }
  if (outcome === 'victory' && deaths === 0 && !profile.badges.includes('unstoppable')) {
    profile.badges.push('unstoppable');
  }

  profile.updatedAt = new Date().toISOString();

  const sanitizedParticipants: MatchParticipantResult[] = Array.isArray(payload.participants)
    ? payload.participants.slice(0, 10).map((p) => ({
        playerId: String(p.playerId ?? '').slice(0, 20),
        username: String(p.username ?? 'Operative').slice(0, 24),
        displayName: String(p.displayName ?? p.username ?? 'Operative').slice(0, 28),
        profilePictureUrl: p.isUser ? profile.profilePictureUrl : null,
        selectedAvatarId: p.isUser ? profile.selectedAvatarId : String(p.selectedAvatarId ?? 'vanguard'),
        profileThemeId: p.isUser ? profile.profileThemeId : String(p.profileThemeId ?? 'obsidian_steel'),
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

  const match: MatchRecord = {
    id: crypto.randomUUID(),
    mode,
    outcome,
    kills,
    deaths,
    score,
    coinsEarned,
    xpEarned,
    durationSec,
    playedAt: new Date().toISOString(),
    participants: sanitizedParticipants,
  };

  if (!db.matches[userId]) {
    db.matches[userId] = [];
  }
  db.matches[userId].unshift(match);
  db.matches[userId] = db.matches[userId].slice(0, 25);

  saveDatabase(db);
  return { bundle: getAccountBundle(userId)!, match };
}

export function getPublicPlayerByPlayerId(playerId: string): PublicPlayerInfo | null {
  const db = getDb();
  const profile = Object.values(db.profiles).find((p) => p.playerId === playerId);
  if (!profile) {
    return null;
  }
  const stats = db.player_statistics[profile.userId];
  if (!stats) {
    return null;
  }
  const { userId: _u1, ...safeProfile } = profile;
  const { userId: _u2, ...safeStats } = stats;
  return {
    isBot: false,
    profile: safeProfile,
    stats: safeStats,
  };
}
