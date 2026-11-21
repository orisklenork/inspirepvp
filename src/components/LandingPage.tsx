import { ArrowRight, Crosshair, Shield, UserPlus, LogIn } from 'lucide-react';
import {
  ARENA_KEY_ART_URL,
  CHARACTERS,
  DEFAULT_AVATARS,
  FOUNDRY_BG_URL,
  WEAPONS,
} from '../lib/catalog.ts';
import type { PublicPlayerInfo } from '../types/game.ts';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface LandingPageProps {
  bots: PublicPlayerInfo[];
  onOpenAuth: (mode: 'login' | 'register') => void;
  onInspectPlayer: (player: PublicPlayerInfo) => void;
}

export function LandingPage({ bots, onOpenAuth, onInspectPlayer }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Three-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0B0F17]/95 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-2xl font-bold tracking-wider text-slate-100 whitespace-nowrap shrink-0"
          >
            InspiredPVP
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a
              href="#arena"
              className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
            >
              Arena
            </a>
            <a
              href="#operatives"
              className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
            >
              Operatives
            </a>
            <a
              href="#arsenal"
              className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
            >
              Arsenal
            </a>
            <a
              href="#roster"
              className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
            >
              Roster
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm px-4 py-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Play Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={ARENA_KEY_ART_URL}
            alt="InspiredPVP Sector A combat arena courtyard"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F17] via-[#0B0F17]/82 to-[#0B0F17]/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-[#0B0F17]/60" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-5">
              <svg viewBox="0 0 44 44" className="w-10 h-10 shrink-0" aria-hidden="true">
                <path
                  d="M12 4L32 4L40 22L32 40L12 40L4 22Z"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2.8"
                />
                <path d="M16 14H29L24 30H13L16 14Z" fill="#F59E0B" />
              </svg>
              <span className="text-xs font-mono text-amber-400 tracking-wide">
                2D Tactical Arena Combat · Browser &amp; Mobile Ready
              </span>
            </div>

            <h1 className="font-display font-bold text-slate-100 leading-[1.04] tracking-tight text-balance text-[clamp(2.5rem,5vw,4.25rem)]">
              Competitive 2D arena combat built for instant deployment.
            </h1>

            <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
              Step into 3v3 Team Skirmishes and Solo Survival rounds in Sector A. Create your
              InspiredPVP gaming profile in seconds with just a username and password, upload a
              cropped portrait, customize your frame, and climb the combat record.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm sm:text-base px-6 py-3.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Free Account</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#151C28]/90 hover:bg-[#1C2536] border border-white/15 text-slate-100 font-semibold text-sm sm:text-base px-6 py-3.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-amber-400" />
                <span>Log In</span>
              </button>
            </div>

            <p className="mt-7 text-xs text-slate-400 font-mono">
              WASD Move · Mouse Aim &amp; Fire · Space Dash · R Reload · Tab Live Scoreboard
            </p>
          </div>
        </div>
      </section>

      {/* Section 01: Arena Modes & Mechanics */}
      <section id="arena" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 w-full">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-semibold text-amber-400 tracking-wide">01. Arena Modes</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mt-1.5 text-balance">
            Fast tactical skirmishes with real-time cover and supply control
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 rounded-2xl bg-[#151C28] border border-white/10 overflow-hidden flex flex-col">
            <div className="relative h-64 sm:h-72">
              <img
                src={FOUNDRY_BG_URL}
                alt="InspiredPVP Foundry Armory hangar"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#151C28] via-[#151C28]/35 to-transparent" />
            </div>
            <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-slate-100">Team Skirmish 3v3</h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  Squad up alongside two allied operatives against three tactical rivals. Hold the
                  central bunker, rotate to medkit and ammo supply nodes, and reach 12 eliminations
                  before the 85-second clock expires.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-3 gap-4 text-sm tabular-nums">
                <div>
                  <span className="text-xs text-slate-400 block">Match Target</span>
                  <span className="font-semibold text-slate-100">12 Eliminations</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Round Clock</span>
                  <span className="font-semibold text-slate-100">85 Seconds</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Starting Funds</span>
                  <span className="font-semibold text-amber-400">1,000 Coins</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="rounded-2xl bg-[#151C28] border border-white/10 p-6 flex-1">
              <h3 className="text-2xl font-bold text-slate-100">Solo Survival</h3>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                Deploy solo against four flanking opponents. Use input-buffered tactical dashes,
                weapon switching between primary and sidearm, and cover angles to outscore the room.
              </p>
              <div className="mt-4 flex items-center gap-3 text-xs text-slate-400 font-mono">
                <span>1 vs 4 Arena</span>
                <span aria-hidden="true">·</span>
                <span>Dynamic Respawns</span>
                <span aria-hidden="true">·</span>
                <span>XP &amp; Coins</span>
              </div>
            </div>

            <div className="rounded-2xl bg-[#151C28] border border-white/10 p-6 flex-1">
              <h3 className="text-2xl font-bold text-slate-100">
                Instant Username-Only Accounts
              </h3>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                No email address, phone number, or verification codes required. Pick an available
                username, set a password, and receive your unique Player ID immediately.
              </p>
              <div className="mt-4 flex items-center gap-3 text-xs text-slate-400 font-mono">
                <span>Username + Password</span>
                <span aria-hidden="true">·</span>
                <span>Cropped Photo Upload</span>
                <span aria-hidden="true">·</span>
                <span>Career Stats</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 02: Selectable Operatives & Arsenal */}
      <section
        id="operatives"
        className="border-t border-white/10 bg-[#0E131D] py-16 lg:py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <p className="text-xs font-semibold text-amber-400 tracking-wide">
              02. Operatives &amp; Portraits
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mt-1.5 text-balance">
              Four combat frames with distinct speed, armor, and dash pacing
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {CHARACTERS.map((char, idx) => {
              const portrait = DEFAULT_AVATARS[idx]?.imageUrl;
              return (
                <div
                  key={char.id}
                  className="rounded-2xl bg-[#151C28] border border-white/10 overflow-hidden flex flex-col"
                >
                  <div className="aspect-square bg-[#0B0F17] relative overflow-hidden">
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
                        <h3 className="text-xl font-bold text-slate-100">{char.name}</h3>
                        <span className="text-xs text-amber-400 font-medium">{char.title}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        {char.description}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 font-mono tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        {char.maxHp} HP
                      </span>
                      <span>{char.moveSpeed} SPD</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Armory Preview */}
          <div id="arsenal" className="mt-14">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-semibold text-amber-400 tracking-wide">03. Armory</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1">
                  Unlockable Weapons &amp; Starting Loadout
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Two starter weapons included · Earn coins in matches to unlock more
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {WEAPONS.map((w) => (
                <div
                  key={w.id}
                  className="rounded-xl bg-[#151C28] border border-white/10 p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-amber-400 mb-1.5">
                      <Crosshair className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-medium">{w.category}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-100">{w.name}</h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {w.description}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-slate-300">
                      DMG {w.damage * w.pellets} · MAG {w.magSize}
                    </span>
                    <span className={w.costCoins === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      {w.costCoins === 0 ? 'Included' : `${w.costCoins}c`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 04: Active Arena Roster Preview */}
      <section id="roster" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold text-amber-400 tracking-wide">
              04. Player Profiles &amp; Room Roster
            </p>
            <h2 className="text-3xl font-bold text-slate-100 mt-1">
              Customizable Player Cards Visible Everywhere
            </h2>
          </div>
          <p className="text-xs text-slate-400">Click any operative card to inspect their profile</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {bots.map((bot) => (
            <button
              key={bot.profile.playerId}
              type="button"
              onClick={() => onInspectPlayer(bot)}
              className="text-left rounded-2xl bg-[#151C28] border border-white/10 hover:border-amber-500/50 p-4 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <PlayerAvatar
                  profilePictureUrl={bot.profile.profilePictureUrl}
                  selectedAvatarId={bot.profile.selectedAvatarId}
                  profileThemeId={bot.profile.profileThemeId}
                  displayName={bot.profile.displayName}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-100 truncate">
                    {bot.profile.displayName}
                  </p>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    @{bot.profile.username}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 tabular-nums">
                <span>Lv {bot.profile.level}</span>
                <span>{bot.stats.totalKills} Kills</span>
                <span className="text-emerald-400">{bot.stats.winRate}% WR</span>
              </div>
            </button>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 rounded-2xl bg-[#151C28] border border-amber-500/30 p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-100">Ready to enter the arena?</h2>
            <p className="text-sm text-slate-300 mt-1.5 max-w-xl">
              Create your InspiredPVP account with a username and password in under ten seconds
              and deploy directly into the multiplayer lobby.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="rounded-xl bg-[#0B0F17] hover:bg-white/5 border border-white/15 text-slate-100 font-semibold text-sm px-5 py-3 transition-colors whitespace-nowrap cursor-pointer"
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm px-6 py-3 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-white/10 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span className="font-display text-base font-bold tracking-wider text-slate-300">
            InspiredPVP
          </span>
          <div className="flex items-center gap-6">
            <a href="#arena" className="hover:text-slate-300">
              Arena
            </a>
            <a href="#operatives" className="hover:text-slate-300">
              Operatives
            </a>
            <a href="#arsenal" className="hover:text-slate-300">
              Arsenal
            </a>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-slate-300 cursor-pointer"
            >
              Sign In
            </button>
          </div>
          <span>© 2026 InspiredPVP</span>
        </div>
      </footer>
    </div>
  );
}
