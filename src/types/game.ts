export type GameMode = 'skirmish_3v3' | 'solo_survival';

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
