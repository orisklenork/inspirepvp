import crypto from 'node:crypto';
import type {
  CombatEvent,
  CombatSyncResponse,
  GameRoom,
  LiveCombatActorState,
  MatchmakingStatus,
  OnlinePlayerPresence,
  PublicPlayerInfo,
  RoomInvite,
  RoomParticipant,
} from '../src/types/game.ts';
import {
  ARENA_HALF_EXTENT,
  DEFAULT_MAX_KILLS,
  clampCoord,
  createSpawnActorState,
  generateRoomCode,
  getCharacterMaxHp,
  normalizeRoomCode,
} from './multiplayerUtils.ts';
import { getAccountBundle, getPublicPlayerByPlayerId, getRegisteredPlayers } from './store.ts';

interface LocalPresenceRecord {
  userId: string;
  playerId: string;
  status: 'online' | 'in_room' | 'in_match';
  currentRoomCode: string | null;
  lastSeenMs: number;
}

interface LocalRoomRecord {
  code: string;
  hostUserId: string;
  hostPlayerId: string;
  guestUserId: string | null;
  guestPlayerId: string | null;
  status: 'waiting' | 'playing' | 'finished';
  maxKills: number;
  hostReady: boolean;
  guestReady: boolean;
  hostKills: number;
  guestKills: number;
  hostDeaths: number;
  guestDeaths: number;
  hostState: LiveCombatActorState | null;
  guestState: LiveCombatActorState | null;
  combatEvents: CombatEvent[];
  winnerPlayerId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAtMs: number;
  updatedAt: string;
}

interface LocalInviteRecord {
  id: string;
  roomCode: string;
  fromUserId: string;
  fromPlayerId: string;
  fromDisplayName: string;
  fromAvatarUrl: string | null;
  toUserId: string;
  toPlayerId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  createdAtMs: number;
}

interface LocalQueueRecord {
  userId: string;
  playerId: string;
  displayName: string;
  matchedRoomCode: string | null;
  queuedAtMs: number;
  updatedAtMs: number;
}

const presenceMap = new Map<string, LocalPresenceRecord>();
const roomsMap = new Map<string, LocalRoomRecord>();
const invitesMap = new Map<string, LocalInviteRecord>();
const queueMap = new Map<string, LocalQueueRecord>();

function hydrateLocalRoom(r: LocalRoomRecord): GameRoom {
  const hostBundle = getAccountBundle(r.hostUserId);
  const guestBundle = r.guestUserId ? getAccountBundle(r.guestUserId) : null;

  const host: RoomParticipant = {
    playerId: r.hostPlayerId,
    username: hostBundle?.profile.username ?? 'Host',
    displayName: hostBundle?.profile.displayName ?? 'Host',
    profilePictureUrl: hostBundle?.profile.profilePictureUrl ?? null,
    selectedAvatarId: hostBundle?.profile.selectedAvatarId ?? 'vanguard',
    profileThemeId: hostBundle?.profile.profileThemeId ?? 'amber_vanguard',
    characterId: hostBundle?.profile.selectedCharacterId ?? 'vanguard',
    weaponId: hostBundle?.profile.favoriteWeaponId ?? 'pulse_rifle',
    level: hostBundle?.profile.level ?? 1,
    ready: r.hostReady,
    kills: r.hostKills,
    deaths: r.hostDeaths,
  };

  const guest: RoomParticipant | null =
    r.guestUserId && r.guestPlayerId
      ? {
          playerId: r.guestPlayerId,
          username: guestBundle?.profile.username ?? 'Guest',
          displayName: guestBundle?.profile.displayName ?? 'Guest',
          profilePictureUrl: guestBundle?.profile.profilePictureUrl ?? null,
          selectedAvatarId: guestBundle?.profile.selectedAvatarId ?? 'specter',
          profileThemeId: guestBundle?.profile.profileThemeId ?? 'sky_interceptor',
          characterId: guestBundle?.profile.selectedCharacterId ?? 'specter',
          weaponId: guestBundle?.profile.favoriteWeaponId ?? 'pulse_rifle',
          level: guestBundle?.profile.level ?? 1,
          ready: r.guestReady,
          kills: r.guestKills,
          deaths: r.guestDeaths,
        }
      : null;

  return {
    code: r.code,
    status: r.status,
    mode: '1v1_duel',
    maxKills: r.maxKills,
    host,
    guest,
    winnerPlayerId: r.winnerPlayerId,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    updatedAt: r.updatedAt,
  };
}

