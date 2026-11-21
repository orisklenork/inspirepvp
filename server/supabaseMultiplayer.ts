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
import {
  type DbProfileRow,
  mapProfileRow,
  sbGetAccountBundle,
  sbGetRegisteredPlayers,
  sbRest,
} from './supabaseStore.ts';

interface DbPresenceRow {
  user_id: string;
  player_id: string;
  status: 'online' | 'in_room' | 'in_match';
  current_room_code: string | null;
  last_seen_at: string;
}

interface DbRoomRow {
  code: string;
  host_user_id: string;
  host_player_id: string;
  guest_user_id: string | null;
  guest_player_id: string | null;
  status: 'waiting' | 'playing' | 'finished';
  mode: '1v1_duel';
  max_kills: number;
  host_ready: boolean;
  guest_ready: boolean;
  host_kills: number;
  guest_kills: number;
  host_deaths: number;
  guest_deaths: number;
  host_state: LiveCombatActorState | Record<string, never>;
  guest_state: LiveCombatActorState | Record<string, never>;
  combat_events: CombatEvent[];
  winner_player_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbInviteRow {
  id: string;
  room_code: string;
  from_user_id: string;
  from_player_id: string;
  from_display_name: string;
  from_avatar_url: string | null;
  to_user_id: string;
  to_player_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  updated_at: string;
}

interface DbQueueRow {
  user_id: string;
  player_id: string;
  display_name: string;
  matched_room_code: string | null;
  queued_at: string;
  updated_at: string;
}

function isMissingMultiplayerTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache') ||
    msg.includes('pgrst205')
  );
}

function wrapMultiplayerError(err: unknown): Error {
  if (isMissingMultiplayerTableError(err)) {
    return new Error(
      'Multiplayer database tables are not created yet. Run the updated supabase/schema.sql in your Supabase SQL Editor.'
    );
  }
  return err instanceof Error ? err : new Error('Multiplayer request failed.');
}

async function hydrateRoom(row: DbRoomRow): Promise<GameRoom> {
  const userIds = [row.host_user_id, row.guest_user_id].filter((x): x is string => Boolean(x));
  const filter = userIds.map((id) => `"${id}"`).join(',');
  const profiles = await sbRest<DbProfileRow[]>(`profiles?user_id=in.(${filter})`);
  const profileMap = new Map(profiles.map((p) => [p.user_id, mapProfileRow(p)]));

  const hostP = profileMap.get(row.host_user_id);
  const guestP = row.guest_user_id ? profileMap.get(row.guest_user_id) : undefined;

  const host: RoomParticipant = {
    playerId: row.host_player_id,
    username: hostP?.username ?? 'Host',
    displayName: hostP?.displayName ?? 'Host',
    profilePictureUrl: hostP?.profilePictureUrl ?? null,
    selectedAvatarId: hostP?.selectedAvatarId ?? 'vanguard',
    profileThemeId: hostP?.profileThemeId ?? 'amber_vanguard',
    characterId: hostP?.selectedCharacterId ?? 'vanguard',
    weaponId: hostP?.favoriteWeaponId ?? 'pulse_rifle',
    level: hostP?.level ?? 1,
    ready: Boolean(row.host_ready),
    kills: Number(row.host_kills) || 0,
    deaths: Number(row.host_deaths) || 0,
  };

  const guest: RoomParticipant | null =
    row.guest_user_id && row.guest_player_id
      ? {
          playerId: row.guest_player_id,
          username: guestP?.username ?? 'Guest',
          displayName: guestP?.displayName ?? 'Guest',
          profilePictureUrl: guestP?.profilePictureUrl ?? null,
          selectedAvatarId: guestP?.selectedAvatarId ?? 'specter',
          profileThemeId: guestP?.profileThemeId ?? 'sky_interceptor',
          characterId: guestP?.selectedCharacterId ?? 'specter',
          weaponId: guestP?.favoriteWeaponId ?? 'pulse_rifle',
          level: guestP?.level ?? 1,
          ready: Boolean(row.guest_ready),
          kills: Number(row.guest_kills) || 0,
          deaths: Number(row.guest_deaths) || 0,
        }
      : null;

  return {
    code: row.code,
    status: row.status,
    mode: '1v1_duel',
    maxKills: Number(row.max_kills) || DEFAULT_MAX_KILLS,
    host,
    guest,
    winnerPlayerId: row.winner_player_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    updatedAt: row.updated_at,
  };
}

