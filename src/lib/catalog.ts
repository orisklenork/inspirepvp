import type {
  AvatarOption,
  BadgeOption,
  CharacterOption,
  ProfileBackgroundOption,
  ProfileThemeOption,
  WeaponOption,
} from '../types/game.ts';

export const ARENA_KEY_ART_URL = '/src/assets/images/arena_key_art_1795260605488.jpg';
export const FOUNDRY_BG_URL = '/src/assets/images/bg_foundry_1795260605168.jpg';

export const DEFAULT_AVATARS: AvatarOption[] = [
  {
    id: 'vanguard',
    name: 'Vanguard Zero',
    role: 'Assault Lead',
    imageUrl: '/src/assets/images/avatar_vanguard_1795260605387.jpg',
    accentColor: '#F59E0B',
  },
  {
    id: 'specter',
    name: 'Specter Recon',
    role: 'Long-Range Scout',
    imageUrl: '/src/assets/images/avatar_specter_1795260605096.jpg',
    accentColor: '#38BDF8',
  },
  {
    id: 'bastion',
    name: 'Bastion Heavy',
    role: 'Armored Breacher',
    imageUrl: '/src/assets/images/avatar_bastion_1795260605626.jpg',
    accentColor: '#D97706',
  },
  {
    id: 'medic',
    name: 'Triage Specialist',
    role: 'Field Support',
    imageUrl: '/src/assets/images/avatar_medic_1795260604956.jpg',
    accentColor: '#10B981',
  },
  {
    id: 'emblem_amber',
    name: 'Apex Crest',
    role: 'Tactical Insignia',
    imageUrl: null,
    accentColor: '#F59E0B',
  },
  {
    id: 'emblem_steel',
    name: 'Iron Sentinel',
    role: 'Division Crest',
    imageUrl: null,
    accentColor: '#94A3B8',
  },
];

export const CHARACTERS: CharacterOption[] = [
  {
    id: 'vanguard',
    name: 'Vanguard',
    title: 'Balanced Striker',
    description: 'Versatile frontline frame with balanced armor plating and rapid tactical dash recovery.',
    maxHp: 110,
    moveSpeed: 245,
    dashCooldownMs: 1450,
    accentColor: '#F59E0B',
  },
  {
    id: 'specter',
    name: 'Specter',
    title: 'Agile Recon',
    description: 'Lightweight carbon chassis built for high-velocity flanking and frequent evasive dashes.',
    maxHp: 95,
    moveSpeed: 278,
    dashCooldownMs: 1150,
    accentColor: '#38BDF8',
  },
  {
    id: 'bastion',
    name: 'Bastion',
    title: 'Armored Enforcer',
    description: 'Reinforced ballistic plating that absorbs sustained fire while holding central lanes.',
    maxHp: 140,
    moveSpeed: 215,
    dashCooldownMs: 1850,
    accentColor: '#D97706',
  },
  {
    id: 'medic',
    name: 'Triage',
    title: 'Field Tactician',
    description: 'Adaptive combat rig with steady agility and enhanced emergency plating.',
    maxHp: 120,
    moveSpeed: 238,
    dashCooldownMs: 1500,
    accentColor: '#10B981',
  },
];

export const WEAPONS: WeaponOption[] = [
  {
    id: 'pulse_rifle',
    name: 'VX-7 Pulse Rifle',
    category: 'Assault Rifle',
    damage: 22,
    fireRateMs: 145,
    magSize: 28,
    reloadMs: 1100,
    projectileSpeed: 940,
    pellets: 1,
    spreadRad: 0.035,
    rangePx: 720,
    costCoins: 0,
    description: 'Reliable automatic rifle with crisp accuracy and steady stopping power.',
  },
  {
    id: 'tactical_sidearm',
    name: 'K-9 Tactical Sidearm',
    category: 'Precision Pistol',
    damage: 32,
    fireRateMs: 240,
    magSize: 14,
    reloadMs: 850,
    projectileSpeed: 1020,
    pellets: 1,
    spreadRad: 0.015,
    rangePx: 680,
    costCoins: 0,
    description: 'High-caliber backup pistol with fast reload and pinpoint single-shot control.',
  },
  {
    id: 'valkyrie_smg',
    name: 'Valkyrie Vector SMG',
    category: 'Submachine Gun',
    damage: 15,
    fireRateMs: 88,
    magSize: 38,
    reloadMs: 1050,
    projectileSpeed: 860,
    pellets: 1,
    spreadRad: 0.075,
    rangePx: 540,
    costCoins: 450,
    description: 'Rapid-fire close-quarters shredder engineered for aggressive rush plays.',
  },
  {
    id: 'scatter_cannon',
    name: 'Breacher SG-12',
    category: 'Combat Shotgun',
    damage: 16,
    fireRateMs: 580,
    magSize: 8,
    reloadMs: 1350,
    projectileSpeed: 820,
    pellets: 6,
    spreadRad: 0.22,
    rangePx: 360,
    costCoins: 650,
    description: 'Six-pellet tactical scattergun devastating around tight cover corners.',
  },
  {
    id: 'rail_carbine',
    name: 'Helios Rail Carbine',
    category: 'Marksman Rifle',
    damage: 58,
    fireRateMs: 490,
    magSize: 10,
    reloadMs: 1400,
    projectileSpeed: 1380,
    pellets: 1,
    spreadRad: 0.006,
    rangePx: 980,
    costCoins: 900,
    description: 'Hyper-velocity electromagnetic marksman rifle that punches across the arena.',
  },
];

