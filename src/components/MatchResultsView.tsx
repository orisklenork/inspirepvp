import { RotateCcw, ArrowLeft, Coins, Trophy, Skull } from 'lucide-react';
import { getCharacterById, getWeaponById } from '../lib/catalog.ts';
import type {
  MatchRecord,
  PlayerAccountBundle,
  PublicPlayerInfo,
} from '../types/game.ts';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface MatchResultsViewProps {
  account: PlayerAccountBundle;
  match: MatchRecord;
  bots: PublicPlayerInfo[];
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
  onInspectPlayer: (player: PublicPlayerInfo) => void;
}

export function MatchResultsView({
  account,
  match,
  bots,
  onPlayAgain,
  onReturnToLobby,
  onInspectPlayer,
}: MatchResultsViewProps) {
  const victory = match.outcome === 'victory';

  function handleClickParticipant(playerId: string): void {
    if (playerId === account.profile.playerId) {
      onInspectPlayer({
        isBot: false,
        profile: {
          playerId: account.profile.playerId,
          username: account.profile.username,
          displayName: account.profile.displayName,
          profilePictureUrl: account.profile.profilePictureUrl,
          selectedAvatarId: account.profile.selectedAvatarId,
          bio: account.profile.bio,
          profileBackgroundId: account.profile.profileBackgroundId,
          profileThemeId: account.profile.profileThemeId,
          favoriteWeaponId: account.profile.favoriteWeaponId,
          selectedCharacterId: account.profile.selectedCharacterId,
          badges: account.profile.badges,
          showcaseBadges: account.profile.showcaseBadges,
          inventory: account.profile.inventory,
          coins: account.profile.coins,
          level: account.profile.level,
          xp: account.profile.xp,
          createdAt: account.profile.createdAt,
          updatedAt: account.profile.updatedAt,
        },
        stats: {
          totalKills: account.stats.totalKills,
          totalDeaths: account.stats.totalDeaths,
          totalWins: account.stats.totalWins,
          totalLosses: account.stats.totalLosses,
          totalMatchesPlayed: account.stats.totalMatchesPlayed,
          winRate: account.stats.winRate,
          updatedAt: account.stats.updatedAt,
        },
      });
      return;
    }
    const foundBot = bots.find((b) => b.profile.playerId === playerId);
    if (foundBot) {
      onInspectPlayer(foundBot);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Outcome Header */}
      <div
        className={`rounded-2xl bg-[#151C28] border p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 ${
          victory ? 'border-emerald-500/40' : 'border-rose-500/40'
        }`}
      >
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold mb-2">
            {victory ? (
              <Trophy className="w-5 h-5 text-emerald-400" />
            ) : (
              <Skull className="w-5 h-5 text-rose-400" />
            )}
            <span className={victory ? 'text-emerald-400' : 'text-rose-400'}>
              {match.mode === 'skirmish_3v3' ? 'Team Skirmish 3v3' : 'Solo Survival'} ·{' '}
              {match.durationSec}s
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-100">
            {victory ? 'Arena Victory' : 'Match Defeat'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Your combat statistics, XP, and coin rewards have been saved to your profile.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center shrink-0">
          <div className="rounded-xl bg-[#0B0F17] border border-white/5 px-4 py-3">
            <p className="text-xs text-slate-400">Your K / D</p>
            <p className="text-xl font-bold text-slate-100 tabular-nums mt-0.5">
              {match.kills} / {match.deaths}
            </p>
          </div>
          <div className="rounded-xl bg-[#0B0F17] border border-white/5 px-4 py-3">
            <p className="text-xs text-slate-400">XP Earned</p>
            <p className="text-xl font-bold text-sky-400 tabular-nums mt-0.5">
              +{match.xpEarned}
            </p>
          </div>
          <div className="rounded-xl bg-[#0B0F17] border border-white/5 px-4 py-3">
            <p className="text-xs text-slate-400">Coins</p>
            <p className="text-xl font-bold text-amber-400 tabular-nums mt-0.5 inline-flex items-center gap-1">
              <Coins className="w-4 h-4" />+{match.coinsEarned}
            </p>
          </div>
        </div>
      </div>

      {/* Match Scoreboard */}
      <div className="rounded-2xl bg-[#151C28] border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-100">Match Scoreboard</h2>
          <span className="text-xs text-slate-400">Click any operative to inspect profile</span>
        </div>

        <div className="space-y-2.5">
          {match.participants.map((p, index) => {
            const char = getCharacterById(p.characterId);
            const wep = getWeaponById(p.weaponId);
            return (
              <button
                key={p.playerId}
                type="button"
                onClick={() => handleClickParticipant(p.playerId)}
                className={`w-full text-left flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 rounded-xl px-4 py-3 border transition-colors cursor-pointer ${
                  p.isUser
                    ? 'bg-amber-500/10 border-amber-500/40'
                    : 'bg-[#0B0F17] border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 text-xs font-mono text-slate-500 tabular-nums">
                    #{index + 1}
                  </span>
                  <PlayerAvatar
                    profilePictureUrl={
                      p.isUser ? account.profile.profilePictureUrl : p.profilePictureUrl
                    }
                    selectedAvatarId={
                      p.isUser ? account.profile.selectedAvatarId : p.selectedAvatarId
                    }
                    profileThemeId={
                      p.isUser ? account.profile.profileThemeId : p.profileThemeId
                    }
                    displayName={p.isUser ? account.profile.displayName : p.displayName}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-100 truncate">
                        {p.isUser ? account.profile.displayName : p.displayName}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          p.team === 'allies' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {p.team === 'allies' ? 'Allies' : 'Rivals'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono truncate">
                      @{p.isUser ? account.profile.username : p.username} · Lv {p.level} ·{' '}
                      {char.name} · {wep.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm font-mono tabular-nums shrink-0 ml-auto">
                  <div>
                    <span className="text-slate-500 text-xs block">Kills</span>
                    <span className="text-slate-100 font-semibold">{p.kills}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs block">Deaths</span>
                    <span className="text-slate-300">{p.deaths}</span>
                  </div>
                  <div className="text-right min-w-[68px]">
                    <span className="text-slate-500 text-xs block">Score</span>
                    <span className="text-amber-400 font-bold">{p.score}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onReturnToLobby}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0B0F17] hover:bg-white/5 border border-white/10 text-slate-200 font-semibold text-sm px-5 py-3 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Lobby</span>
          </button>
          <button
            type="button"
            onClick={onPlayAgain}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm px-6 py-3 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>
        </div>
      </div>
    </div>
  );
}
