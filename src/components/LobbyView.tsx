import { useEffect } from 'react';
import { Play, Shield, Crosshair, Users, Coins, Sliders } from 'lucide-react';
import {
  CHARACTERS,
  WEAPONS,
  getBackgroundById,
  getCharacterById,
  getThemeById,
  getWeaponById,
  getXpForNextLevel,
} from '../lib/catalog.ts';
import type {
  AppView,
  GameMode,
  PlayerAccountBundle,
  PublicPlayerInfo,
} from '../types/game.ts';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface LobbyViewProps {
  account: PlayerAccountBundle;
  players: PublicPlayerInfo[];
  selectedMode: GameMode;
  onChangeMode: (mode: GameMode) => void;
  onQuickLoadoutChange: (patch: {
    selectedCharacterId?: string;
    favoriteWeaponId?: string;
  }) => Promise<void>;
  onStartMatch: () => void;
  onNavigate: (view: AppView) => void;
  onInspectPlayer: (player: PublicPlayerInfo) => void;
  onOpenAvatarUpload: () => void;
}

export function LobbyView({
  account,
  players,
  selectedMode,
  onChangeMode,
  onQuickLoadoutChange,
  onStartMatch,
  onNavigate,
  onInspectPlayer,
  onOpenAvatarUpload,
}: LobbyViewProps) {
  const { profile, stats } = account;
  const bg = getBackgroundById(profile.profileBackgroundId);
  const theme = getThemeById(profile.profileThemeId);
  const character = getCharacterById(profile.selectedCharacterId);
  const weapon = getWeaponById(profile.favoriteWeaponId);
  const nextXp = getXpForNextLevel(profile.level);
  const xpPct = Math.min(100, Math.round((profile.xp / nextXp) * 100));

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (
        e.key === 'Enter' &&
        tag !== 'BUTTON' &&
        tag !== 'SELECT' &&
        tag !== 'INPUT' &&
        tag !== 'TEXTAREA' &&
        tag !== 'A'
      ) {
        onStartMatch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStartMatch]);

  const userAsPublic: PublicPlayerInfo = {
    isBot: false,
    profile: {
      playerId: profile.playerId,
      username: profile.username,
      displayName: profile.displayName,
      profilePictureUrl: profile.profilePictureUrl,
      selectedAvatarId: profile.selectedAvatarId,
      bio: profile.bio,
      profileBackgroundId: profile.profileBackgroundId,
      profileThemeId: profile.profileThemeId,
      favoriteWeaponId: profile.favoriteWeaponId,
      selectedCharacterId: profile.selectedCharacterId,
      badges: profile.badges,
      showcaseBadges: profile.showcaseBadges,
      inventory: profile.inventory,
      coins: profile.coins,
      level: profile.level,
      xp: profile.xp,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
    stats: {
      totalKills: stats.totalKills,
      totalDeaths: stats.totalDeaths,
      totalWins: stats.totalWins,
      totalLosses: stats.totalLosses,
      totalMatchesPlayed: stats.totalMatchesPlayed,
      winRate: stats.winRate,
      updatedAt: stats.updatedAt,
    },
  };

  const otherPlayers = players.filter((p) => p.profile.playerId !== profile.playerId);
  const allies =
    selectedMode === 'skirmish_3v3' ? [userAsPublic, ...otherPlayers.slice(0, 2)] : [userAsPublic];
  const allyBotFillCount = selectedMode === 'skirmish_3v3' ? Math.max(0, 3 - allies.length) : 0;
  const rivals =
    selectedMode === 'skirmish_3v3'
      ? otherPlayers.slice(2, 5)
      : otherPlayers.slice(0, 4);
  const rivalTargetCount = selectedMode === 'skirmish_3v3' ? 3 : 4;
  const rivalBotFillCount = Math.max(0, rivalTargetCount - rivals.length);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Main Multiplayer Room & Staging */}
        <div className="lg:col-span-8 space-y-6">
          {/* Staging Banner */}
          <div className="rounded-2xl bg-[#151C28] border border-white/10 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-100">Multiplayer Arena Room</h1>
                <p className="text-sm text-slate-400 mt-1">
                  Select your combat mode and inspect registered operatives before deploying.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B0F17] border border-white/5 self-start">
                <button
                  type="button"
                  onClick={() => onChangeMode('skirmish_3v3')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    selectedMode === 'skirmish_3v3'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Team Skirmish 3v3
                </button>
                <button
                  type="button"
                  onClick={() => onChangeMode('solo_survival')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    selectedMode === 'solo_survival'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Solo Survival
                </button>
              </div>
            </div>

            {/* Room Teams Grid */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 mb-2.5">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Allied Squad ({selectedMode === 'skirmish_3v3' ? 3 : 1})
                  </span>
                  <span className="text-slate-400 font-normal">Click player to inspect</span>
                </div>
                <div className="space-y-2.5">
                  {allies.map((p, idx) => {
                    const pChar = getCharacterById(p.profile.selectedCharacterId);
                    const pWeapon = getWeaponById(p.profile.favoriteWeaponId);
                    return (
                      <button
                        key={p.profile.playerId}
                        type="button"
                        onClick={() => onInspectPlayer(p)}
                        className={`w-full text-left flex items-center gap-3 rounded-xl bg-[#0B0F17] border ${
                          idx === 0 ? 'border-amber-500/40' : 'border-white/5'
                        } hover:border-amber-500/60 p-3 transition-colors cursor-pointer`}
                      >
                        <PlayerAvatar
                          profilePictureUrl={p.profile.profilePictureUrl}
                          selectedAvatarId={p.profile.selectedAvatarId}
                          profileThemeId={p.profile.profileThemeId}
                          displayName={p.profile.displayName}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-100 truncate">
                              {p.profile.displayName}
                            </span>
                            {idx === 0 && (
                              <span className="text-xs font-semibold text-amber-400">You</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate font-mono">
                            @{p.profile.username} · Lv {p.profile.level}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {pChar.name} · {pWeapon.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {Array.from({ length: allyBotFillCount }).map((_, i) => (
                    <div
                      key={`ally-ai-${i}`}
                      className="rounded-xl bg-[#0B0F17]/60 border border-dashed border-white/10 p-3 text-xs text-slate-400"
                    >
                      <p className="font-semibold text-slate-300">Open Squad Slot · Arena AI Fill</p>
                      <p className="text-slate-500 mt-0.5">
                        Filled by an Arena AI teammate when match starts
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-rose-400 mb-2.5">
                  <span>Rival Squad ({rivalTargetCount})</span>
                  <span className="text-slate-400 font-normal">Active Matchmaking</span>
                </div>
                <div className="space-y-2.5">
                  {rivals.map((p) => {
                    const pChar = getCharacterById(p.profile.selectedCharacterId);
                    const pWeapon = getWeaponById(p.profile.favoriteWeaponId);
                    return (
                      <button
                        key={p.profile.playerId}
                        type="button"
                        onClick={() => onInspectPlayer(p)}
                        className="w-full text-left flex items-center gap-3 rounded-xl bg-[#0B0F17] border border-white/5 hover:border-rose-400/50 p-3 transition-colors cursor-pointer"
                      >
                        <PlayerAvatar
                          profilePictureUrl={p.profile.profilePictureUrl}
                          selectedAvatarId={p.profile.selectedAvatarId}
                          profileThemeId={p.profile.profileThemeId}
                          displayName={p.profile.displayName}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-sm text-slate-100 block truncate">
                            {p.profile.displayName}
                          </span>
                          <p className="text-xs text-slate-400 truncate font-mono">
                            @{p.profile.username} · Lv {p.profile.level}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {pChar.name} · {pWeapon.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {Array.from({ length: rivalBotFillCount }).map((_, i) => (
                    <div
                      key={`rival-ai-${i}`}
                      className="rounded-xl bg-[#0B0F17]/60 border border-dashed border-white/10 p-3 text-xs text-slate-400"
                    >
                      <p className="font-semibold text-slate-300">Open Rival Slot · Arena AI Fill</p>
                      <p className="text-slate-500 mt-0.5">
                        Filled by an Arena AI opponent when match starts
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Loadout Selector */}
            <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="lobby-character"
                  className="block text-xs font-medium text-slate-400 mb-1.5"
                >
                  Operative Frame
                </label>
                <select
                  id="lobby-character"
                  value={profile.selectedCharacterId}
                  onChange={(e) =>
                    void onQuickLoadoutChange({ selectedCharacterId: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/10 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {CHARACTERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.title} ({c.maxHp} HP)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="lobby-weapon"
                  className="block text-xs font-medium text-slate-400 mb-1.5"
                >
                  Primary Weapon
                </label>
                <select
                  id="lobby-weapon"
                  value={profile.favoriteWeaponId}
                  onChange={(e) =>
                    void onQuickLoadoutChange({ favoriteWeaponId: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/10 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {WEAPONS.filter((w) => profile.inventory.includes(w.id)).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-slate-400 font-mono">
                Controls: WASD Move · Mouse Aim/Fire · Space Dash · R Reload · Tab Scoreboard
              </p>
              <button
                type="button"
                onClick={onStartMatch}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base px-7 py-3.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Deploy to Arena</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Customized Player Card Summary */}
        <div className="lg:col-span-4 space-y-6">
          <div className={`rounded-2xl bg-[#151C28] border ${theme.borderClass} overflow-hidden`}>
            <div className={`relative h-28 bg-gradient-to-br ${bg.gradientClass}`}>
              {bg.imageUrl && (
                <img
                  src={bg.imageUrl}
                  alt={bg.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-55"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#151C28] via-[#151C28]/40 to-transparent" />
            </div>

            <div className="px-5 pb-5 -mt-10 relative">
              <div className="flex items-end justify-between gap-3">
                <button
                  type="button"
                  onClick={onOpenAvatarUpload}
                  className="group relative cursor-pointer"
                  title="Change profile picture"
                >
                  <PlayerAvatar
                    profilePictureUrl={profile.profilePictureUrl}
                    selectedAvatarId={profile.selectedAvatarId}
                    profileThemeId={profile.profileThemeId}
                    displayName={profile.displayName}
                    size="lg"
                  />
                </button>
                <div className="text-right pb-1">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400 tabular-nums">
                    <Coins className="w-4 h-4" />
                    {profile.coins.toLocaleString()}
                  </span>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{profile.playerId}</p>
                </div>
              </div>

              <div className="mt-3">
                <h2 className="text-2xl font-bold text-slate-100 truncate">
                  {profile.displayName}
                </h2>
                <p className="text-xs text-slate-400 font-mono">@{profile.username}</p>
                <p className="mt-2.5 text-sm text-slate-300 line-clamp-2">{profile.bio}</p>
              </div>

              {/* Level Progress */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className={`font-semibold ${theme.badgeTextClass}`}>
                    Level {profile.level}
                  </span>
                  <span className="text-slate-400 tabular-nums">
                    {profile.xp} / {nextXp} XP
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#0B0F17] overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
              </div>

              {/* Active Equipment */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-2.5">
                  <span className="text-slate-400 inline-flex items-center gap-1">
                    <Shield className="w-3 h-3 text-amber-400" />
                    Character
                  </span>
                  <p className="font-semibold text-slate-100 mt-0.5 truncate">{character.name}</p>
                </div>
                <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-2.5">
                  <span className="text-slate-400 inline-flex items-center gap-1">
                    <Crosshair className="w-3 h-3 text-amber-400" />
                    Weapon
                  </span>
                  <p className="font-semibold text-slate-100 mt-0.5 truncate">{weapon.name}</p>
                </div>
              </div>

              {/* Career Summary */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-2.5">
                  <p className="text-xs text-slate-400">Kills</p>
                  <p className="text-base font-semibold text-slate-100 tabular-nums">
                    {stats.totalKills}
                  </p>
                </div>
                <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-2.5">
                  <p className="text-xs text-slate-400">Wins</p>
                  <p className="text-base font-semibold text-emerald-400 tabular-nums">
                    {stats.totalWins}
                  </p>
                </div>
                <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-2.5">
                  <p className="text-xs text-slate-400">Win Rate</p>
                  <p className="text-base font-semibold text-slate-100 tabular-nums">
                    {stats.winRate}%
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate('customize')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1C2536] hover:bg-[#232F44] border border-white/10 text-slate-100 text-xs font-semibold py-2.5 px-3 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Customize</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('profile')}
                  className="inline-flex items-center justify-center rounded-xl bg-[#0B0F17] hover:bg-white/5 border border-white/10 text-slate-200 text-xs font-semibold py-2.5 px-3 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Full Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