function mapInviteRow(row: DbInviteRow): RoomInvite {
  return {
    id: row.id,
    roomCode: row.room_code,
    fromPlayerId: row.from_player_id,
    fromDisplayName: row.from_display_name,
    fromAvatarUrl: row.from_avatar_url,
    toPlayerId: row.to_player_id,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function sbPresencePing(
  userId: string,
  status: 'online' | 'in_room' | 'in_match' = 'online',
  currentRoomCode: string | null = null
): Promise<{
  onlinePlayers: OnlinePlayerPresence[];
  incomingInvites: RoomInvite[];
  activeRoom: GameRoom | null;
  matchmaking: MatchmakingStatus;
}> {
  const account = await sbGetAccountBundle(userId);
  if (!account) {
    throw new Error('Player profile not found.');
  }

  const nowIso = new Date().toISOString();
  const activeCutoff = new Date(Date.now() - 45_000).toISOString();
  const inviteCutoff = new Date(Date.now() - 5 * 60_000).toISOString();

  try {
    await sbRest('player_presence', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: userId,
        player_id: account.profile.playerId,
        status,
        current_room_code: currentRoomCode,
        last_seen_at: nowIso,
      }),
    });

    const [presenceRows, roster, inviteRows, queueRows, activeRoomRows] = await Promise.all([
      sbRest<DbPresenceRow[]>(
        `player_presence?last_seen_at=gte.${encodeURIComponent(activeCutoff)}&order=last_seen_at.desc`
      ),
      sbGetRegisteredPlayers(50),
      sbRest<DbInviteRow[]>(
        `room_invites?to_user_id=eq.${encodeURIComponent(userId)}&status=eq.pending&created_at=gte.${encodeURIComponent(inviteCutoff)}&order=created_at.desc&limit=5`
      ),
      sbRest<DbQueueRow[]>(
        `matchmaking_queue?updated_at=gte.${encodeURIComponent(activeCutoff)}&order=queued_at.asc`
      ),
      sbRest<DbRoomRow[]>(
        `game_rooms?or=(host_user_id.eq.${encodeURIComponent(userId)},guest_user_id.eq.${encodeURIComponent(userId)})&status=in.(waiting,playing)&order=updated_at.desc&limit=1`
      ),
    ]);

    const playerById = new Map<string, PublicPlayerInfo>(
      roster.map((p) => [p.profile.playerId, p])
    );

    const onlinePlayers: OnlinePlayerPresence[] = presenceRows
      .map((row) => {
        const player = playerById.get(row.player_id);
        if (!player) return null;
        return {
          player,
          status: row.status,
          currentRoomCode: row.current_room_code,
          lastSeenAt: row.last_seen_at,
        } satisfies OnlinePlayerPresence;
      })
      .filter((x): x is OnlinePlayerPresence => x !== null);

    const selfQueue = queueRows.find((q) => q.user_id === userId);
    const matchedRoomCode = selfQueue?.matched_room_code ?? null;
    if (matchedRoomCode) {
      await sbRest(`matchmaking_queue?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }

    const activeRoom = activeRoomRows[0] ? await hydrateRoom(activeRoomRows[0]) : null;

    return {
      onlinePlayers,
      incomingInvites: inviteRows.map(mapInviteRow),
      activeRoom,
      matchmaking: {
        queued: Boolean(selfQueue && !matchedRoomCode),
        matchedRoomCode,
        queueCount: queueRows.filter((q) => !q.matched_room_code).length,
      },
    };
  } catch (err) {
    if (isMissingMultiplayerTableError(err)) {
      return {
        onlinePlayers: [],
        incomingInvites: [],
        activeRoom: null,
        matchmaking: { queued: false, matchedRoomCode: null, queueCount: 0 },
      };
    }
    throw wrapMultiplayerError(err);
  }
}

export async function sbGetOpenRooms(): Promise<GameRoom[]> {
  try {
    const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
    const rows = await sbRest<DbRoomRow[]>(
      `game_rooms?status=eq.waiting&guest_user_id=is.null&created_at=gte.${encodeURIComponent(cutoff)}&order=created_at.desc&limit=12`
    );
    return Promise.all(rows.map(hydrateRoom));
  } catch (err) {
    if (isMissingMultiplayerTableError(err)) return [];
    throw wrapMultiplayerError(err);
  }
}

export async function sbCreateRoom(userId: string): Promise<GameRoom> {
  const account = await sbGetAccountBundle(userId);
  if (!account) throw new Error('Player profile not found.');

  try {
    // Clean up any prior waiting rooms hosted by this user
    await sbRest(
      `game_rooms?host_user_id=eq.${encodeURIComponent(userId)}&status=eq.waiting`,
      { method: 'DELETE' }
    );

    let code = generateRoomCode();
    for (let i = 0; i < 6; i++) {
      const existing = await sbRest<{ code: string }[]>(
        `game_rooms?code=eq.${encodeURIComponent(code)}&select=code`
      );
      if (!existing.length) break;
      code = generateRoomCode();
    }

    const nowIso = new Date().toISOString();
    const inserted = await sbRest<DbRoomRow[]>('game_rooms', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        code,
        host_user_id: userId,
        host_player_id: account.profile.playerId,
        guest_user_id: null,
        guest_player_id: null,
        status: 'waiting',
        mode: '1v1_duel',
        max_kills: DEFAULT_MAX_KILLS,
        host_ready: true,
        guest_ready: false,
        host_kills: 0,
        guest_kills: 0,
        host_deaths: 0,
        guest_deaths: 0,
        host_state: {},
        guest_state: {},
        combat_events: [],
        created_at: nowIso,
        updated_at: nowIso,
      }),
    });

    return hydrateRoom(inserted[0]);
  } catch (err) {
    throw wrapMultiplayerError(err);
  }
}

export async function sbJoinRoom(userId: string, rawCode: string): Promise<GameRoom> {
  const code = normalizeRoomCode(rawCode);
  if (code.length < 4) throw new Error('Enter a valid room code.');
  const account = await sbGetAccountBundle(userId);
  if (!account) throw new Error('Player profile not found.');

  try {
    const rows = await sbRest<DbRoomRow[]>(`game_rooms?code=eq.${encodeURIComponent(code)}&limit=1`);
    const room = rows[0];
    if (!room) throw new Error('Room not found. Check the room code and try again.');

    if (room.host_user_id === userId || room.guest_user_id === userId) {
      return hydrateRoom(room);
    }
    if (room.status !== 'waiting') {
      throw new Error('This room has already started or finished.');
    }
    if (room.guest_user_id) {
      throw new Error('Room is already full (1v1).');
    }

    const updated = await sbRest<DbRoomRow[]>(
      `game_rooms?code=eq.${encodeURIComponent(code)}&guest_user_id=is.null`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          guest_user_id: userId,
          guest_player_id: account.profile.playerId,
          guest_ready: true,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (!updated[0]) {
      throw new Error('Another player just filled that room.');
    }
    return hydrateRoom(updated[0]);
  } catch (err) {
    throw wrapMultiplayerError(err);
  }
}

export async function sbGetRoom(userId: string, rawCode: string): Promise<GameRoom> {
  const code = normalizeRoomCode(rawCode);
  try {
    const rows = await sbRest<DbRoomRow[]>(`game_rooms?code=eq.${encodeURIComponent(code)}&limit=1`);
    const room = rows[0];
    if (!room) throw new Error('Room closed or not found.');
    if (
      room.status !== 'waiting' &&
      room.host_user_id !== userId &&
      room.guest_user_id !== userId
    ) {
      throw new Error('You are not a participant in this room.');
    }
    return hydrateRoom(room);
  } catch (err) {
    throw wrapMultiplayerError(err);
  }
}

export async function sbToggleRoomReady(
  userId: string,
  rawCode: string,
  ready: boolean
): Promise<GameRoom> {
  const code = normalizeRoomCode(rawCode);
  try {
    const rows = await sbRest<DbRoomRow[]>(`game_rooms?code=eq.${encodeURIComponent(code)}&limit=1`);
    const room = rows[0];
    if (!room) throw new Error('Room not found.');
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (room.host_user_id === userId) {
      patch.host_ready = Boolean(ready);
    } else if (room.guest_user_id === userId) {
      patch.guest_ready = Boolean(ready);
    } else {
      throw new Error('You are not in this room.');
    }

    const updated = await sbRest<DbRoomRow[]>(`game_rooms?code=eq.${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    return hydrateRoom(updated[0]);
  } catch (err) {
    throw wrapMultiplayerError(err);
  }
}

export async function sbStartRoomMatch(userId: string, rawCode: string): Promise<GameRoom> {
  const code = normalizeRoomCode(rawCode);
  try {
    const rows = await sbRest<DbRoomRow[]>(`game_rooms?code=eq.${encodeURIComponent(code)}&limit=1`);
    const room = rows[0];
    if (!room) throw new Error('Room not found.');
    if (room.host_user_id !== userId) {
      throw new Error('Only the room host can start the 1v1 battle.');
    }
    if (!room.guest_user_id || !room.guest_player_id) {
      throw new Error('Waiting for a second player to join the room.');
    }

    const [hostBundle, guestBundle] = await Promise.all([
      sbGetAccountBundle(room.host_user_id),
      sbGetAccountBundle(room.guest_user_id),
    ]);

    const hostState = createSpawnActorState(
      room.host_player_id,
      hostBundle?.profile.selectedCharacterId ?? 'vanguard',
      hostBundle?.profile.favoriteWeaponId ?? 'pulse_rifle',
      'host'
    );
    const guestState = createSpawnActorState(
      room.guest_player_id,
      guestBundle?.profile.selectedCharacterId ?? 'specter',
      guestBundle?.profile.favoriteWeaponId ?? 'pulse_rifle',
      'guest'
    );

    const nowIso = new Date().toISOString();
    const updated = await sbRest<DbRoomRow[]>(`game_rooms?code=eq.${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'playing',
        host_kills: 0,
        guest_kills: 0,
        host_deaths: 0,
        guest_deaths: 0,
        host_state: hostState,
        guest_state: guestState,
        combat_events: [],
        winner_player_id: null,
        started_at: nowIso,
        ended_at: null,
        updated_at: nowIso,
      }),
    });
    return hydrateRoom(updated[0]);
  } catch (err) {
    throw wrapMultiplayerError(err);
  }
}

export async function sbLeaveRoom(userId: string, rawCode: string): Promise<void> {
  const code = normalizeRoomCode(rawCode);
  try {
    const rows = await sbRest<DbRoomRow[]>(`game_rooms?code=eq.${encodeURIComponent(code)}&limit=1`);
    const room = rows[0];
    if (!room) return;

    if (room.status === 'waiting') {
      if (room.host_user_id === userId) {
        await sbRest(`game_rooms?code=eq.${encodeURIComponent(code)}`, { method: 'DELETE' });
      } else if (room.guest_user_id === userId) {
        await sbRest(`game_rooms?code=eq.${encodeURIComponent(code)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            guest_user_id: null,
            guest_player_id: null,
            guest_ready: false,
            updated_at: new Date().toISOString(),
          }),
        });
      }
      return;
    }

    if (room.status === 'playing' && (room.host_user_id === userId || room.guest_user_id === userId)) {
      const winner =
        room.host_user_id === userId ? room.guest_player_id : room.host_player_id;
      await sbRest(`game_rooms?code=eq.${encodeURIComponent(code)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'finished',
          winner_player_id: winner,
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    }
  } catch (err) {
    throw wrapMultiplayerError(err);
  }
}

export async function sbSendInvite(
  userId: string,
  targetPlayerId: string,
  rawRoomCode?: string
): Promise<{ invite: RoomInvite; room: GameRoom }> {
  const sender = await sbGetAccountBundle(userId);
  if (!sender) throw new Error('Player profile not found.');
  if (sender.profile.playerId === targetPlayerId) {
    throw new Error('You cannot invite yourself.');
  }

  try {
    const targets = await sbRest<DbProfileRow[]>(
      `profiles?player_id=eq.${encodeURIComponent(targetPlayerId)}&limit=1`
    );
    const target = targets[0];
    if (!target) throw new Error('Target player not found.');

    let room: GameRoom;
    const code = normalizeRoomCode(rawRoomCode);
    if (code) {
      const existing = await sbGetRoom(userId, code);
      if (existing.status !== 'waiting') {
        room = await sbCreateRoom(userId);
      } else {
        room = existing;
      }
    } else {
      room = await sbCreateRoom(userId);
    }

    // Expire previous pending invites from same sender to same recipient
    await sbRest(
      `room_invites?from_user_id=eq.${encodeURIComponent(userId)}&to_user_id=eq.${encodeURIComponent(target.user_id)}&status=eq.pending`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'expired', updated_at: new Date().toISOString() }),
      }
    );

    const inserted = await sbRest<DbInviteRow[]>('room_invites', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        room_code: room.code,
        from_user_id: userId,
        from_player_id: sender.profile.playerId,
        from_display_name: sender.profile.displayName,
        from_avatar_url: sender.profile.profilePictureUrl,
        to_user_id: target.user_id,
        to_player_id: target.player_id,
        status: 'pending',
      }),
    });

    return { invite: mapInviteRow(inserted[0]), room };
  } catch (err) {
    throw wrapMultiplayerError(err);
  }
}

export async function sbRespondInvite(
  userId: string,
  inviteId: string,
  accept: boolean
): Promise<{ status: 'accepted' | 'declined'; room?: GameRoom }> {
  try {
    const rows = await sbRest<DbInviteRow[]>(
      `room_invites?id=eq.${encodeURIComponent(inviteId)}&to_user_id=eq.${encodeURIComponent(userId)}&limit=1`
    );
    const invite = rows[0];
    if (!invite) throw new Error('Invite not found or already handled.');

    await sbRest(`room_invites?id=eq.${encodeURIComponent(inviteId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: accept ? 'accepted' : 'declined',
        updated_at: new Date().toISOString(),
      }),
    });

    if (!accept) {
      return { status: 'declined' };
    }

    const room = await sbJoinRoom(userId, invite.room_code);
    return { status: 'accepted', room };
  } catch (err) {
    throw wrapMultiplayerError(err);
  }
}

