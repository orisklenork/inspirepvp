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
    name: 'VX-7 Assault Rifle',
    category: 'Assault Rifle',
    damage: 24,
    fireRateMs: 128,
    magSize: 30,
    reloadMs: 1100,
    projectileSpeed: 980,
    pellets: 1,
    spreadRad: 0.028,
    rangePx: 760,
    costCoins: 0,
    description: 'Standard tactical 5.56mm automatic carbine with balanced recoil and red-dot optics.',
  },
  {
    id: 'phantom_ak',
    name: 'AK-47 Blackout',
    category: 'Assault Rifle',
    damage: 34,
    fireRateMs: 165,
    magSize: 30,
    reloadMs: 1250,
    projectileSpeed: 950,
    pellets: 1,
    spreadRad: 0.036,
    rangePx: 780,
    costCoins: 350,
    description: 'Heavy 7.62mm assault rifle built to punch through armored targets and zombie brutes.',
  },
  {
    id: 'tactical_sidearm',
    name: 'K-9 Tactical Pistol',
    category: 'Pistol',
    damage: 30,
    fireRateMs: 220,
    magSize: 15,
    reloadMs: 820,
    projectileSpeed: 1020,
    pellets: 1,
    spreadRad: 0.016,
    rangePx: 660,
    costCoins: 0,
    description: 'Suppressed special-ops sidearm with instant draw speed and fast tactical reload.',
  },
  {
    id: 'desert_hawk',
    name: 'Deagle .50 Magnum',
    category: 'Pistol',
    damage: 54,
    fireRateMs: 360,
    magSize: 7,
    reloadMs: 1050,
    projectileSpeed: 1120,
    pellets: 1,
    spreadRad: 0.012,
    rangePx: 740,
    costCoins: 300,
    description: 'High-caliber steel hand cannon capable of devastating close-to-mid headshots.',
  },
  {
    id: 'valkyrie_smg',
    name: 'Valkyrie Vector SMG',
    category: 'SMG',
    damage: 16,
    fireRateMs: 78,
    magSize: 40,
    reloadMs: 980,
    projectileSpeed: 880,
    pellets: 1,
    spreadRad: 0.062,
    rangePx: 540,
    costCoins: 450,
    description: 'Rapid-fire submachine gun with blistering 770 RPM burst pressure for close rushes.',
  },
  {
    id: 'scatter_cannon',
    name: 'Breacher SG-12',
    category: 'Shotgun',
    damage: 17,
    fireRateMs: 560,
    magSize: 8,
    reloadMs: 1320,
    projectileSpeed: 820,
    pellets: 7,
    spreadRad: 0.19,
    rangePx: 380,
    costCoins: 600,
    description: 'Seven-pellet pump-action combat shotgun that shreds anything around corners.',
  },
  {
    id: 'rail_carbine',
    name: 'Helios DMR Rail',
    category: 'Sniper',
    damage: 62,
    fireRateMs: 430,
    magSize: 10,
    reloadMs: 1350,
    projectileSpeed: 1380,
    pellets: 1,
    spreadRad: 0.005,
    rangePx: 980,
    costCoins: 850,
    description: 'Semi-automatic precision marksman rifle with 2.4x tactical scope.',
  },
  {
    id: 'awp_viper',
    name: 'AWP Viper Sniper',
    category: 'Sniper',
    damage: 96,
    fireRateMs: 920,
    magSize: 5,
    reloadMs: 1600,
    projectileSpeed: 1600,
    pellets: 1,
    spreadRad: 0.002,
    rangePx: 1200,
    costCoins: 1100,
    description: 'Heavy bolt-action sniper with long-range crosshair scope. One-shot headshot lethal.',
  },
  {
    id: 'titan_lmg',
    name: 'M249 Titan LMG',
    category: 'LMG',
    damage: 21,
    fireRateMs: 105,
    magSize: 85,
    reloadMs: 1950,
    projectileSpeed: 960,
    pellets: 1,
    spreadRad: 0.048,
    rangePx: 780,
    costCoins: 1250,
    description: 'Belt-fed light machine gun with massive 85-round drum built to hold off zombie waves.',
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
