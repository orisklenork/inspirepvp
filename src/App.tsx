import { useEffect, useState } from 'react';
import { Coins, LogOut, CheckCircle2, X } from 'lucide-react';
import {
  fetchRegisteredPlayers,
  fetchSession,
  logoutAccount,
  recordArenaMatch,
  removeAvatarPicture,
  updateProfile,
  uploadAvatarPicture,
} from './lib/api.ts';
import type {
  AppView,
  GameMode,
  MatchParticipantResult,
  MatchRecord,
  PlayerAccountBundle,
  PublicPlayerInfo,
} from './types/game.ts';
import { LandingPage } from './components/LandingPage.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { LobbyView } from './components/LobbyView.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { CustomizeProfileView } from './components/CustomizeProfileView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { ArenaGameCanvas } from './components/ArenaGameCanvas.tsx';
import { MatchResultsView } from './components/MatchResultsView.tsx';
import { AvatarCropModal } from './components/AvatarCropModal.tsx';
import { PlayerInfoModal } from './components/PlayerInfoModal.tsx';
import { PlayerAvatar } from './components/PlayerAvatar.tsx';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [account, setAccount] = useState<PlayerAccountBundle | null>(null);
  const [registeredPlayers, setRegisteredPlayers] = useState<PublicPlayerInfo[]>([]);
  const [view, setView] = useState<AppView>('lobby');
  const [selectedMode, setSelectedMode] = useState<GameMode>('skirmish_3v3');
  const [lastMatch, setLastMatch] = useState<MatchRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [inspectedPlayer, setInspectedPlayer] = useState<PublicPlayerInfo | null>(null);
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'login' | 'register' }>({
    open: false,
    mode: 'register',
  });

  async function refreshPlayers(): Promise<void> {
    const players = await fetchRegisteredPlayers().catch(() => []);
    setRegisteredPlayers(players);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [sessionRes, roster] = await Promise.all([
          fetchSession(),
          fetchRegisteredPlayers().catch(() => []),
        ]);
        if (!active) return;
        setRegisteredPlayers(roster);
        if (sessionRes) {
          setAccount(sessionRes.account);
        }
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  function handleAuthenticated(bundle: PlayerAccountBundle, welcomeMessage?: string): void {
    setAccount(bundle);
    setAuthModal((prev) => ({ ...prev, open: false }));
    setView('lobby');
    void refreshPlayers();
    if (welcomeMessage) {
      setToast(welcomeMessage);
    }
  }

  async function handleLogout(): Promise<void> {
    await logoutAccount();
    setAccount(null);
    setLastMatch(null);
    setView('lobby');
    void refreshPlayers();
  }

  async function handleQuickLoadoutChange(patch: {
    selectedCharacterId?: string;
    favoriteWeaponId?: string;
  }): Promise<void> {
    if (!account) return;
    const res = await updateProfile(patch);
    setAccount(res.account);
    void refreshPlayers();
  }

  async function handleUploadAvatar(imageDataUrl: string): Promise<void> {
    const res = await uploadAvatarPicture(imageDataUrl);
    setAccount(res.account);
    void refreshPlayers();
    setToast(res.message);
  }

  async function handleRemoveAvatar(): Promise<void> {
    const res = await removeAvatarPicture();
    setAccount(res.account);
    void refreshPlayers();
    setToast(res.message);
  }

  async function handleMatchFinished(result: {
    mode: GameMode;
    outcome: 'victory' | 'defeat';
    kills: number;
    deaths: number;
    score: number;
    durationSec: number;
    participants: MatchParticipantResult[];
  }): Promise<void> {
    try {
      const res = await recordArenaMatch(result);
      setAccount(res.bundle);
      setLastMatch(res.match);
      setView('results');
      void refreshPlayers();
    } catch {
      setView('lobby');
    }
  }

  if (initializing) {
    return (
      <div className="min-h-screen w-full bg-[#0B0F17] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading InspiredPVP...</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <>
        <LandingPage
          players={registeredPlayers}
          onOpenAuth={(mode) => setAuthModal({ open: true, mode })}
          onInspectPlayer={(p) => setInspectedPlayer(p)}
        />
        <AuthScreen
          isOpen={authModal.open}
          initialMode={authModal.mode}
          onClose={() => setAuthModal((prev) => ({ ...prev, open: false }))}
          onAuthenticated={handleAuthenticated}
        />
        <PlayerInfoModal player={inspectedPlayer} onClose={() => setInspectedPlayer(null)} />
      </>
    );
  }

  if (view === 'playing') {
    return (
      <ArenaGameCanvas
        account={account}
        players={registeredPlayers}
        mode={selectedMode}
        onMatchFinished={(res) => void handleMatchFinished(res)}
        onExitToLobby={() => setView('lobby')}
      />
    );
  }

  const navItems: { id: AppView; label: string }[] = [
    { id: 'lobby', label: 'Lobby' },
    { id: 'profile', label: 'Profile' },
    { id: 'customize', label: 'Customize' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Three-Zone Game Shell Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0B0F17]/95 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => setView('lobby')}
            className="font-display text-2xl font-bold tracking-wider text-slate-100 hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            InspiredPVP
          </button>

          {/* Zone 2: Single-line Nav Links */}
          <nav className="flex items-center gap-4 sm:gap-7 overflow-x-auto">
            {navItems.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`text-sm font-semibold py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'text-amber-400 border-amber-400'
                      : 'text-slate-400 border-transparent hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Active Player Chip + Logout */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 tabular-nums">
              <Coins className="w-3.5 h-3.5" />
              {account.profile.coins.toLocaleString()}
            </span>

            <button
              type="button"
              onClick={() => setView('profile')}
              className="flex items-center gap-2.5 rounded-xl bg-[#151C28] hover:bg-[#1C2536] border border-white/10 pl-1.5 pr-3 py-1 transition-colors cursor-pointer"
              title="Open Player Profile"
            >
              <PlayerAvatar
                profilePictureUrl={account.profile.profilePictureUrl}
                selectedAvatarId={account.profile.selectedAvatarId}
                profileThemeId={account.profile.profileThemeId}
                displayName={account.profile.displayName}
                size="xs"
              />
              <span className="hidden sm:inline text-xs font-semibold text-slate-100 max-w-[110px] truncate">
                {account.profile.displayName}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              title="Log Out"
              aria-label="Log Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Success / Status Toast */}
      {toast && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toast}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="text-emerald-300/70 hover:text-emerald-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Active View */}
      <main className="flex-1">
        {view === 'lobby' && (
          <LobbyView
            account={account}
            players={registeredPlayers}
            selectedMode={selectedMode}
            onChangeMode={setSelectedMode}
            onQuickLoadoutChange={handleQuickLoadoutChange}
            onStartMatch={() => setView('playing')}
            onNavigate={setView}
            onInspectPlayer={(p) => setInspectedPlayer(p)}
            onOpenAvatarUpload={() => setAvatarModalOpen(true)}
          />
        )}

        {view === 'profile' && (
          <ProfileView
            account={account}
            onNavigate={setView}
            onOpenAvatarUpload={() => setAvatarModalOpen(true)}
          />
        )}

        {view === 'customize' && (
          <CustomizeProfileView
            account={account}
            onAccountUpdated={(updated) => {
              setAccount(updated);
              void refreshPlayers();
            }}
            onOpenAvatarUpload={() => setAvatarModalOpen(true)}
            onRemoveAvatarPicture={handleRemoveAvatar}
          />
        )}

        {view === 'settings' && (
          <SettingsView
            account={account}
            onAccountUpdated={(updated) => {
              setAccount(updated);
              void refreshPlayers();
            }}
            onOpenAvatarUpload={() => setAvatarModalOpen(true)}
            onRemoveAvatarPicture={handleRemoveAvatar}
            onNavigate={setView}
            onLogout={handleLogout}
          />
        )}

        {view === 'results' && lastMatch && (
          <MatchResultsView
            account={account}
            match={lastMatch}
            players={registeredPlayers}
            onPlayAgain={() => setView('playing')}
            onReturnToLobby={() => setView('lobby')}
            onInspectPlayer={(p) => setInspectedPlayer(p)}
          />
        )}
      </main>

      <AvatarCropModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        onUploadComplete={handleUploadAvatar}
      />

      <PlayerInfoModal player={inspectedPlayer} onClose={() => setInspectedPlayer(null)} />
    </div>
  );
}
