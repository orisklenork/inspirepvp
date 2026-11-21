import { X, Shield, Crosshair, Award, Calendar } from 'lucide-react';
import type { PublicPlayerInfo } from '../types/game.ts';
import {
  getBackgroundById,
  getBadgeById,
  getCharacterById,
  getThemeById,
  getWeaponById,
} from '../lib/catalog.ts';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface PlayerInfoModalProps {
  player: PublicPlayerInfo | null;
  onClose: () => void;
}

export function PlayerInfoModal({ player, onClose }: PlayerInfoModalProps) {
  if (!player) return null;

  const { profile, stats } = player;
  const bg = getBackgroundById(profile.profileBackgroundId);
  const theme = getThemeById(profile.profileThemeId);
  const character = getCharacterById(profile.selectedCharacterId);
  const weapon = getWeaponById(profile.favoriteWeaponId);
  const kd =
    stats.totalDeaths > 0
      ? (stats.totalKills / stats.totalDeaths).toFixed(2)
      : stats.totalKills.toFixed(2);
  const joinedDate = new Date(profile.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-info-heading"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-2xl bg-[#151C28] border ${theme.borderClass} overflow-hidden shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`relative h-32 bg-gradient-to-br ${bg.gradientClass}`}>
          {bg.imageUrl && (
            <img
              src={bg.imageUrl}
              alt={bg.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-55"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#151C28] via-[#151C28]/45 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player information"
            className="absolute top-3 right-3 p-2 rounded-lg bg-black/45 text-slate-200 hover:bg-black/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 -mt-11 relative">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-4 min-w-0">
              <PlayerAvatar
                profilePictureUrl={profile.profilePictureUrl}
                selectedAvatarId={profile.selectedAvatarId}
                profileThemeId={profile.profileThemeId}
                displayName={profile.displayName}
                size="lg"
              />
              <div className="pb-1 min-w-0">
                <h2
                  id="player-info-heading"
                  className="text-2xl font-bold text-slate-100 truncate"
                >
                  {profile.displayName}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span>@{profile.username}</span>
                  <span aria-hidden="true">·</span>
                  <span>{profile.playerId}</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0 pb-1">
              <p className="text-xs text-slate-400">Level</p>
              <p className={`text-xl font-bold font-display tabular-nums ${theme.badgeTextClass}`}>
                {profile.level}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            {profile.bio || 'No tactical bio set.'}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Selected Character</span>
              </div>
              <p className="font-semibold text-slate-100 mt-1">{character.name}</p>
            </div>
            <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                <span>Favorite Weapon</span>
              </div>
              <p className="font-semibold text-slate-100 mt-1">{weapon.name}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-2.5">
              <p className="text-xs text-slate-400">Kills</p>
              <p className="text-base font-semibold text-slate-100 tabular-nums mt-0.5">
                {stats.totalKills}
              </p>
            </div>
            <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-2.5">
              <p className="text-xs text-slate-400">K/D</p>
              <p className="text-base font-semibold text-slate-100 tabular-nums mt-0.5">{kd}</p>
            </div>
            <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-2.5">
              <p className="text-xs text-slate-400">Win Rate</p>
              <p className="text-base font-semibold text-emerald-400 tabular-nums mt-0.5">
                {stats.winRate}%
              </p>
            </div>
            <div className="rounded-xl bg-[#0B0F17] border border-white/5 p-2.5">
              <p className="text-xs text-slate-400">Matches</p>
              <p className="text-base font-semibold text-slate-100 tabular-nums mt-0.5">
                {stats.totalMatchesPlayed}
              </p>
            </div>
          </div>

          {profile.showcaseBadges.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Showcase Badges</span>
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-200">
                {profile.showcaseBadges.map((id) => {
                  const badge = getBadgeById(id);
                  return badge ? (
                    <span key={id} className="font-medium">
                      {badge.name} <span className="text-slate-500">({badge.tier})</span>
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Joined {joinedDate}
            </span>
            <span>Theme: {theme.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
