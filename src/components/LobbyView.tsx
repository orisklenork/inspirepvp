import { useState } from 'react';
import {
  Play,
  Shield,
  Crosshair,
  Users,
  Coins,
  Sliders,
  Shuffle,
  PlusCircle,
  DoorOpen,
  Send,
  Copy,
  Check,
  Target,
  Loader2,
  X,
  UserCheck,
} from 'lucide-react';
import {
  CHARACTERS,
  WEAPONS,
  getBackgroundById,
  getCharacterById,
  getThemeById,
  getWeaponById,
  getXpForNextLevel,
} from '../lib/catalog.ts';
import {
  createBattleRoom,
  joinBattleRoom,
  joinRandomMatchmaking,
  leaveBattleRoom,
  leaveRandomMatchmaking,
  respondToInvite,
  sendRoomInvite,
  startBattleRoom,
} from '../lib/api.ts';
import type {
  AppView,
  GameMode,
  GameRoom,
  MatchmakingStatus,
  OnlinePlayerPresence,
  PlayerAccountBundle,
  PublicPlayerInfo,
  RoomInvite,
} from '../types/game.ts';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface LobbyViewProps {
  account: PlayerAccountBundle;
  players: PublicPlayerInfo[];
  onlinePlayers: OnlinePlayerPresence[];
  incomingInvites: RoomInvite[];
  openRooms: GameRoom[];
  activeRoom: GameRoom | null;
  matchmaking: MatchmakingStatus;
  onSetActiveRoom: (room: GameRoom | null) => void;
  onRefreshMultiplayer: () => Promise<void>;
  onQuickLoadoutChange: (patch: {
    selectedCharacterId?: string;
    favoriteWeaponId?: string;
  }) => Promise<void>;
  onEnterBattle: (mode: GameMode, room: GameRoom | null) => void;
  onNavigate: (view: AppView) => void;
  onInspectPlayer: (player: PublicPlayerInfo) => void;
  onOpenAvatarUpload: () => void;
  onNotify: (msg: string) => void;
}