export const PROFILE_BACKGROUNDS: ProfileBackgroundOption[] = [
  {
    id: 'foundry_hangar',
    name: 'Foundry Armory',
    imageUrl: FOUNDRY_BG_URL,
    gradientClass: 'from-[#141B26] via-[#1B2433] to-[#0E131D]',
  },
  {
    id: 'sector_courtyard',
    name: 'Sector A Courtyard',
    imageUrl: ARENA_KEY_ART_URL,
    gradientClass: 'from-[#161C24] via-[#1E2634] to-[#0B0F17]',
  },
  {
    id: 'obsidian_grid',
    name: 'Obsidian Tactical Grid',
    imageUrl: null,
    gradientClass: 'from-[#0F172A] via-[#172033] to-[#0B0F17]',
  },
  {
    id: 'amber_bunker',
    name: 'Amber Command Deck',
    imageUrl: null,
    gradientClass: 'from-[#231910] via-[#1B1715] to-[#0B0F17]',
  },
  {
    id: 'emerald_recon',
    name: 'Recon Night Ops',
    imageUrl: null,
    gradientClass: 'from-[#0D211B] via-[#111D20] to-[#0B0F17]',
  },
];

export const PROFILE_THEMES: ProfileThemeOption[] = [
  {
    id: 'amber_vanguard',
    name: 'Amber Vanguard',
    ringClass: 'ring-2 ring-amber-400',
    borderClass: 'border-amber-500/40',
    accentHex: '#F59E0B',
    badgeTextClass: 'text-amber-300',
    surfaceTintClass: 'bg-amber-500/10',
  },
  {
    id: 'obsidian_steel',
    name: 'Obsidian Steel',
    ringClass: 'ring-2 ring-slate-400',
    borderClass: 'border-slate-500/40',
    accentHex: '#94A3B8',
    badgeTextClass: 'text-slate-300',
    surfaceTintClass: 'bg-slate-500/10',
  },
  {
    id: 'emerald_recon',
    name: 'Emerald Recon',
    ringClass: 'ring-2 ring-emerald-400',
    borderClass: 'border-emerald-500/40',
    accentHex: '#10B981',
    badgeTextClass: 'text-emerald-300',
    surfaceTintClass: 'bg-emerald-500/10',
  },
  {
    id: 'sky_interceptor',
    name: 'Sky Interceptor',
    ringClass: 'ring-2 ring-sky-400',
    borderClass: 'border-sky-500/40',
    accentHex: '#38BDF8',
    badgeTextClass: 'text-sky-300',
    surfaceTintClass: 'bg-sky-500/10',
  },
  {
    id: 'crimson_ace',
    name: 'Crimson Ace',
    ringClass: 'ring-2 ring-rose-400',
    borderClass: 'border-rose-500/40',
    accentHex: '#F43F5E',
    badgeTextClass: 'text-rose-300',
    surfaceTintClass: 'bg-rose-500/10',
  },
];

export const BADGES: BadgeOption[] = [
  {
    id: 'recruit',
    name: 'Active Operative',
    description: 'Enlisted and verified combat profile.',
    tier: 'Standard',
  },
  {
    id: 'first_victory',
    name: 'First Victory',
    description: 'Secured your first arena match win.',
    tier: 'Standard',
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Achieved 6 or more eliminations in a single match.',
    tier: 'Elite',
  },
  {
    id: 'veteran',
    name: 'Arena Veteran',
    description: 'Completed 5 or more total arena matches.',
    tier: 'Elite',
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: 'Finished a winning match with zero deaths.',
    tier: 'Apex',
  },
  {
    id: 'armory_collector',
    name: 'Armory Collector',
    description: 'Unlocked 3 or more tactical weapons in your inventory.',
    tier: 'Elite',
  },
];

export function getXpForNextLevel(level: number): number {
  return 250 + (level - 1) * 150;
}

export function getAvatarById(id: string): AvatarOption {
  return DEFAULT_AVATARS.find((a) => a.id === id) ?? DEFAULT_AVATARS[0];
}

export function getCharacterById(id: string): CharacterOption {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export function getWeaponById(id: string): WeaponOption {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
}

export function getBackgroundById(id: string): ProfileBackgroundOption {
  return PROFILE_BACKGROUNDS.find((b) => b.id === id) ?? PROFILE_BACKGROUNDS[0];
}

export function getThemeById(id: string): ProfileThemeOption {
  return PROFILE_THEMES.find((t) => t.id === id) ?? PROFILE_THEMES[0];
}

export function getBadgeById(id: string): BadgeOption | undefined {
  return BADGES.find((b) => b.id === id);
}
