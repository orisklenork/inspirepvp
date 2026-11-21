import crypto from 'node:crypto';
import type { LiveCombatActorState } from '../src/types/game.ts';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ARENA_HALF_EXTENT = 25.5;
export const DEFAULT_MAX_KILLS = 5;

export const CHARACTER_BASE_HP: Record<string, number> = {
  vanguard: 110,
  specter: 95,
  bastion: 140,
  medic: 120,
};

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_ALPHABET[crypto.randomInt(0, ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function getCharacterMaxHp(characterId: string): number {
  return CHARACTER_BASE_HP[characterId] ?? 110;
}

export function createSpawnActorState(
  playerId: string,
  characterId: string,
  weaponId: string,
  side: 'host' | 'guest'
): LiveCombatActorState {
  const maxHp = getCharacterMaxHp(characterId);
  return {
    playerId,
    x: side === 'host' ? -2.5 : 2.5,
    y: 0,
    z: side === 'host' ? 20 : -20,
    yaw: side === 'host' ? 0 : Math.PI,
    pitch: 0,
    vx: 0,
    vz: 0,
    crouched: false,
    sprinting: false,
    aiming: false,
    reloading: false,
    hp: maxHp,
    maxHp,
    weaponId,
    characterId,
    alive: true,
    respawnAtMs: 0,
    seq: 0,
    shotSeq: 0,
    updatedAtMs: Date.now(),
  };
}

export function clampCoord(value: unknown, min: number, max: number, fallback = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}