export function LobbyView({
  account,
  players,
  onlinePlayers,
  incomingInvites,
  openRooms,
  activeRoom,
  matchmaking,
  onSetActiveRoom,
  onRefreshMultiplayer,
  onQuickLoadoutChange,
  onEnterBattle,
  onNavigate,
  onInspectPlayer,
  onOpenAvatarUpload,
  onNotify,
}: LobbyViewProps) {
  const { profile, stats } = account;
  const bg = getBackgroundById(profile.profileBackgroundId);
  const theme = getThemeById(profile.profileThemeId);
  const character = getCharacterById(profile.selectedCharacterId);
  const weapon = getWeaponById(profile.favoriteWeaponId);
  const nextXp = getXpForNextLevel(profile.level);
  const xpPct = Math.min(100, Math.round((profile.xp / nextXp) * 100));

  const [joinCode, setJoinCode] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const onlineMap = new Map(onlinePlayers.map((o) => [o.player.profile.playerId, o]));
  const otherRegistered = players.filter((p) => p.profile.playerId !== profile.playerId);
  const sortedRoster = [...otherRegistered].sort((a, b) => {
    const aOn = onlineMap.has(a.profile.playerId) ? 1 : 0;
    const bOn = onlineMap.has(b.profile.playerId) ? 1 : 0;
    return bOn - aOn || b.profile.level - a.profile.level;
  });

  async function handleCreateRoom(): Promise<void> {
    setErrorMsg(null);
    setBusyAction('create');
    try {
      const room = await createBattleRoom();
      onSetActiveRoom(room);
      onNotify(`Room ${room.code} created! Share the code or invite an online player.`);
      await onRefreshMultiplayer();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not create room.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleJoinCode(codeToJoin: string): Promise<void> {
    const cleaned = codeToJoin.trim().toUpperCase();
    if (!cleaned) {
      setErrorMsg('Enter a 6-character room code.');
      return;
    }
    setErrorMsg(null);
    setBusyAction('join');
    try {
      const room = await joinBattleRoom(cleaned);
      onSetActiveRoom(room);
      setJoinCode('');
      onNotify(`Joined room ${room.code}!`);
      await onRefreshMultiplayer();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not join room.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLeaveRoom(): Promise<void> {
    if (!activeRoom) return;
    setBusyAction('leave');
    try {
      await leaveBattleRoom(activeRoom.code);
      onSetActiveRoom(null);
      await onRefreshMultiplayer();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to leave room.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleStartRoom(): Promise<void> {
    if (!activeRoom) return;
    setErrorMsg(null);
    setBusyAction('start');
    try {
      const started = await startBattleRoom(activeRoom.code);
      onSetActiveRoom(started);
      onEnterBattle('1v1_duel', started);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not start match.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRandomMatch(): Promise<void> {
    setErrorMsg(null);
    setBusyAction('matchmaking');
    try {
      if (matchmaking.queued) {
        await leaveRandomMatchmaking();
        await onRefreshMultiplayer();
        return;
      }
      const res = await joinRandomMatchmaking();
      if (res.room) {
        onSetActiveRoom(res.room);
        onEnterBattle('1v1_duel', res.room);
      } else {
        await onRefreshMultiplayer();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Matchmaking failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleInvitePlayer(targetPlayerId: string, targetName: string): Promise<void> {
    setErrorMsg(null);
    setBusyAction(`invite:${targetPlayerId}`);
    try {
      const res = await sendRoomInvite(targetPlayerId, activeRoom?.code);
      onSetActiveRoom(res.room);
      onNotify(`1v1 invite sent to ${targetName} (Room ${res.room.code}).`);
      await onRefreshMultiplayer();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send invite.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRespondInvite(inviteId: string, accept: boolean): Promise<void> {
    setErrorMsg(null);
    setBusyAction(`inv:${inviteId}`);
    try {
      const res = await respondToInvite(inviteId, accept);
      if (res.status === 'accepted' && res.room) {
        onSetActiveRoom(res.room);
        onNotify(`Joined ${res.room.host.displayName}'s 1v1 room!`);
      }
      await onRefreshMultiplayer();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not respond to invite.');
    } finally {
      setBusyAction(null);
    }
  }

  function handleCopyCode(code: string): void {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  }

  const isHost = activeRoom ? activeRoom.host.playerId === profile.playerId : false;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Incoming Room Invites Banner */}
      {incomingInvites.length > 0 && (
        <div className="space-y-2.5">
          {incomingInvites.map((inv) => (
            <div
              key={inv.id}
              className="clay-card border-emerald-400/40 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <p className="text-xs font-mono font-bold text-emerald-400">INCOMING 1v1 INVITE</p>
                <p className="text-base font-bold text-white mt-0.5">
                  {inv.fromDisplayName} invited you to Room{' '}
                  <span className="font-mono text-orange-400">{inv.roomCode}</span>
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={busyAction === `inv:${inv.id}`}
                  onClick={() => void handleRespondInvite(inv.id, false)}
                  className="clay-btn-secondary px-4 py-2 text-xs font-bold cursor-pointer"
                >
                  Decline
                </button>
                <button
                  type="button"
                  disabled={busyAction === `inv:${inv.id}`}
                  onClick={() => void handleRespondInvite(inv.id, true)}
                  className="clay-btn-emerald px-5 py-2 text-xs font-extrabold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Accept &amp; Join</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl bg-rose-500/15 border border-rose-400/35 px-4 py-3 flex items-center justify-between text-sm text-rose-200">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Center Stage: 1v1 Room / Quick Match / Loadout */}
        <div className="lg:col-span-8 space-y-6">
          {activeRoom ? (
            /* Active 1v1 Room Staging */
            <div className="clay-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-mono font-bold text-orange-400">1v1 BATTLE ROOM</p>
                  <div className="flex items-center gap-3 mt-1">
                    <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-wider">
                      CODE: {activeRoom.code}
                    </h1>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(activeRoom.code)}
                      className="clay-btn-secondary px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busyAction === 'leave'}
                  onClick={() => void handleLeaveRoom()}
                  className="clay-btn-danger px-4 py-2.5 text-xs font-bold cursor-pointer self-start"
                >
                  Leave Room
                </button>
              </div>

              {/* 1v1 Duel Cards: Host vs Challenger */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="clay-panel p-4 border-emerald-400/35">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400 mb-3">
                    <span>HOST · TEAM ALPHA</span>
                    <span>READY</span>
                  </div>
                  <div className="flex items-center gap-3.5">
                    <PlayerAvatar
                      profilePictureUrl={activeRoom.host.profilePictureUrl}
                      selectedAvatarId={activeRoom.host.selectedAvatarId}
                      profileThemeId={activeRoom.host.profileThemeId}
                      displayName={activeRoom.host.displayName}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-base text-white truncate">
                        {activeRoom.host.displayName}
                      </p>
                      <p className="text-xs font-mono text-slate-400">
                        @{activeRoom.host.username} · Lv {activeRoom.host.level}
                      </p>
                      <p className="text-xs text-orange-300 mt-1">
                        {getCharacterById(activeRoom.host.characterId).name} ·{' '}
                        {getWeaponById(activeRoom.host.weaponId).name}
                      </p>
                    </div>
                  </div>
                </div>

                {activeRoom.guest ? (
                  <div className="clay-panel p-4 border-orange-400/35">
                    <div className="flex items-center justify-between text-xs font-bold text-orange-400 mb-3">
                      <span>CHALLENGER · TEAM BRAVO</span>
                      <span className="text-emerald-400">JOINED</span>
                    </div>
                    <div className="flex items-center gap-3.5">
                      <PlayerAvatar
                        profilePictureUrl={activeRoom.guest.profilePictureUrl}
                        selectedAvatarId={activeRoom.guest.selectedAvatarId}
                        profileThemeId={activeRoom.guest.profileThemeId}
                        displayName={activeRoom.guest.displayName}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-base text-white truncate">
                          {activeRoom.guest.displayName}
                        </p>
                        <p className="text-xs font-mono text-slate-400">
                          @{activeRoom.guest.username} · Lv {activeRoom.guest.level}
                        </p>
                        <p className="text-xs text-orange-300 mt-1">
                          {getCharacterById(activeRoom.guest.characterId).name} ·{' '}
                          {getWeaponById(activeRoom.guest.weaponId).name}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="clay-inset p-5 flex flex-col items-center justify-center text-center min-h-[126px]">
                    <Loader2 className="w-6 h-6 text-orange-400 animate-spin mb-2" />
                    <p className="text-sm font-bold text-slate-200">Waiting for Opponent...</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Share code <span className="font-mono text-orange-400">{activeRoom.code}</span> or
                      click Invite on an online player.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/10">
                <p className="text-xs text-slate-400">
                  Mode: 3D Courtyard 1v1 · First to {activeRoom.maxKills} eliminations wins
                </p>

                {isHost ? (
                  <button
                    type="button"
                    disabled={!activeRoom.guest || busyAction === 'start'}
                    onClick={() => void handleStartRoom()}
                    className="clay-btn-primary inline-flex items-center justify-center gap-2 font-extrabold text-base px-8 py-3.5 disabled:opacity-45 cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>{busyAction === 'start' ? 'Starting...' : 'Start 1v1 Battle'}</span>
                  </button>
                ) : (
                  <div className="clay-inset px-5 py-3 text-sm font-bold text-emerald-400">
                    Waiting for Host to start the battle...
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Free-Fire Clean 3-Path Entry */
            <div className="clay-card p-6 space-y-6">
              <div>
                <p className="text-xs font-mono font-bold text-orange-400">BATTLE LOBBY</p>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white mt-0.5">
                  Choose How to Deploy
                </h1>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Random 1v1 Quick Match */}
                <div className="clay-panel p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-orange-400">QUICK MATCH</span>
                      {matchmaking.queueCount > 0 && (
                        <span className="text-xs font-mono text-emerald-400">
                          {matchmaking.queueCount} Searching
                        </span>
                      )}
                    </div>
                    <h2 className="font-display text-2xl font-bold text-white mt-1">
                      Random 1v1 Join
                    </h2>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Automatically match with another real player queued right now and jump straight
                      into the 3D arena.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={busyAction === 'matchmaking'}
                    onClick={() => void handleRandomMatch()}
                    className={`w-full py-3.5 px-4 font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer ${
                      matchmaking.queued ? 'clay-btn-danger' : 'clay-btn-primary'
                    }`}
                  >
                    {matchmaking.queued ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Finding Player... (Cancel)</span>
                      </>
                    ) : (
                      <>
                        <Shuffle className="w-4 h-4" />
                        <span>Find Random 1v1 Match</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 2. Create Room */}
                <div className="clay-panel p-5 flex flex-col justify-between gap-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-emerald-400">PRIVATE OR OPEN</span>
                    <h2 className="font-display text-2xl font-bold text-white mt-1">
                      Create 1v1 Room
                    </h2>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Generate a 6-character Room Code, invite friends or online players, and launch
                      when both are ready.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={busyAction === 'create'}
                    onClick={() => void handleCreateRoom()}
                    className="clay-btn-emerald w-full py-3.5 px-4 font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{busyAction === 'create' ? 'Creating...' : 'Create Battle Room'}</span>
                  </button>
                </div>
              </div>

              {/* 3. Join Room by Code + Open Rooms */}
              <div className="clay-panel p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-bold text-white">Join Room by Code</h3>
                    <p className="text-xs text-slate-400">
                      Enter a friend&apos;s room code or pick an open room below
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleJoinCode(joinCode);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={8}
                      placeholder="ROOM CODE"
                      className="clay-input px-4 py-2.5 text-sm font-mono uppercase text-white placeholder:text-slate-500 w-36"
                    />
                    <button
                      type="submit"
                      disabled={busyAction === 'join'}
                      className="clay-btn-secondary px-5 py-2.5 text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <DoorOpen className="w-4 h-4 text-orange-400" />
                      <span>Join</span>
                    </button>
                  </form>
                </div>

                {openRooms.filter((r) => r.host.playerId !== profile.playerId).length > 0 && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <p className="text-xs font-semibold text-slate-400">Open Rooms Waiting</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {openRooms
                        .filter((r) => r.host.playerId !== profile.playerId)
                        .map((r) => (
                          <div
                            key={r.code}
                            className="clay-inset px-3.5 py-2.5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">
                                {r.host.displayName}
                              </p>
                              <p className="text-xs font-mono text-orange-400">Code: {r.code}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleJoinCode(r.code)}
                              className="clay-btn-primary px-3.5 py-1.5 text-xs font-bold cursor-pointer shrink-0"
                            >
                              Join 1v1
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Loadout & 3D Firing Range */}
          <div className="clay-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">Combat Loadout</h2>
                <p className="text-xs text-slate-400">
                  Equip your operative and primary 3D gun, or test your controls in the Firing Range
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEnterBattle('training_range', null)}
                className="clay-btn-secondary px-4 py-2.5 text-xs font-bold inline-flex items-center gap-2 cursor-pointer self-start"
              >
                <Target className="w-4 h-4 text-orange-400" />
                <span>Open 3D Firing Range</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="lobby-character"
                  className="block text-xs font-bold text-slate-300 mb-1.5"
                >
                  3D Operative Frame
                </label>
                <select
                  id="lobby-character"
                  value={profile.selectedCharacterId}
                  onChange={(e) =>
                    void onQuickLoadoutChange({ selectedCharacterId: e.target.value })
                  }
                  className="clay-input w-full px-3.5 py-3 text-sm text-white"
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
                  className="block text-xs font-bold text-slate-300 mb-1.5"
                >
                  Primary 3D Gun
                </label>
                <select
                  id="lobby-weapon"
                  value={profile.favoriteWeaponId}
                  onChange={(e) =>
                    void onQuickLoadoutChange({ favoriteWeaponId: e.target.value })
                  }
                  className="clay-input w-full px-3.5 py-3 text-sm text-white"
                >
                  {WEAPONS.filter((w) => profile.inventory.includes(w.id)).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Online Players to Invite + Player Profile Card */}
        <div className="lg:col-span-4 space-y-6">
          {/* Online & Registered Players Panel */}
          <div className="clay-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-white inline-flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-400" />
                <span>Players ({otherRegistered.length})</span>
              </h2>
              <span className="text-xs font-mono text-emerald-400">
                {Math.max(0, onlinePlayers.length - 1)} Online
              </span>
            </div>

            {sortedRoster.length === 0 ? (
              <div className="clay-inset p-4 text-center">
                <p className="text-xs font-semibold text-slate-300">No other registered players yet</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Share your Room Code or test your aim in the 3D Firing Range while friends sign up.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {sortedRoster.map((p) => {
                  const pres = onlineMap.get(p.profile.playerId);
                  const isOnline = Boolean(pres);
                  return (
                    <div
                      key={p.profile.playerId}
                      className="clay-inset p-3 flex items-center justify-between gap-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(p)}
                        className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                      >
                        <PlayerAvatar
                          profilePictureUrl={p.profile.profilePictureUrl}
                          selectedAvatarId={p.profile.selectedAvatarId}
                          profileThemeId={p.profile.profileThemeId}
                          displayName={p.profile.displayName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {p.profile.displayName}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">
                            Lv {p.profile.level} ·{' '}
                            <span className={isOnline ? 'text-emerald-400' : 'text-slate-500'}>
                              {pres
                                ? pres.status === 'in_match'
                                  ? 'In Match'
                                  : pres.status === 'in_room'
                                    ? 'In Room'
                                    : 'Online'
                                : 'Offline'}
                            </span>
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={busyAction === `invite:${p.profile.playerId}`}
                        onClick={() =>
                          void handleInvitePlayer(p.profile.playerId, p.profile.displayName)
                        }
                        className="clay-btn-primary px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                        title={`Invite ${p.profile.displayName} to 1v1`}
                      >
                        <Send className="w-3 h-3" />
                        <span>Invite</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Player Card Summary */}
          <div className={`clay-card overflow-hidden border ${theme.borderClass}`}>
            <div className={`relative h-24 bg-gradient-to-br ${bg.gradientClass}`}>
              {bg.imageUrl && (
                <img
                  src={bg.imageUrl}
                  alt={bg.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-55"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a2236] via-[#1a2236]/40 to-transparent" />
            </div>

            <div className="px-5 pb-5 -mt-10 relative">
              <div className="flex items-end justify-between gap-3">
                <button
                  type="button"
                  onClick={onOpenAvatarUpload}
                  className="cursor-pointer"
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
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-orange-400 tabular-nums">
                    <Coins className="w-4 h-4" />
                    {profile.coins.toLocaleString()}
                  </span>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{profile.playerId}</p>
                </div>
              </div>

              <div className="mt-3">
                <h2 className="font-display text-2xl font-bold text-white truncate">
                  {profile.displayName}
                </h2>
                <p className="text-xs text-slate-400 font-mono">@{profile.username}</p>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className={`font-bold ${theme.badgeTextClass}`}>Level {profile.level}</span>
                  <span className="text-slate-400 tabular-nums">
                    {profile.xp} / {nextXp} XP
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-[#101624] overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all duration-300"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                <div className="clay-inset p-2.5">
                  <span className="text-slate-400 inline-flex items-center gap-1">
                    <Shield className="w-3 h-3 text-orange-400" />
                    Operative
                  </span>
                  <p className="font-bold text-white mt-0.5 truncate">{character.name}</p>
                </div>
                <div className="clay-inset p-2.5">
                  <span className="text-slate-400 inline-flex items-center gap-1">
                    <Crosshair className="w-3 h-3 text-orange-400" />
                    Primary Gun
                  </span>
                  <p className="font-bold text-white mt-0.5 truncate">{weapon.name}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="clay-inset p-2">
                  <p className="text-[11px] text-slate-400">Kills</p>
                  <p className="text-sm font-bold text-white tabular-nums">{stats.totalKills}</p>
                </div>
                <div className="clay-inset p-2">
                  <p className="text-[11px] text-slate-400">Wins</p>
                  <p className="text-sm font-bold text-emerald-400 tabular-nums">{stats.totalWins}</p>
                </div>
                <div className="clay-inset p-2">
                  <p className="text-[11px] text-slate-400">Win %</p>
                  <p className="text-sm font-bold text-white tabular-nums">{stats.winRate}%</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate('customize')}
                  className="clay-btn-secondary inline-flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 px-3 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Armory &amp; Look</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('profile')}
                  className="clay-btn-secondary inline-flex items-center justify-center text-xs font-bold py-2.5 px-3 cursor-pointer"
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