export function localPresencePing(
  userId: string,
  status: 'online' | 'in_room' | 'in_match' = 'online',
  currentRoomCode: string | null = null
): {
  onlinePlayers: OnlinePlayerPresence[];
  incomingInvites: RoomInvite[];
  activeRoom: GameRoom | null;
  matchmaking: MatchmakingStatus;
} {
  const account = getAccountBundle(userId);
  if (!account) throw new Error('Player profile not found.');

  const now = Date.now();
  presenceMap.set(userId, {
    userId,
    playerId: account.profile.playerId,
    status,
    currentRoomCode,
    lastSeenMs: now,
  });

  const roster = getRegisteredPlayers(50);
  const playerById = new Map<string, PublicPlayerInfo>(
    roster.map((p) => [p.profile.playerId, p])
  );

  const onlinePlayers: OnlinePlayerPresence[] = [];
  for (const [uid, rec] of presenceMap.entries()) {
    if (now - rec.lastSeenMs > 45_000) {
      presenceMap.delete(uid);
      continue;
    }
    const player = playerById.get(rec.playerId);
    if (player) {
      onlinePlayers.push({
        player,
        status: rec.status,
        currentRoomCode: rec.currentRoomCode,
        lastSeenAt: new Date(rec.lastSeenMs).toISOString(),
      });
    }
  }

  const incomingInvites: RoomInvite[] = [];
  for (const inv of invitesMap.values()) {
    if (inv.toUserId === userId && inv.status === 'pending' && now - inv.createdAtMs < 5 * 60_000) {
      incomingInvites.push({
        id: inv.id,
        roomCode: inv.roomCode,
        fromPlayerId: inv.fromPlayerId,
        fromDisplayName: inv.fromDisplayName,
        fromAvatarUrl: inv.fromAvatarUrl,
        toPlayerId: inv.toPlayerId,
        status: inv.status,
        createdAt: inv.createdAt,
      });
    }
  }

  const q = queueMap.get(userId);
  const matchedRoomCode = q?.matchedRoomCode ?? null;
  if (matchedRoomCode) {
    queueMap.delete(userId);
  }

  let activeRoom: GameRoom | null = null;
  for (const r of roomsMap.values()) {
    if (
      (r.hostUserId === userId || r.guestUserId === userId) &&
      (r.status === 'waiting' || r.status === 'playing')
    ) {
      activeRoom = hydrateLocalRoom(r);
      break;
    }
  }

  let queueCount = 0;
  for (const [uid, qr] of queueMap.entries()) {
    if (now - qr.updatedAtMs > 45_000) {
      queueMap.delete(uid);
    } else if (!qr.matchedRoomCode) {
      queueCount += 1;
    }
  }

  return {
    onlinePlayers,
    incomingInvites,
    activeRoom,
    matchmaking: {
      queued: Boolean(q && !matchedRoomCode),
      matchedRoomCode,
      queueCount,
    },
  };
}

