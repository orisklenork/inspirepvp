export type GameMode = '1v1_duel' | 'training_range' | 'skirmish_3v3' | 'solo_survival';

export type AppView =
  | 'lobby'
  | 'playing'
  | 'results'
  | 'profile'
  | 'customize'
  | 'settings';

export interface PlayerProfile {
  userId: string;
  playerId: string;
  username: string;
  displayName: string;
  profilePictureUrl: string | null;
  selectedAvatarId: string;
  bio: string;
  profileBackgroundId: string;
  profileThemeId: string;
  favoriteWeaponId: string;
  selectedCharacterId: string;
  badges: string[];
  showcaseBadges: string[];
  inventory: string[];
  coins: number;
  level: number;
  xp: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerStatistics {
  userId: string;
  totalKills: number;
  totalDeaths: number;
  totalWins: number;
  totalLosses: number;
  totalMatchesPlayed: number;
  winRate: number;
  updatedAt: string;
}

export interface MatchParticipantResult {
  playerId: string;
  username: string;
  displayName: string;
  profilePictureUrl: string | null;
  selectedAvatarId: string;
  profileThemeId: string;
  level: number;
  characterId: string;
  weaponId: string;
  team: 'allies' | 'rivals';
  kills: number;
  deaths: number;
  score: number;
  isUser: boolean;
}

export interface MatchRecord {
  id: string;
  mode: GameMode;
  outcome: 'victory' | 'defeat';
  kills: number;
  deaths: number;
  score: number;
  coinsEarned: number;
  xpEarned: number;
  durationSec: number;
  playedAt: string;
  participants: MatchParticipantResult[];
}

export interface PlayerAccountBundle {
  profile: PlayerProfile;
  stats: PlayerStatistics;
  recentMatches: MatchRecord[];
}

export interface PublicPlayerInfo {
  profile: Omit<PlayerProfile, 'userId'>;
  stats: Omit<PlayerStatistics, 'userId'>;
  isBot?: boolean;
}

export interface OnlinePlayerPresence {
  player: PublicPlayerInfo;
  status: 'online' | 'in_room' | 'in_match';
  currentRoomCode: string | null;
  lastSeenAt: string;
}

export interface RoomParticipant {
  playerId: string;
  username: string;
  displayName: string;
  profilePictureUrl: string | null;
  selectedAvatarId: string;
  profileThemeId: string;
  characterId: string;
  weaponId: string;
  level: number;
  ready: boolean;
  kills: number;
  deaths: number;
}

export interface GameRoom {
  code: string;
  status: 'waiting' | 'playing' | 'finished';
  mode: '1v1_duel';
  maxKills: number;
  host: RoomParticipant;
  guest: RoomParticipant | null;
  winnerPlayerId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string;
}

export interface RoomInvite {
  id: string;
  roomCode: string;
  fromPlayerId: string;
  fromDisplayName: string;
  fromAvatarUrl: string | null;
  toPlayerId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
}

export interface MatchmakingStatus {
  queued: boolean;
  matchedRoomCode: string | null;
  queueCount: number;
}

export interface LiveCombatActorState {
  playerId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
  crouched: boolean;
  sprinting: boolean;
  aiming: boolean;
  reloading: boolean;
  hp: number;
  maxHp: number;
  weaponId: string;
  characterId: string;
  alive: boolean;
  respawnAtMs: number;
  seq: number;
  shotSeq: number;
  shotOrigin?: [number, number, number];
  shotEnd?: [number, number, number];
  updatedAtMs: number;
}

export interface CombatEvent {
  id: string;
  type: 'shot' | 'hit' | 'kill';
  fromPlayerId: string;
  toPlayerId?: string;
  damage?: number;
  headshot?: boolean;
  origin?: [number, number, number];
  end?: [number, number, number];
  ts: number;
}

export interface CombatSyncResponse {
  room: GameRoom;
  selfState: LiveCombatActorState;
  opponentState: LiveCombatActorState | null;
  events: CombatEvent[];
}

export interface AvatarOption {
  id: string;
  name: string;
  role: string;
  imageUrl: string | null;
  accentColor: string;
}

export interface CharacterOption {
  id: string;
  name: string;
  title: string;
  description: string;
  maxHp: number;
  moveSpeed: number;
  dashCooldownMs: number;
  accentColor: string;
}

export interface WeaponOption {
  id: string;
  name: string;
  category: string;
  damage: number;
  fireRateMs: number;
  magSize: number;
  reloadMs: number;
  projectileSpeed: number;
  pellets: number;
  spreadRad: number;
  rangePx: number;
  costCoins: number;
  description: string;
}

export interface ProfileBackgroundOption {
  id: string;
  name: string;
  imageUrl: string | null;
  gradientClass: string;
}

export interface ProfileThemeOption {
  id: string;
  name: string;
  ringClass: string;
  borderClass: string;
  accentHex: string;
  badgeTextClass: string;
  surfaceTintClass: string;
}

export interface BadgeOption {
  id: string;
  name: string;
  description: string;
  tier: 'Standard' | 'Elite' | 'Apex';
}
