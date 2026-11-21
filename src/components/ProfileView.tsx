import { Calendar, Coins, Crosshair, Shield, Award, Sliders, Upload } from 'lucide-react';
import {
  BADGES,
  WEAPONS,
  getBackgroundById,
  getCharacterById,
  getThemeById,
  getWeaponById,
  getXpForNextLevel,
} from '../lib/catalog.ts';
import type { AppView, PlayerAccountBundle } from '../types/game.ts';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface ProfileViewProps {
  account: PlayerAccountBundle;
  onNavigate: (view: AppView) => void;
  onOpenAvatarUpload: () => void;
}

export function ProfileView({
  account,
  onNavigate,
  onOpenAvatarUpload,
}: ProfileViewProps) {
  const { profile, stats, recentMatches } = account;
  const bg = getBackgroundById(profile.profileBackgroundId);
  const theme = getThemeById(profile.profileThemeId);
  const character = getCharacterById(profile.selectedCharacterId);
  const weapon = getWeaponById(profile.favoriteWeaponId);
  const nextXp = getXpForNextLevel(profile.level);
  const xpPct = Math.min(100, Math.round((profile.xp / nextXp) * 100));
  const kdRatio =
    stats.totalDeaths > 0
      ? (stats.totalKills / stats.totalDeaths).toFixed(2)
      : stats.totalKills.toFixed(2);
  const joinedDate = new Date(profile.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
      {/* Banner & Identity Header */}
      <div className={`rounded-2xl bg-[#151C28] border ${theme.borderClass} overflow-hidden`}>
        <div className={`relative h-44 sm:h-52 bg-gradient-to-br ${bg.gradientClass}`}>
          {bg.imageUrl && (
            <img
              src={bg.imageUrl}
              alt={bg.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-55"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#151C28] via-[#151C28]/45 to-transparent" />
        </div>

        <div className="px-6 sm:px-8 pb-7 -mt-14 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              <PlayerAvatar
                profilePictureUrl={profile.profilePictureUrl}
                selectedAvatarId={profile.selectedAvatarId}
                profileThemeId={profile.profileThemeId}
                displayName={profile.displayName}
                size="xl"
              />
              <div className="pb-1">
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-100">
                  {profile.displayName}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400 font-mono mt-1">
                  <span>@{profile.username}</span>
                  <span aria-hidden="true">·</span>
                  <span>ID: {profile.playerId}</span>
                  <span aria-hidden="true">·</span>
                  <span className={theme.badgeTextClass}>Level {profile.level}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onOpenAvatarUpload}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1C2536] hover:bg-[#243046] border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-4 h-4 text-amber-400" />
                <span>Upload Picture</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('customize')}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sliders className="w-4 h-4" />
                <span>Customize Profile</span>
              </button>
            </div>
          </div>

          <p className="mt-5 text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed">
            {profile.bio}
          </p>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center pt-5 border-t border-white/10">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-200">
                  Operative Level {profile.level} Progress
                </span>
                <span className="text-slate-400 tabular-nums">
                  {profile.xp} / {nextXp} XP
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[#0B0F17] overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${xpPct}%` }} />
              </div>
            </div>

            <div className="flex sm:justify-end items-center gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Joined {joinedDate}
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold tabular-nums">
                <Coins className="w-3.5 h-3.5" />
                {profile.coins.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Career Combat Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Kills', value: stats.totalKills },
          { label: 'Total Deaths', value: stats.totalDeaths },
          { label: 'K/D Ratio', value: kdRatio },
          { label: 'Total Wins', value: stats.totalWins, accent: 'text-emerald-400' },
          { label: 'Total Losses', value: stats.totalLosses, accent: 'text-rose-400' },
          { label: 'Win Rate', value: `${stats.winRate}%`, accent: 'text-amber-400' },
          { label: 'Matches Played', value: stats.totalMatchesPlayed },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl bg-[#151C28] border border-white/10 p-4"
          >
            <p className="text-xs text-slate-400">{metric.label}</p>
            <p
              className={`text-2xl font-bold font-display tabular-nums mt-1 ${
                metric.accent || 'text-slate-100'
              }`}
            >
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Loadout, Badges, and Match History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl bg-[#151C28] border border-white/10 p-6">
            <h2 className="text-xl font-bold text-slate-100 mb-4">Active Loadout & Armory</h2>
            <div className="space-y-3">
              <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-xs text-slate-400">Selected Character</p>
                    <p className="text-sm font-semibold text-slate-100">{character.name}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 tabular-nums">{character.maxHp} HP</span>
              </div>

              <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Crosshair className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-xs text-slate-400">Favorite Weapon</p>
                    <p className="text-sm font-semibold text-slate-100">{weapon.name}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400">{weapon.category}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs font-medium text-slate-400 mb-2">
                Unlocked Inventory ({profile.inventory.length} / {WEAPONS.length})
              </p>
              <div className="space-y-1.5 text-sm">
                {profile.inventory.map((wId) => {
                  const item = getWeaponById(wId);
                  return (
                    <div key={wId} className="flex items-center justify-between text-slate-300">
                      <span>{item.name}</span>
                      <span className="text-xs text-slate-500">{item.category}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#151C28] border border-white/10 p-6">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span>Achievements & Badges</span>
            </h2>
            <div className="space-y-2.5">
              {BADGES.map((badge) => {
                const earned = profile.badges.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`rounded-xl border p-3 ${
                      earned
                        ? 'bg-[#0B0F17] border-amber-500/30'
                        : 'bg-[#0B0F17]/50 border-white/5 opacity-55'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-100">{badge.name}</span>
                      <span
                        className={`text-xs font-medium ${
                          earned ? 'text-amber-400' : 'text-slate-500'
                        }`}
                      >
                        {earned ? `Unlocked · ${badge.tier}` : 'Locked'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{badge.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-2xl bg-[#151C28] border border-white/10 p-6">
            <h2 className="text-xl font-bold text-slate-100 mb-4">Recent Arena Matches</h2>
            {recentMatches.length === 0 ? (
              <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-8 text-center">
                <p className="text-sm text-slate-300 font-medium">No completed matches yet.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Deploy to the arena from the Lobby to build your combat record.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('lobby')}
                  className="mt-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs px-4 py-2.5 cursor-pointer"
                >
                  Go to Lobby
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentMatches.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl bg-[#0B0F17] border border-white/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            m.outcome === 'victory' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {m.outcome === 'victory' ? 'Victory' : 'Defeat'}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-xs text-slate-300">
                          {m.mode === 'skirmish_3v3' ? 'Team Skirmish 3v3' : 'Solo Survival'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(m.playedAt).toLocaleString()} · {m.durationSec}s
                      </p>
                    </div>

                    <div className="flex items-center gap-5 text-xs tabular-nums">
                      <div>
                        <span className="text-slate-400">K / D: </span>
                        <span className="text-slate-100 font-semibold">
                          {m.kills} / {m.deaths}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Score: </span>
                        <span className="text-slate-100 font-semibold">{m.score}</span>
                      </div>
                      <div className="text-amber-400 font-semibold">+{m.coinsEarned} Coins</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