export function localGetOpenRooms(): GameRoom[] {
  const now = Date.now();
  const list: GameRoom[] = [];
  for (const r of roomsMap.values()) {
    if (r.status === 'waiting' && !r.guestUserId && now - r.createdAtMs < 30 * 60_000) {
      list.push(hydrateLocalRoom(r));
    }
  }
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function localCreateRoom(userId: string): GameRoom {
  const account = getAccountBundle(userId);
  if (!account) throw new Error('Player profile not found.');

  for (const [code, r] of roomsMap.entries()) {
    if (r.hostUserId === userId && r.status === 'waiting') {
      roomsMap.delete(code);
    }
  }

  let code = generateRoomCode();
  while (roomsMap.has(code)) {
    code = generateRoomCode();
  }

  const nowIso = new Date().toISOString();
  const rec: LocalRoomRecord = {
    code,
    hostUserId: userId,
    hostPlayerId: account.profile.playerId,
    guestUserId: null,
    guestPlayerId: null,
    status: 'waiting',
    maxKills: DEFAULT_MAX_KILLS,
    hostReady: true,
    guestReady: false,
    hostKills: 0,
    guestKills: 0,
    hostDeaths: 0,
    guestDeaths: 0,
    hostState: null,
    guestState: null,
    combatEvents: [],
    winnerPlayerId: null,
    startedAt: null,
    endedAt: null,
    createdAtMs: Date.now(),
    updatedAt: nowIso,
  };
  roomsMap.set(code, rec);
  return hydrateLocalRoom(rec);
}

export function localJoinRoom(userId: string, rawCode: string): GameRoom {
  const code = normalizeRoomCode(rawCode);
  const rec = roomsMap.get(code);
  if (!rec) throw new Error('Room not found. Check the code and try again.');

  const account = getAccountBundle(userId);
  if (!account) throw new Error('Player profile not found.');

  if (rec.hostUserId === userId || rec.guestUserId === userId) {
    return hydrateLocalRoom(rec);
  }
  if (rec.status !== 'waiting') throw new Error('This room has already started or finished.');
  if (rec.guestUserId) throw new Error('Room is already full (1v1).');

  rec.guestUserId = userId;
  rec.guestPlayerId = account.profile.playerId;
  rec.guestReady = true;
  rec.updatedAt = new Date().toISOString();
  return hydrateLocalRoom(rec);
}

export function localGetRoom(userId: string, rawCode: string): GameRoom {
  const code = normalizeRoomCode(rawCode);
  const rec = roomsMap.get(code);
  if (!rec) throw new Error('Room closed or not found.');
  if (rec.status !== 'waiting' && rec.hostUserId !== userId && rec.guestUserId !== userId) {
    throw new Error('You are not a participant in this room.');
  }
  return hydrateLocalRoom(rec);
}

export function localToggleRoomReady(userId: string, rawCode: string, ready: boolean): GameRoom {
  const code = normalizeRoomCode(rawCode);
  const rec = roomsMap.get(code);
  if (!rec) throw new Error('Room not found.');
  if (rec.hostUserId === userId) rec.hostReady = Boolean(ready);
  else if (rec.guestUserId === userId) rec.guestReady = Boolean(ready);
  else throw new Error('You are not in this room.');
  rec.updatedAt = new Date().toISOString();
  return hydrateLocalRoom(rec);
}

export function localStartRoomMatch(userId: string, rawCode: string): GameRoom {
  const code = normalizeRoomCode(rawCode);
  const rec = roomsMap.get(code);
  if (!rec) throw new Error('Room not found.');
  if (rec.hostUserId !== userId) throw new Error('Only the room host can start the battle.');
  if (!rec.guestUserId || !rec.guestPlayerId) {
    throw new Error('Waiting for a second player to join the room.');
  }

  const hostB = getAccountBundle(rec.hostUserId);
  const guestB = getAccountBundle(rec.guestUserId);
  rec.status = 'playing';
  rec.hostKills = 0;
  rec.guestKills = 0;
  rec.hostDeaths = 0;
  rec.guestDeaths = 0;
  rec.hostState = createSpawnActorState(
    rec.hostPlayerId,
    hostB?.profile.selectedCharacterId ?? 'vanguard',
    hostB?.profile.favoriteWeaponId ?? 'pulse_rifle',
    'host'
  );
  rec.guestState = createSpawnActorState(
    rec.guestPlayerId,
    guestB?.profile.selectedCharacterId ?? 'specter',
    guestB?.profile.favoriteWeaponId ?? 'pulse_rifle',
    'guest'
  );
  rec.combatEvents = [];
  rec.winnerPlayerId = null;
  rec.startedAt = new Date().toISOString();
  rec.endedAt = null;
  rec.updatedAt = rec.startedAt;
  return hydrateLocalRoom(rec);
}

export function localLeaveRoom(userId: string, rawCode: string): void {
  const code = normalizeRoomCode(rawCode);
  const rec = roomsMap.get(code);
  if (!rec) return;

  if (rec.status === 'waiting') {
    if (rec.hostUserId === userId) {
      roomsMap.delete(code);
    } else if (rec.guestUserId === userId) {
      rec.guestUserId = null;
      rec.guestPlayerId = null;
      rec.guestReady = false;
      rec.updatedAt = new Date().toISOString();
    }
    return;
  }

  if (rec.status === 'playing' && (rec.hostUserId === userId || rec.guestUserId === userId)) {
    rec.status = 'finished';
    rec.winnerPlayerId = rec.hostUserId === userId ? rec.guestPlayerId : rec.hostPlayerId;
    rec.endedAt = new Date().toISOString();
    rec.updatedAt = rec.endedAt;
  }
}

export function localSendInvite(
  userId: string,
  targetPlayerId: string,
  rawRoomCode?: string
): { invite: RoomInvite; room: GameRoom } {
  const sender = getAccountBundle(userId);
  if (!sender) throw new Error('Player profile not found.');
  if (sender.profile.playerId === targetPlayerId) {
    throw new Error('You cannot invite yourself.');
  }

  const target = getPublicPlayerByPlayerId(targetPlayerId);
  if (!target) throw new Error('Target player not found.');

  // Find target userId via presence or roster scan
  let targetUserId: string | null = null;
  for (const p of presenceMap.values()) {
    if (p.playerId === targetPlayerId) {
      targetUserId = p.userId;
      break;
    }
  }
  if (!targetUserId) {
    throw new Error('Player is currently offline.');
  }

  let room: GameRoom;
  const code = normalizeRoomCode(rawRoomCode);
  if (code && roomsMap.get(code)?.status === 'waiting') {
    room = localGetRoom(userId, code);
  } else {
    room = localCreateRoom(userId);
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const inv: LocalInviteRecord = {
    id,
    roomCode: room.code,
    fromUserId: userId,
    fromPlayerId: sender.profile.playerId,
    fromDisplayName: sender.profile.displayName,
    fromAvatarUrl: sender.profile.profilePictureUrl,
    toUserId: targetUserId,
    toPlayerId: targetPlayerId,
    status: 'pending',
    createdAt: new Date(now).toISOString(),
    createdAtMs: now,
  };
  invitesMap.set(id, inv);

  return {
    invite: {
      id: inv.id,
      roomCode: inv.roomCode,
      fromPlayerId: inv.fromPlayerId,
      fromDisplayName: inv.fromDisplayName,
      fromAvatarUrl: inv.fromAvatarUrl,
      toPlayerId: inv.toPlayerId,
      status: inv.status,
      createdAt: inv.createdAt,
    },
    room,
  };
}

export function localRespondInvite(
  userId: string,
  inviteId: string,
  accept: boolean
): { status: 'accepted' | 'declined'; room?: GameRoom } {
  const inv = invitesMap.get(inviteId);
  if (!inv || inv.toUserId !== userId) {
    throw new Error('Invite not found or expired.');
  }
  inv.status = accept ? 'accepted' : 'declined';
  if (!accept) return { status: 'declined' };
  const room = localJoinRoom(userId, inv.roomCode);
  return { status: 'accepted', room };
}

export function localJoinMatchmaking(
  userId: string
): { status: MatchmakingStatus; room: GameRoom | null } {
  const account = getAccountBundle(userId);
  if (!account) throw new Error('Player profile not found.');
  const now = Date.now();

  let peer: LocalQueueRecord | null = null;
  for (const qr of queueMap.values()) {
    if (qr.userId !== userId && !qr.matchedRoomCode && now - qr.updatedAtMs < 30_000) {
      if (!peer || qr.queuedAtMs < peer.queuedAtMs) {
        peer = qr;
      }
    }
  }

  if (peer) {
    let code = generateRoomCode();
    while (roomsMap.has(code)) code = generateRoomCode();
    const peerB = getAccountBundle(peer.userId);
    const nowIso = new Date(now).toISOString();
    const rec: LocalRoomRecord = {
      code,
      hostUserId: peer.userId,
      hostPlayerId: peer.playerId,
      guestUserId: userId,
      guestPlayerId: account.profile.playerId,
      status: 'playing',
      maxKills: DEFAULT_MAX_KILLS,
      hostReady: true,
      guestReady: true,
      hostKills: 0,
      guestKills: 0,
      hostDeaths: 0,
      guestDeaths: 0,
      hostState: createSpawnActorState(
        peer.playerId,
        peerB?.profile.selectedCharacterId ?? 'vanguard',
        peerB?.profile.favoriteWeaponId ?? 'pulse_rifle',
        'host'
      ),
      guestState: createSpawnActorState(
        account.profile.playerId,
        account.profile.selectedCharacterId,
        account.profile.favoriteWeaponId,
        'guest'
      ),
      combatEvents: [],
      winnerPlayerId: null,
      startedAt: nowIso,
      endedAt: null,
      createdAtMs: now,
      updatedAt: nowIso,
    };
    roomsMap.set(code, rec);
    peer.matchedRoomCode = code;
    peer.updatedAtMs = now;
    queueMap.delete(userId);
    return {
      status: { queued: false, matchedRoomCode: code, queueCount: 0 },
      room: hydrateLocalRoom(rec),
    };
  }

  queueMap.set(userId, {
    userId,
    playerId: account.profile.playerId,
    displayName: account.profile.displayName,
    matchedRoomCode: null,
    queuedAtMs: now,
    updatedAtMs: now,
  });

  const count = [...queueMap.values()].filter((q) => !q.matchedRoomCode).length;
  return {
    status: { queued: true, matchedRoomCode: null, queueCount: count },
    room: null,
  };
}

export function localLeaveMatchmaking(userId: string): void {
  queueMap.delete(userId);
}

export function localSyncRoomCombat(
  userId: string,
  rawCode: string,
  input: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    vx: number;
    vz: number;
    crouched: boolean;
    sprinting: boolean;
    aiming: boolean;
    reloading: boolean;
    weaponId: string;
    characterId: string;
    seq: number;
    shotEvent?: {
      shotSeq: number;
      origin: [number, number, number];
      end: [number, number, number];
      hitOpponent: boolean;
      damage: number;
      headshot: boolean;
    };
  }
): CombatSyncResponse {
  const code = normalizeRoomCode(rawCode);
  const rec = roomsMap.get(code);
  if (!rec) throw new Error('Match room not found.');

  const isHost = rec.hostUserId === userId;
  const isGuest = rec.guestUserId === userId;
  if (!isHost && !isGuest) throw new Error('Not a participant in this room.');

  const nowMs = Date.now();
  const myPlayerId = isHost ? rec.hostPlayerId : rec.guestPlayerId!;

  let myState = isHost ? rec.hostState : rec.guestState;
  if (!myState) {
    myState = createSpawnActorState(
      myPlayerId,
      input.characterId,
      input.weaponId,
      isHost ? 'host' : 'guest'
    );
  }
  let oppState = isHost ? rec.guestState : rec.hostState;

  if (!myState.alive && nowMs >= myState.respawnAtMs) {
    const fresh = createSpawnActorState(
      myPlayerId,
      input.characterId,
      input.weaponId,
      isHost ? 'host' : 'guest'
    );
    myState = { ...fresh, seq: myState.seq, shotSeq: myState.shotSeq };
  }
  if (oppState && !oppState.alive && nowMs >= oppState.respawnAtMs) {
    const freshOpp = createSpawnActorState(
      oppState.playerId,
      oppState.characterId,
      oppState.weaponId,
      isHost ? 'guest' : 'host'
    );
    oppState = { ...freshOpp, seq: oppState.seq, shotSeq: oppState.shotSeq };
  }

  if (myState.alive) {
    myState.x = clampCoord(input.x, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT, myState.x);
    myState.y = clampCoord(input.y, 0, 4, 0);
    myState.z = clampCoord(input.z, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT, myState.z);
    myState.yaw = clampCoord(input.yaw, -Math.PI * 4, Math.PI * 4, myState.yaw);
    myState.pitch = clampCoord(input.pitch, -1.4, 1.4, myState.pitch);
    myState.vx = clampCoord(input.vx, -20, 20, 0);
    myState.vz = clampCoord(input.vz, -20, 20, 0);
    myState.crouched = Boolean(input.crouched);
    myState.sprinting = Boolean(input.sprinting);
    myState.aiming = Boolean(input.aiming);
    myState.reloading = Boolean(input.reloading);
    myState.weaponId = String(input.weaponId || myState.weaponId);
    myState.characterId = String(input.characterId || myState.characterId);
    myState.maxHp = getCharacterMaxHp(myState.characterId);
  }
  myState.seq = Math.max(myState.seq, Number(input.seq) || 0);
  myState.updatedAtMs = nowMs;

  rec.combatEvents = rec.combatEvents.filter((ev) => nowMs - ev.ts < 3500).slice(-16);

  if (
    rec.status === 'playing' &&
    myState.alive &&
    input.shotEvent &&
    input.shotEvent.shotSeq > myState.shotSeq
  ) {
    myState.shotSeq = input.shotEvent.shotSeq;
    const origin: [number, number, number] = [
      clampCoord(input.shotEvent.origin[0], -30, 30, myState.x),
      clampCoord(input.shotEvent.origin[1], 0, 5, 1.4),
      clampCoord(input.shotEvent.origin[2], -30, 30, myState.z),
    ];
    const end: [number, number, number] = [
      clampCoord(input.shotEvent.end[0], -60, 60, myState.x),
      clampCoord(input.shotEvent.end[1], -5, 20, 1.4),
      clampCoord(input.shotEvent.end[2], -60, 60, myState.z),
    ];
    myState.shotOrigin = origin;
    myState.shotEnd = end;
    rec.combatEvents.push({
      id: crypto.randomUUID(),
      type: 'shot',
      fromPlayerId: myPlayerId,
      origin,
      end,
      ts: nowMs,
    });

    if (input.shotEvent.hitOpponent && oppState && oppState.alive) {
      const dmg = Math.max(1, Math.min(120, Math.round(Number(input.shotEvent.damage) || 0)));
      oppState.hp = Math.max(0, oppState.hp - dmg);
      rec.combatEvents.push({
        id: crypto.randomUUID(),
        type: 'hit',
        fromPlayerId: myPlayerId,
        toPlayerId: oppState.playerId,
        damage: dmg,
        headshot: Boolean(input.shotEvent.headshot),
        ts: nowMs,
      });

      if (oppState.hp <= 0) {
        oppState.alive = false;
        oppState.respawnAtMs = nowMs + 2200;
        if (isHost) {
          rec.hostKills += 1;
          rec.guestDeaths += 1;
        } else {
          rec.guestKills += 1;
          rec.hostDeaths += 1;
        }
        rec.combatEvents.push({
          id: crypto.randomUUID(),
          type: 'kill',
          fromPlayerId: myPlayerId,
          toPlayerId: oppState.playerId,
          headshot: Boolean(input.shotEvent.headshot),
          ts: nowMs,
        });

        if (rec.hostKills >= rec.maxKills || rec.guestKills >= rec.maxKills) {
          rec.status = 'finished';
          rec.winnerPlayerId = rec.hostKills >= rec.maxKills ? rec.hostPlayerId : rec.guestPlayerId;
          rec.endedAt = new Date(nowMs).toISOString();
        }
      }
    }
  }

  if (isHost) {
    rec.hostState = myState;
    rec.guestState = oppState;
  } else {
    rec.guestState = myState;
    rec.hostState = oppState;
  }
  rec.updatedAt = new Date(nowMs).toISOString();

  return {
    room: hydrateLocalRoom(rec),
    selfState: myState,
    opponentState: oppState,
    events: rec.combatEvents,
  };
}