export async function sbJoinMatchmaking(
  userId: string
): Promise<{ status: MatchmakingStatus; room: GameRoom | null }> {
  const account = await sbGetAccountBundle(userId);
  if (!account) throw new Error('Player profile not found.');

  try {
    const nowIso = new Date().toISOString();
    const freshCutoff = new Date(Date.now() - 30_000).toISOString();

    const candidates = await sbRest<DbQueueRow[]>(
      `matchmaking_queue?user_id=neq.${encodeURIComponent(userId)}&matched_room_code=is.null&updated_at=gte.${encodeURIComponent(freshCutoff)}&order=queued_at.asc&limit=1`
    );

    if (candidates[0]) {
      const peer = candidates[0];
      const code = generateRoomCode();
      const peerBundle = await sbGetAccountBundle(peer.user_id);

      const hostState = createSpawnActorState(
        peer.player_id,
        peerBundle?.profile.selectedCharacterId ?? 'vanguard',
        peerBundle?.profile.favoriteWeaponId ?? 'pulse_rifle',
        'host'
      );
      const guestState = createSpawnActorState(
        account.profile.playerId,
        account.profile.selectedCharacterId,
        account.profile.favoriteWeaponId,
        'guest'
      );

      const inserted = await sbRest<DbRoomRow[]>('game_rooms', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          code,
          host_user_id: peer.user_id,
          host_player_id: peer.player_id,
          guest_user_id: userId,
          guest_player_id: account.profile.playerId,
          status: 'playing',
          mode: '1v1_duel',
          max_kills: DEFAULT_MAX_KILLS,
          host_ready: true,
          guest_ready: true,
          host_kills: 0,
          guest_kills: 0,
          host_deaths: 0,
          guest_deaths: 0,
          host_state: hostState,
          guest_state: guestState,
          combat_events: [],
          started_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
        }),
      });

      await Promise.all([
        sbRest(`matchmaking_queue?user_id=eq.${encodeURIComponent(peer.user_id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ matched_room_code: code, updated_at: nowIso }),
        }),
        sbRest(`matchmaking_queue?user_id=eq.${encodeURIComponent(userId)}`, {
          method: 'DELETE',
        }),
      ]);

      const room = await hydrateRoom(inserted[0]);
      return {
        status: { queued: false, matchedRoomCode: code, queueCount: 0 },
        room,
      };
    }

    await sbRest('matchmaking_queue', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: userId,
        player_id: account.profile.playerId,
        display_name: account.profile.displayName,
        matched_room_code: null,
        queued_at: nowIso,
        updated_at: nowIso,
      }),
    });

    const allQueued = await sbRest<DbQueueRow[]>(
      `matchmaking_queue?matched_room_code=is.null&updated_at=gte.${encodeURIComponent(freshCutoff)}`
    );

    return {
      status: { queued: true, matchedRoomCode: null, queueCount: allQueued.length },
      room: null,
    };
  } catch (err) {
    throw wrapMultiplayerError(err);
  }
}

export async function sbLeaveMatchmaking(userId: string): Promise<void> {
  try {
    await sbRest(`matchmaking_queue?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    if (!isMissingMultiplayerTableError(err)) {
      throw wrapMultiplayerError(err);
    }
  }
}

function buildFastRoomSnapshot(row: DbRoomRow): GameRoom {
  return {
    code: row.code,
    status: row.status,
    mode: '1v1_duel',
    maxKills: Number(row.max_kills) || DEFAULT_MAX_KILLS,
    host: {
      playerId: row.host_player_id,
      username: 'Host',
      displayName: 'Host',
      profilePictureUrl: null,
      selectedAvatarId: 'vanguard',
      profileThemeId: 'amber_vanguard',
      characterId: (row.host_state as LiveCombatActorState)?.characterId ?? 'vanguard',
      weaponId: (row.host_state as LiveCombatActorState)?.weaponId ?? 'pulse_rifle',
      level: 1,
      ready: Boolean(row.host_ready),
      kills: Number(row.host_kills) || 0,
      deaths: Number(row.host_deaths) || 0,
    },
    guest: row.guest_player_id
      ? {
          playerId: row.guest_player_id,
          username: 'Guest',
          displayName: 'Guest',
          profilePictureUrl: null,
          selectedAvatarId: 'specter',
          profileThemeId: 'sky_interceptor',
          characterId: (row.guest_state as LiveCombatActorState)?.characterId ?? 'specter',
          weaponId: (row.guest_state as LiveCombatActorState)?.weaponId ?? 'pulse_rifle',
          level: 1,
          ready: Boolean(row.guest_ready),
          kills: Number(row.guest_kills) || 0,
          deaths: Number(row.guest_deaths) || 0,
        }
      : null,
    winnerPlayerId: row.winner_player_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    updatedAt: row.updated_at,
  };
}

export async function sbSyncRoomCombat(
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
): Promise<CombatSyncResponse> {
  const code = normalizeRoomCode(rawCode);
  try {
    const rows = await sbRest<DbRoomRow[]>(`game_rooms?code=eq.${encodeURIComponent(code)}&limit=1`);
    const row = rows[0];
    if (!row) throw new Error('Match room not found.');

    const isHost = row.host_user_id === userId;
    const isGuest = row.guest_user_id === userId;
    if (!isHost && !isGuest) throw new Error('Not a participant in this room.');

    const nowMs = Date.now();
    const myPlayerId = isHost ? row.host_player_id : row.guest_player_id!;
    const oppPlayerId = isHost ? row.guest_player_id : row.host_player_id;

    let myState: LiveCombatActorState =
      (isHost ? row.host_state : row.guest_state) &&
      'playerId' in (isHost ? row.host_state : row.guest_state)
        ? { ...(isHost ? (row.host_state as LiveCombatActorState) : (row.guest_state as LiveCombatActorState)) }
        : createSpawnActorState(
            myPlayerId,
            input.characterId,
            input.weaponId,
            isHost ? 'host' : 'guest'
          );

    const rawOpp = isHost ? row.guest_state : row.host_state;
    let oppState: LiveCombatActorState | null =
      oppPlayerId && rawOpp && 'playerId' in rawOpp
        ? { ...(rawOpp as LiveCombatActorState) }
        : null;

    // Auto-respawn own actor when respawn timer expires
    if (!myState.alive && nowMs >= myState.respawnAtMs) {
      const fresh = createSpawnActorState(
        myPlayerId,
        input.characterId,
        input.weaponId,
        isHost ? 'host' : 'guest'
      );
      myState = { ...fresh, seq: myState.seq, shotSeq: myState.shotSeq };
    }

    // Update only local pose & velocity
    if (myState.alive) {
      myState.x = clampCoord(input.x, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT, myState.x);
      myState.y = clampCoord(input.y, 0, 5, 0);
      myState.z = clampCoord(input.z, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT, myState.z);
      myState.yaw = clampCoord(input.yaw, -Math.PI * 8, Math.PI * 8, myState.yaw);
      myState.pitch = clampCoord(input.pitch, -1.45, 1.45, myState.pitch);
      myState.vx = clampCoord(input.vx, -25, 25, 0);
      myState.vz = clampCoord(input.vz, -25, 25, 0);
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

    let hostKills = Number(row.host_kills) || 0;
    let guestKills = Number(row.guest_kills) || 0;
    let hostDeaths = Number(row.host_deaths) || 0;
    let guestDeaths = Number(row.guest_deaths) || 0;
    let status = row.status;
    let winnerPlayerId = row.winner_player_id;
    let endedAt = row.ended_at;

    const events: CombatEvent[] = Array.isArray(row.combat_events)
      ? row.combat_events.filter((ev) => nowMs - ev.ts < 3500).slice(-14)
      : [];

    let hasShotUpdate = false;
    let damagedOpponent = false;

    if (
      status === 'playing' &&
      myState.alive &&
      input.shotEvent &&
      input.shotEvent.shotSeq > myState.shotSeq
    ) {
      hasShotUpdate = true;
      myState.shotSeq = input.shotEvent.shotSeq;
      const origin: [number, number, number] = [
        clampCoord(input.shotEvent.origin[0], -32, 32, myState.x),
        clampCoord(input.shotEvent.origin[1], 0, 6, 1.4),
        clampCoord(input.shotEvent.origin[2], -32, 32, myState.z),
      ];
      const end: [number, number, number] = [
        clampCoord(input.shotEvent.end[0], -70, 70, myState.x),
        clampCoord(input.shotEvent.end[1], -5, 25, 1.4),
        clampCoord(input.shotEvent.end[2], -70, 70, myState.z),
      ];
      myState.shotOrigin = origin;
      myState.shotEnd = end;

      events.push({
        id: crypto.randomUUID(),
        type: 'shot',
        fromPlayerId: myPlayerId,
        origin,
        end,
        ts: nowMs,
      });

      if (input.shotEvent.hitOpponent && oppState && oppState.alive) {
        damagedOpponent = true;
        const dmg = Math.max(1, Math.min(180, Math.round(Number(input.shotEvent.damage) || 0)));
        oppState.hp = Math.max(0, oppState.hp - dmg);
        events.push({
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
            hostKills += 1;
            guestDeaths += 1;
          } else {
            guestKills += 1;
            hostDeaths += 1;
          }

          events.push({
            id: crypto.randomUUID(),
            type: 'kill',
            fromPlayerId: myPlayerId,
            toPlayerId: oppState.playerId,
            headshot: Boolean(input.shotEvent.headshot),
            ts: nowMs,
          });

          const maxKills = Number(row.max_kills) || DEFAULT_MAX_KILLS;
          if (hostKills >= maxKills || guestKills >= maxKills) {
            status = 'finished';
            winnerPlayerId = hostKills >= maxKills ? row.host_player_id : row.guest_player_id;
            endedAt = new Date(nowMs).toISOString();
          }
        }
      }
    }

    // Column-isolated PATCH: never overwrite the opponent's position column unless applying damage!
    const patch: Record<string, unknown> = {
      [isHost ? 'host_state' : 'guest_state']: myState,
      updated_at: new Date(nowMs).toISOString(),
    };

    if (hasShotUpdate) {
      patch.combat_events = events.slice(-18);
    }
    if (damagedOpponent && oppState) {
      patch[isHost ? 'guest_state' : 'host_state'] = oppState;
      patch.status = status;
      patch.host_kills = hostKills;
      patch.guest_kills = guestKills;
      patch.host_deaths = hostDeaths;
      patch.guest_deaths = guestDeaths;
      patch.winner_player_id = winnerPlayerId;
      patch.ended_at = endedAt;
    }

    const updatedRows = await sbRest<DbRoomRow[]>(
      `game_rooms?code=eq.${encodeURIComponent(code)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      }
    );

    const finalRow = updatedRows[0] ?? row;
    const latestOpp = isHost ? finalRow.guest_state : finalRow.host_state;
    const resolvedOpp =
      oppPlayerId && latestOpp && 'playerId' in latestOpp
        ? (latestOpp as LiveCombatActorState)
        : oppState;

    return {
      room: buildFastRoomSnapshot(finalRow),
      selfState: myState,
      opponentState: resolvedOpp,
      events: Array.isArray(finalRow.combat_events) ? finalRow.combat_events : events,
    };
  } catch (err) {
    throw wrapMultiplayerError(err);
  }
}
