import { useCallback, useEffect, useState } from 'react';
import { Coins, LogOut, CheckCircle2, X } from 'lucide-react';
import {
  fetchBattleRoom,
  fetchOpenRooms,
  fetchRegisteredPlayers,
  fetchSession,
  logoutAccount,
  pingPresence,
  recordArenaMatch,
  removeAvatarPicture,
  updateProfile,
  uploadAvatarPicture,
} from './lib/api.ts';
import type {
  AppView,
  GameMode,
  GameRoom,
  MatchParticipantResult,
  MatchRecord,
  MatchmakingStatus,
  OnlinePlayerPresence,
  PlayerAccountBundle,
  PublicPlayerInfo,
  RoomInvite,
} from './types/game.ts';
import { LandingPage } from './components/LandingPage.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { LobbyView } from './components/LobbyView.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { CustomizeProfileView } from './components/CustomizeProfileView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { Arena3DView } from './components/Arena3DView.tsx';
import { MatchResultsView } from './components/MatchResultsView.tsx';
import { AvatarCropModal } from './components/AvatarCropModal.tsx';
import { PlayerInfoModal } from './components/PlayerInfoModal.tsx';
import { PlayerAvatar } from './components/PlayerAvatar.tsx';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [account, setAccount] = useState<PlayerAccountBundle | null>(null);
  const [registeredPlayers, setRegisteredPlayers] = useState<PublicPlayerInfo[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayerPresence[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<RoomInvite[]>([]);
  const [openRooms, setOpenRooms] = useState<GameRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
  const [matchmaking, setMatchmaking] = useState<MatchmakingStatus>({
    queued: false,
    matchedRoomCode: null,
    queueCount: 0,
  });

  const [view, setView] = useState<AppView>('lobby');
  const [selectedMode, setSelectedMode] = useState<GameMode>('1v1_duel');
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

  const refreshMultiplayer = useCallback(async () => {
    if (!account || view === 'playing') return;
    try {
      const status = activeRoom ? 'in_room' : 'online';
      const [pingRes, roomsList] = await Promise.all([
        pingPresence(status, activeRoom?.code ?? null),
        fetchOpenRooms().catch(() => []),
      ]);
      setOnlinePlayers(pingRes.onlinePlayers);
      setIncomingInvites(pingRes.incomingInvites);
      setMatchmaking(pingRes.matchmaking);
      setOpenRooms(roomsList);

      // Handle random matchmaking match found!
      if (pingRes.matchmaking.matchedRoomCode) {
        const matched = await fetchBattleRoom(pingRes.matchmaking.matchedRoomCode).catch(() => null);
        if (matched) {
          setActiveRoom(matched);
          setSelectedMode('1v1_duel');
          setView('playing');
          return;
        }
      }

      // Sync active room updates (guest joined OR host started battle!)
      if (activeRoom) {
        const updatedRoom = await fetchBattleRoom(activeRoom.code).catch(() => null);
        if (!updatedRoom) {
          setActiveRoom(null);
        } else {
          setActiveRoom(updatedRoom);
          if (updatedRoom.status === 'playing') {
            setSelectedMode('1v1_duel');
            setView('playing');
          }
        }
      } else if (pingRes.activeRoom && pingRes.activeRoom.status === 'playing') {
        setActiveRoom(pingRes.activeRoom);
        setSelectedMode('1v1_duel');
        setView('playing');
      }
    } catch {
      // Ignore transient heartbeat errors
    }
  }, [account, activeRoom, view]);

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

  // Live lobby heartbeat (polls every 1.4s when in lobby / waiting room / matchmaking queue)
  useEffect(() => {
    if (!account || view === 'playing') return;
    void refreshMultiplayer();
    const delay = activeRoom || matchmaking.queued ? 1000 : 2500;
    const id = window.setInterval(() => {
      void refreshMultiplayer();
    }, delay);
    return () => window.clearInterval(id);
  }, [account, view, activeRoom, matchmaking.queued, refreshMultiplayer]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
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
    setActiveRoom(null);
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
    setActiveRoom(null);
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
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-3 border-orange-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Loading InspiredPVP...</p>
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
      <Arena3DView
        account={account}
        mode={selectedMode}
        room={activeRoom}
        onMatchFinished={(res) => void handleMatchFinished(res)}
        onExitToLobby={() => {
          setActiveRoom(null);
          setView('lobby');
          void refreshMultiplayer();
        }}
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
    <div className="min-h-screen text-slate-100 flex flex-col">
      {/* Claymorphism Navigation Shell */}
      <header className="sticky top-0 z-30 bg-[#121826]/95 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setView('lobby')}
            className="font-display text-2xl sm:text-3xl font-extrabold tracking-wider text-white hover:text-orange-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Inspired<span className="text-orange-400">PVP</span>
          </button>

          <nav className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
            {navItems.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`text-xs sm:text-sm font-bold px-3.5 py-2 rounded-2xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'clay-btn-primary'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-orange-400 tabular-nums clay-inset px-3 py-1.5">
              <Coins className="w-3.5 h-3.5" />
              {account.profile.coins.toLocaleString()}
            </span>

            <button
              type="button"
              onClick={() => setView('profile')}
              className="clay-btn-secondary flex items-center gap-2 pl-1.5 pr-3 py-1 cursor-pointer"
              title="Open Player Profile"
            >
              <PlayerAvatar
                profilePictureUrl={account.profile.profilePictureUrl}
                selectedAvatarId={account.profile.selectedAvatarId}
                profileThemeId={account.profile.profileThemeId}
                displayName={account.profile.displayName}
                size="xs"
              />
              <span className="hidden sm:inline text-xs font-bold text-white max-w-[110px] truncate">
                {account.profile.displayName}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              title="Log Out"
              aria-label="Log Out"
              className="clay-btn-secondary p-2 text-slate-300 hover:text-rose-400 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {toast && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4">
          <div className="clay-panel border-emerald-400/35 px-4 py-3 flex items-center justify-between gap-3 text-sm text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toast}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="text-emerald-300/70 hover:text-emerald-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {view === 'lobby' && (
          <LobbyView
            account={account}
            players={registeredPlayers}
            onlinePlayers={onlinePlayers}
            incomingInvites={incomingInvites}
            openRooms={openRooms}
            activeRoom={activeRoom}
            matchmaking={matchmaking}
            onSetActiveRoom={setActiveRoom}
            onRefreshMultiplayer={refreshMultiplayer}
            onQuickLoadoutChange={handleQuickLoadoutChange}
            onEnterBattle={(mode, room) => {
              setSelectedMode(mode);
              setActiveRoom(room);
              setView('playing');
            }}
            onNavigate={setView}
            onInspectPlayer={(p) => setInspectedPlayer(p)}
            onOpenAvatarUpload={() => setAvatarModalOpen(true)}
            onNotify={(msg) => setToast(msg)}
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
            onPlayAgain={() => setView('lobby')}
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
