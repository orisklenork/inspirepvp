import { ArrowRight, Crosshair, Shield, UserPlus, LogIn, Smartphone, Monitor, Users } from 'lucide-react';
import {
  ARENA_KEY_ART_URL,
  CHARACTERS,
  DEFAULT_AVATARS,
  WEAPONS,
} from '../lib/catalog.ts';
import type { PublicPlayerInfo } from '../types/game.ts';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface LandingPageProps {
  players: PublicPlayerInfo[];
  onOpenAuth: (mode: 'login' | 'register') => void;
  onInspectPlayer: (player: PublicPlayerInfo) => void;
}

export function LandingPage({ players, onOpenAuth, onInspectPlayer }: LandingPageProps) {
  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
      {/* Clean Three-Zone Header */}
      <header className="sticky top-0 z-30 bg-[#121826]/95 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <a
            href="#top"
            className="font-display text-2xl sm:text-3xl font-extrabold tracking-wider text-white whitespace-nowrap shrink-0"
          >
            Inspired<span className="text-orange-400">PVP</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-300">
            <a href="#modes" className="hover:text-orange-400 transition-colors">
              1v1 Modes
            </a>
            <a href="#operatives" className="hover:text-orange-400 transition-colors">
              Operatives
            </a>
            <a href="#arsenal" className="hover:text-orange-400 transition-colors">
              3D Arsenal
            </a>
            <a href="#roster" className="hover:text-orange-400 transition-colors">
              Players
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="clay-btn-secondary text-sm font-semibold px-4 py-2 cursor-pointer"
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="clay-btn-primary inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 cursor-pointer"
            >
              <span>Play Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Showcase */}
      <section id="top" className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={ARENA_KEY_ART_URL}
            alt="InspiredPVP 3D tactical arena"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#121826] via-[#121826]/88 to-[#121826]/55" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121826] via-transparent to-[#121826]/70" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-orange-400 mb-3">
                3D Third-Person Tactical Shooter · Desktop &amp; Mobile
              </p>

              <h1 className="font-display font-extrabold text-white leading-[1.02] tracking-tight text-[clamp(2.6rem,5.5vw,4.5rem)]">
                Create a Room, Invite Rivals &amp; Battle 1v1 in 3D.
              </h1>

              <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                Drop straight into live 3D courtyard duels with realistic guns, crouch cover,
                tactical reloads, and full phone touch + PC mouse controls. Instant username-only
                accounts with zero email required.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="clay-btn-primary inline-flex items-center gap-2 font-bold text-base px-7 py-3.5 cursor-pointer"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>Create Free Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="clay-btn-secondary inline-flex items-center gap-2 font-semibold text-base px-6 py-3.5 cursor-pointer"
                >
                  <LogIn className="w-5 h-5 text-orange-400" />
                  <span>Log In</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="clay-card p-6 space-y-4">
                <h2 className="font-display text-2xl font-bold text-white">
                  Built for Instant 1v1 Action
                </h2>

                <div className="space-y-3">
                  <div className="clay-inset p-3.5 flex items-start gap-3">
                    <Users className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">Rooms, Invites &amp; Quick Match</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Create a shareable room code, invite online players, or click Random Match
                        to pair automatically.
                      </p>
                    </div>
                  </div>

                  <div className="clay-inset p-3.5 flex items-start gap-3">
                    <Monitor className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">PC Mouse &amp; Keyboard</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        WASD Move · Click Shoot · Right-Click Scope · C Crouch · R Reload · 1/2 Swap
                      </p>
                    </div>
                  </div>

                  <div className="clay-inset p-3.5 flex items-start gap-3">
                    <Smartphone className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">Mobile Touch HUD</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Virtual thumbstick, swipe aim pad, and tactile Fire, Scope, Crouch &amp;
                        Reload buttons.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modes Overview */}
      <section id="modes" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="clay-card p-6">
            <p className="text-xs font-mono font-bold text-orange-400">01 · QUICK MATCH</p>
            <h3 className="font-display text-2xl font-bold text-white mt-1">Random 1v1 Duel</h3>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Tap Find Match to pair directly with another real player in the queue and launch into
              a first-to-5 3D showdown.
            </p>
          </div>
          <div className="clay-card p-6">
            <p className="text-xs font-mono font-bold text-emerald-400">02 · PRIVATE ROOMS</p>
            <h3 className="font-display text-2xl font-bold text-white mt-1">Create &amp; Invite</h3>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Host a room with a 6-character code, send instant 1-tap invites to online players, or
              join open rooms in the lobby.
            </p>
          </div>
          <div className="clay-card p-6">
            <p className="text-xs font-mono font-bold text-sky-400">03 · SOLO DRILL</p>
            <h3 className="font-display text-2xl font-bold text-white mt-1">3D Firing Range</h3>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Dial in your sensitivity, crouch cover angles, ADS zoom, and weapon recoil against
              reactive steel range targets.
            </p>
          </div>
        </div>
      </section>

      {/* Operatives & Arsenal */}
      <section id="operatives" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="mb-7">
          <p className="text-xs font-mono font-bold text-orange-400">OPERATIVES</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mt-1">
            Four 3D Combat Frames
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CHARACTERS.map((char, idx) => {
            const portrait = DEFAULT_AVATARS[idx]?.imageUrl;
            return (
              <div key={char.id} className="clay-card overflow-hidden flex flex-col">
                <div className="aspect-square bg-[#101624] relative overflow-hidden">
                  {portrait && (
                    <img
                      src={portrait}
                      alt={char.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-2xl font-bold text-white">{char.name}</h3>
                      <span className="text-xs font-semibold text-orange-400">{char.title}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">{char.description}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-300 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-orange-400" />
                      {char.maxHp} HP
                    </span>
                    <span>{char.moveSpeed} SPD</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div id="arsenal" className="mt-14">
          <div className="mb-6">
            <p className="text-xs font-mono font-bold text-orange-400">3D ARMORY</p>
            <h2 className="font-display text-3xl font-bold text-white mt-1">
              Tactical Rifles, SMGs, Shotguns &amp; Sidearms
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {WEAPONS.map((w) => (
              <div key={w.id} className="clay-panel p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-orange-400 text-xs font-semibold mb-1">
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>{w.category}</span>
                  </div>
                  <h3 className="text-base font-bold text-white">{w.name}</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{w.description}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-slate-300">DMG {w.damage * w.pellets}</span>
                  <span className={w.costCoins === 0 ? 'text-emerald-400' : 'text-orange-400'}>
                    {w.costCoins === 0 ? 'Starter' : `${w.costCoins}c`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registered Players Roster (Real players only) */}
      <section id="roster" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-7">
          <div>
            <p className="text-xs font-mono font-bold text-orange-400">REGISTERED OPERATIVES</p>
            <h2 className="font-display text-3xl font-bold text-white mt-1">
              Real Player Leaderboard
            </h2>
          </div>
          {players.length > 0 && (
            <p className="text-xs text-slate-400">Click any player card to inspect career stats</p>
          )}
        </div>

        {players.length === 0 ? (
          <div className="clay-card p-8 text-center">
            <p className="text-base font-bold text-white">No registered operatives yet.</p>
            <p className="text-sm text-slate-400 mt-1.5">
              Create your account in seconds to appear on the live roster and challenge players 1v1.
            </p>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="clay-btn-primary mt-5 inline-flex items-center gap-2 font-bold text-sm px-6 py-3 cursor-pointer"
            >
              <span>Create First Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {players.map((player) => (
              <button
                key={player.profile.playerId}
                type="button"
                onClick={() => onInspectPlayer(player)}
                className="clay-panel hover:border-orange-400/50 text-left p-4 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <PlayerAvatar
                    profilePictureUrl={player.profile.profilePictureUrl}
                    selectedAvatarId={player.profile.selectedAvatarId}
                    profileThemeId={player.profile.profileThemeId}
                    displayName={player.profile.displayName}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-white truncate">
                      {player.profile.displayName}
                    </p>
                    <p className="text-xs text-slate-400 font-mono truncate">
                      @{player.profile.username}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 tabular-nums">
                  <span>Lv {player.profile.level}</span>
                  <span>{player.stats.totalKills} Kills</span>
                  <span className="text-emerald-400">{player.stats.winRate}% WR</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-white/10 py-7 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span className="font-display text-lg font-bold text-slate-300">InspiredPVP</span>
          <span>3D 1v1 Arena Shooter · Desktop &amp; Mobile</span>
        </div>
      </footer>
    </div>
  );
}
