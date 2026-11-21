import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Pause, Trophy, Play, LogOut } from 'lucide-react';
import { getCharacterById, getWeaponById } from '../lib/catalog.ts';
import { soundEngine } from '../lib/audio.ts';
import type {
  GameMode,
  MatchParticipantResult,
  PlayerAccountBundle,
  PublicPlayerInfo,
  WeaponOption,
} from '../types/game.ts';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface ArenaGameCanvasProps {
  account: PlayerAccountBundle;
  bots: PublicPlayerInfo[];
  mode: GameMode;
  onMatchFinished: (result: {
    mode: GameMode;
    outcome: 'victory' | 'defeat';
    kills: number;
    deaths: number;
    score: number;
    durationSec: number;
    participants: MatchParticipantResult[];
  }) => void;
  onExitToLobby: () => void;
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PickupNode {
  x: number;
  y: number;
  type: 'medkit' | 'ammo';
  active: boolean;
  respawnTimer: number;
}

interface Actor {
  id: string;
  playerId: string;
  username: string;
  displayName: string;
  profilePictureUrl: string | null;
  selectedAvatarId: string;
  profileThemeId: string;
  level: number;
  characterId: string;
  weaponId: string;
  secondaryWeaponId: string;
  activeSlot: 1 | 2;
  team: 'allies' | 'rivals';
  isUser: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  aimAngle: number;
  hp: number;
  maxHp: number;
  speed: number;
  dashCooldownMs: number;
  dashCooldownRemaining: number;
  dashActiveTime: number;
  dashDirX: number;
  dashDirY: number;
  ammo: number;
  reloadingUntil: number;
  lastShotAt: number;
  hitFlashTime: number;
  alive: boolean;
  respawnTime: number;
  kills: number;
  deaths: number;
  score: number;
  // AI fields
  aiWindup: number;
  aiTargetId: string | null;
  aiStrafeDir: number;
  aiStrafeTimer: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  ownerId: string;
  team: 'allies' | 'rivals';
  distanceTraveled: number;
  maxRange: number;
  color: string;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface HudSnapshot {
  hp: number;
  maxHp: number;
  ammo: number;
  magSize: number;
  reloading: boolean;
  dashReadyPct: number;
  weaponName: string;
  alliesScore: number;
  rivalsScore: number;
  timeRemainingSec: number;
  kills: number;
  deaths: number;
  score: number;
  killfeed: string[];
  scoreboard: MatchParticipantResult[];
  respawningSec: number;
}

const ARENA_W = 1440;
const ARENA_H = 900;
const MATCH_DURATION_SEC = 85;
const TARGET_SCORE = 12;

const OBSTACLES: Obstacle[] = [
  // Center reactor bunker
  { x: 660, y: 390, w: 120, h: 120 },
  // Left & Right wing walls
  { x: 260, y: 210, w: 90, h: 170 },
  { x: 260, y: 520, w: 90, h: 170 },
  { x: 1090, y: 210, w: 90, h: 170 },
  { x: 1090, y: 520, w: 90, h: 170 },
  // Mid cover crates
  { x: 480, y: 170, w: 130, h: 55 },
  { x: 830, y: 170, w: 130, h: 55 },
  { x: 480, y: 675, w: 130, h: 55 },
  { x: 830, y: 675, w: 130, h: 55 },
];

function circleRectResolve(
  cx: number,
  cy: number,
  r: number,
  rect: Obstacle
): { x: number; y: number } {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= r * r) {
    return { x: cx, y: cy };
  }
  const dist = Math.sqrt(distSq) || 0.001;
  const overlap = r - dist;
  return {
    x: cx + (dx / dist) * overlap,
    y: cy + (dy / dist) * overlap,
  };
}

function pointInObstacle(px: number, py: number): boolean {
  for (const o of OBSTACLES) {
    if (px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h) {
      return true;
    }
  }
  return false;
}

function hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
  const steps = 16;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInObstacle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) {
      return false;
    }
  }
  return true;
}

export function ArenaGameCanvas({
  account,
  bots,
  mode,
  onMatchFinished,
  onExitToLobby,
}: ArenaGameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(false);
  const finishedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [muted, setMuted] = useState(() => soundEngine.isMuted());

  const [hud, setHud] = useState<HudSnapshot>(() => {
    const char = getCharacterById(account.profile.selectedCharacterId);
    const wep = getWeaponById(account.profile.favoriteWeaponId);
    return {
      hp: char.maxHp,
      maxHp: char.maxHp,
      ammo: wep.magSize,
      magSize: wep.magSize,
      reloading: false,
      dashReadyPct: 100,
      weaponName: wep.name,
      alliesScore: 0,
      rivalsScore: 0,
      timeRemainingSec: MATCH_DURATION_SEC,
      kills: 0,
      deaths: 0,
      score: 0,
      killfeed: [],
      scoreboard: [],
      respawningSec: 0,
    };
  });

  // Mobile virtual stick state
  const touchMoveRef = useRef({ x: 0, y: 0 });
  const touchFiringRef = useRef(false);
  const touchDashQueuedRef = useRef(false);
  const touchReloadQueuedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    finishedRef.current = false;

    const heldKeys = new Set<string>();
    let dashBufferedAt = -1;
    let reloadQueued = false;
    let swapSlotQueued: 1 | 2 | null = null;
    let mouseDown = false;
    let mouseWorldX = ARENA_W / 2 + 120;
    let mouseWorldY = ARENA_H / 2;

    const userChar = getCharacterById(account.profile.selectedCharacterId);
    const userPrimary = getWeaponById(account.profile.favoriteWeaponId);
    const userSecondaryId =
      account.profile.favoriteWeaponId === 'tactical_sidearm'
        ? 'pulse_rifle'
        : 'tactical_sidearm';

    const createActorFromPublic = (
      p: PublicPlayerInfo,
      team: 'allies' | 'rivals',
      spawnX: number,
      spawnY: number,
      isUser: boolean
    ): Actor => {
      const ch = getCharacterById(p.profile.selectedCharacterId);
      const wep = getWeaponById(p.profile.favoriteWeaponId);
      return {
        id: p.profile.playerId,
        playerId: p.profile.playerId,
        username: p.profile.username,
        displayName: p.profile.displayName,
        profilePictureUrl: p.profile.profilePictureUrl,
        selectedAvatarId: p.profile.selectedAvatarId,
        profileThemeId: p.profile.profileThemeId,
        level: p.profile.level,
        characterId: ch.id,
        weaponId: wep.id,
        secondaryWeaponId: isUser ? userSecondaryId : 'tactical_sidearm',
        activeSlot: 1,
        team,
        isUser,
        x: spawnX,
        y: spawnY,
        vx: 0,
        vy: 0,
        radius: 18,
        aimAngle: team === 'allies' ? 0 : Math.PI,
        hp: ch.maxHp,
        maxHp: ch.maxHp,
        speed: isUser ? ch.moveSpeed : ch.moveSpeed * 0.84,
        dashCooldownMs: ch.dashCooldownMs,
        dashCooldownRemaining: 0,
        dashActiveTime: 0,
        dashDirX: 0,
        dashDirY: 0,
        ammo: wep.magSize,
        reloadingUntil: 0,
        lastShotAt: 0,
        hitFlashTime: 0,
        alive: true,
        respawnTime: 0,
        kills: 0,
        deaths: 0,
        score: 0,
        aiWindup: 0,
        aiTargetId: null,
        aiStrafeDir: Math.random() < 0.5 ? 1 : -1,
        aiStrafeTimer: 1.2,
      };
    };

    const userPublic: PublicPlayerInfo = {
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
    };

    const actors: Actor[] = [];
    actors.push(createActorFromPublic(userPublic, 'allies', 130, ARENA_H / 2, true));

    if (mode === 'skirmish_3v3') {
      const allySpawns = [
        [140, 210],
        [140, 690],
      ];
      bots.slice(0, 2).forEach((b, idx) => {
        actors.push(
          createActorFromPublic(b, 'allies', allySpawns[idx][0], allySpawns[idx][1], false)
        );
      });
      const rivalSpawns = [
        [ARENA_W - 140, 210],
        [ARENA_W - 130, ARENA_H / 2],
        [ARENA_W - 140, 690],
      ];
      bots.slice(2, 5).forEach((b, idx) => {
        actors.push(
          createActorFromPublic(b, 'rivals', rivalSpawns[idx][0], rivalSpawns[idx][1], false)
        );
      });
    } else {
      const rivalSpawns = [
        [ARENA_W - 150, 170],
        [ARENA_W - 150, 730],
        [ARENA_W / 2, 110],
        [ARENA_W / 2, ARENA_H - 110],
      ];
      bots.slice(0, 4).forEach((b, idx) => {
        actors.push(
          createActorFromPublic(b, 'rivals', rivalSpawns[idx][0], rivalSpawns[idx][1], false)
        );
      });
    }

    const pickups: PickupNode[] = [
      { x: ARENA_W / 2, y: 120, type: 'medkit', active: true, respawnTimer: 0 },
      { x: ARENA_W / 2, y: ARENA_H - 120, type: 'ammo', active: true, respawnTimer: 0 },
      { x: 400, y: ARENA_H / 2, type: 'medkit', active: true, respawnTimer: 0 },
      { x: ARENA_W - 400, y: ARENA_H / 2, type: 'ammo', active: true, respawnTimer: 0 },
    ];

    const bullets: Bullet[] = [];
    const particlePool: Particle[] = Array.from({ length: 180 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0.3,
      size: 3,
      color: '#F59E0B',
    }));

    const spawnParticles = (x: number, y: number, color: string, count: number, speed = 220) => {
      let spawned = 0;
      for (const p of particlePool) {
        if (!p.active) {
          const ang = Math.random() * Math.PI * 2;
          const spd = (0.35 + Math.random() * 0.75) * speed;
          p.active = true;
          p.x = x;
          p.y = y;
          p.vx = Math.cos(ang) * spd;
          p.vy = Math.sin(ang) * spd;
          p.maxLife = 0.18 + Math.random() * 0.24;
          p.life = p.maxLife;
          p.size = 2 + Math.random() * 3.5;
          p.color = color;
          spawned++;
          if (spawned >= count) break;
        }
      }
    };

    let alliesScore = 0;
    let rivalsScore = 0;
    let elapsedMatchSec = 0;
    let hitstopRemaining = 0;
    let shakeIntensity = 0;
    const killfeed: string[] = [];

    const activeWeaponFor = (actor: Actor): WeaponOption =>
      getWeaponById(actor.activeSlot === 1 ? actor.weaponId : actor.secondaryWeaponId);

    const respawnActor = (actor: Actor) => {
      actor.alive = true;
      actor.hp = actor.maxHp;
      const wep = activeWeaponFor(actor);
      actor.ammo = wep.magSize;
      actor.reloadingUntil = 0;
      actor.aiWindup = 0;
      if (actor.team === 'allies') {
        actor.x = 120 + Math.random() * 60;
        actor.y = 140 + Math.random() * (ARENA_H - 280);
      } else {
        actor.x = ARENA_W - 120 - Math.random() * 60;
        actor.y = 140 + Math.random() * (ARENA_H - 280);
      }
    };

    const fireWeapon = (actor: Actor, nowMs: number) => {
      const wep = activeWeaponFor(actor);
      if (actor.reloadingUntil > 0) return;
      if (nowMs - actor.lastShotAt < wep.fireRateMs) return;
      if (actor.ammo <= 0) {
        actor.reloadingUntil = nowMs + wep.reloadMs;
        if (actor.isUser) soundEngine.playReload();
        return;
      }

      actor.lastShotAt = nowMs;
      actor.ammo -= 1;
      if (actor.isUser) {
        soundEngine.playShoot(wep.id);
        shakeIntensity = Math.min(8, shakeIntensity + (wep.id === 'scatter_cannon' ? 4.5 : 1.8));
      }

      const muzzleX = actor.x + Math.cos(actor.aimAngle) * (actor.radius + 8);
      const muzzleY = actor.y + Math.sin(actor.aimAngle) * (actor.radius + 8);
      const bulletColor = actor.team === 'allies' ? '#F59E0B' : '#FB7185';

      for (let i = 0; i < wep.pellets; i++) {
        const spread = (Math.random() - 0.5) * 2 * wep.spreadRad;
        const ang = actor.aimAngle + spread;
        bullets.push({
          x: muzzleX,
          y: muzzleY,
          vx: Math.cos(ang) * wep.projectileSpeed,
          vy: Math.sin(ang) * wep.projectileSpeed,
          damage: wep.damage,
          ownerId: actor.id,
          team: actor.team,
          distanceTraveled: 0,
          maxRange: wep.rangePx,
          color: bulletColor,
        });
      }

      spawnParticles(muzzleX, muzzleY, '#FDE68A', 3, 120);

      if (actor.ammo <= 0) {
        actor.reloadingUntil = nowMs + wep.reloadMs;
        if (actor.isUser) soundEngine.playReload();
      }
    };

    // Coordinate conversion for mouse aim
    const updateMouseWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scale = Math.min(rect.width / ARENA_W, rect.height / ARENA_H);
      const offsetX = (rect.width - ARENA_W * scale) / 2;
      const offsetY = (rect.height - ARENA_H * scale) / 2;
      mouseWorldX = (clientX - rect.left - offsetX) / scale;
      mouseWorldY = (clientY - rect.top - offsetY) / scale;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'Tab') {
        e.preventDefault();
        setShowScoreboard(true);
        return;
      }
      if (code === 'Escape') {
        e.preventDefault();
        setPaused((p) => !p);
        return;
      }
      heldKeys.add(code);
      if (code === 'Space' || code === 'ShiftLeft') {
        e.preventDefault();
        dashBufferedAt = performance.now();
      }
      if (code === 'KeyR') {
        reloadQueued = true;
      }
      if (code === 'Digit1') {
        swapSlotQueued = 1;
      }
      if (code === 'Digit2') {
        swapSlotQueued = 2;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        setShowScoreboard(false);
        return;
      }
      heldKeys.delete(e.code);
    };

    const onBlur = () => {
      heldKeys.clear();
      mouseDown = false;
      setShowScoreboard(false);
    };

    const onMouseMove = (e: MouseEvent) => {
      updateMouseWorld(e.clientX, e.clientY);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseDown = true;
        updateMouseWorld(e.clientX, e.clientY);
      }
    };
    const onMouseUp = () => {
      mouseDown = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    let lastFrameTime = performance.now();
    let lastHudSync = 0;
    let rafId = 0;

    const finishMatch = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const userActor = actors[0];
      const victory =
        mode === 'skirmish_3v3'
          ? alliesScore >= rivalsScore
          : userActor.kills >= userActor.deaths || alliesScore >= rivalsScore;

      soundEngine.playMatchEnd(victory);

      const participants: MatchParticipantResult[] = [...actors]
        .sort((a, b) => b.score - a.score || b.kills - a.kills)
        .map((a) => ({
          playerId: a.playerId,
          username: a.username,
          displayName: a.displayName,
          profilePictureUrl: a.profilePictureUrl,
          selectedAvatarId: a.selectedAvatarId,
          profileThemeId: a.profileThemeId,
          level: a.level,
          characterId: a.characterId,
          weaponId: a.weaponId,
          team: a.team,
          kills: a.kills,
          deaths: a.deaths,
          score: a.score,
          isUser: a.isUser,
        }));

      onMatchFinished({
        mode,
        outcome: victory ? 'victory' : 'defeat',
        kills: userActor.kills,
        deaths: userActor.deaths,
        score: userActor.score,
        durationSec: Math.max(5, Math.round(elapsedMatchSec)),
        participants,
      });
    };

    const stepSimulation = (dt: number, nowMs: number) => {
      if (hitstopRemaining > 0) {
        hitstopRemaining -= dt;
        return;
      }

      elapsedMatchSec += dt;
      const timeRemaining = Math.max(0, MATCH_DURATION_SEC - elapsedMatchSec);
      if (timeRemaining <= 0 || alliesScore >= TARGET_SCORE || rivalsScore >= TARGET_SCORE) {
        finishMatch();
        return;
      }

      shakeIntensity = Math.max(0, shakeIntensity - dt * 22);

      // Update pickups
      for (const pk of pickups) {
        if (!pk.active) {
          pk.respawnTimer -= dt;
          if (pk.respawnTimer <= 0) pk.active = true;
        }
      }

      const user = actors[0];

      // Process player inputs
      if (user.alive) {
        if (swapSlotQueued) {
          if (user.activeSlot !== swapSlotQueued) {
            user.activeSlot = swapSlotQueued;
            user.reloadingUntil = 0;
            user.ammo = activeWeaponFor(user).magSize;
            soundEngine.playReload();
          }
          swapSlotQueued = null;
        }

        if (reloadQueued || touchReloadQueuedRef.current) {
          reloadQueued = false;
          touchReloadQueuedRef.current = false;
          const wep = activeWeaponFor(user);
          if (user.ammo < wep.magSize && user.reloadingUntil === 0) {
            user.reloadingUntil = nowMs + wep.reloadMs;
            soundEngine.playReload();
          }
        }

        let moveX = touchMoveRef.current.x;
        let moveY = touchMoveRef.current.y;
        if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) moveY -= 1;
        if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) moveY += 1;
        if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) moveX -= 1;
        if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) moveX += 1;

        const len = Math.hypot(moveX, moveY);
        if (len > 0) {
          moveX /= len;
          moveY /= len;
        }

        if (touchDashQueuedRef.current) {
          dashBufferedAt = nowMs;
          touchDashQueuedRef.current = false;
        }

        // Input-buffered dash (150ms buffer window)
        if (
          dashBufferedAt > 0 &&
          nowMs - dashBufferedAt <= 150 &&
          user.dashCooldownRemaining <= 0
        ) {
          dashBufferedAt = -1;
          user.dashActiveTime = 0.14;
          user.dashCooldownRemaining = user.dashCooldownMs / 1000;
          user.dashDirX = len > 0 ? moveX : Math.cos(user.aimAngle);
          user.dashDirY = len > 0 ? moveY : Math.sin(user.aimAngle);
          soundEngine.playDash();
          spawnParticles(user.x, user.y, '#F59E0B', 10, 180);
        }

        if (user.dashActiveTime > 0) {
          user.vx = user.dashDirX * 760;
          user.vy = user.dashDirY * 760;
        } else {
          user.vx = moveX * user.speed;
          user.vy = moveY * user.speed;
        }

        // Aim towards mouse or nearest rival if using touch fire
        if (touchFiringRef.current) {
          let nearestEnemy: Actor | null = null;
          let bestDist = Infinity;
          for (const other of actors) {
            if (other.alive && other.team !== user.team) {
              const d = Math.hypot(other.x - user.x, other.y - user.y);
              if (d < bestDist) {
                bestDist = d;
                nearestEnemy = other;
              }
            }
          }
          if (nearestEnemy) {
            user.aimAngle = Math.atan2(nearestEnemy.y - user.y, nearestEnemy.x - user.x);
          }
        } else {
          user.aimAngle = Math.atan2(mouseWorldY - user.y, mouseWorldX - user.x);
        }

        if (mouseDown || touchFiringRef.current) {
          fireWeapon(user, nowMs);
        }
      }

      // Update all actors (movement, reload, cooldowns, AI)
      for (const actor of actors) {
        actor.hitFlashTime = Math.max(0, actor.hitFlashTime - dt);
        actor.dashCooldownRemaining = Math.max(0, actor.dashCooldownRemaining - dt);
        actor.dashActiveTime = Math.max(0, actor.dashActiveTime - dt);

        if (!actor.alive) {
          actor.respawnTime -= dt;
          if (actor.respawnTime <= 0) {
            respawnActor(actor);
          }
          continue;
        }

        if (actor.reloadingUntil > 0 && nowMs >= actor.reloadingUntil) {
          actor.reloadingUntil = 0;
          actor.ammo = activeWeaponFor(actor).magSize;
        }

        if (!actor.isUser) {
          // Bot AI
          let target: Actor | null = null;
          let minDist = Infinity;
          for (const other of actors) {
            if (other.alive && other.team !== actor.team) {
              const d = Math.hypot(other.x - actor.x, other.y - actor.y);
              if (d < minDist) {
                minDist = d;
                target = other;
              }
            }
          }

          actor.aiStrafeTimer -= dt;
          if (actor.aiStrafeTimer <= 0) {
            actor.aiStrafeTimer = 0.8 + Math.random() * 1.4;
            actor.aiStrafeDir = Math.random() < 0.5 ? 1 : -1;
          }

          if (target) {
            const dx = target.x - actor.x;
            const dy = target.y - actor.y;
            const dist = Math.hypot(dx, dy) || 1;
            const targetAngle = Math.atan2(dy, dx);
            actor.aimAngle = targetAngle;

            const los = hasLineOfSight(actor.x, actor.y, target.x, target.y);
            const desiredDist = 260;
            const radialPush = dist > desiredDist + 45 ? 1 : dist < desiredDist - 55 ? -0.7 : 0;
            const perpX = -Math.sin(targetAngle) * actor.aiStrafeDir;
            const perpY = Math.cos(targetAngle) * actor.aiStrafeDir;
            const moveDirX = (dx / dist) * radialPush + perpX * 0.85;
            const moveDirY = (dy / dist) * radialPush + perpY * 0.85;
            const mLen = Math.hypot(moveDirX, moveDirY) || 1;

            actor.vx = (moveDirX / mLen) * actor.speed;
            actor.vy = (moveDirY / mLen) * actor.speed;

            if (los && dist < 560) {
              actor.aiWindup += dt;
              if (actor.aiWindup >= 0.42) {
                fireWeapon(actor, nowMs);
                if (actor.ammo <= 0) {
                  actor.aiWindup = 0;
                }
              }
            } else {
              actor.aiWindup = Math.max(0, actor.aiWindup - dt * 1.5);
            }
          } else {
            actor.vx = 0;
            actor.vy = 0;
          }
        }

        // Integrate position + obstacle & boundary collisions
        actor.x += actor.vx * dt;
        actor.y += actor.vy * dt;
        actor.x = Math.max(actor.radius + 16, Math.min(ARENA_W - actor.radius - 16, actor.x));
        actor.y = Math.max(actor.radius + 16, Math.min(ARENA_H - actor.radius - 16, actor.y));

        for (const rect of OBSTACLES) {
          const resolved = circleRectResolve(actor.x, actor.y, actor.radius, rect);
          actor.x = resolved.x;
          actor.y = resolved.y;
        }

        // Pickup checks
        for (const pk of pickups) {
          if (!pk.active) continue;
          if (Math.hypot(actor.x - pk.x, actor.y - pk.y) < actor.radius + 18) {
            if (pk.type === 'medkit' && actor.hp < actor.maxHp) {
              actor.hp = Math.min(actor.maxHp, actor.hp + 45);
              pk.active = false;
              pk.respawnTimer = 11;
              spawnParticles(pk.x, pk.y, '#10B981', 12, 160);
              if (actor.isUser) soundEngine.playHit();
            } else if (pk.type === 'ammo') {
              const wep = activeWeaponFor(actor);
              actor.ammo = wep.magSize;
              actor.reloadingUntil = 0;
              pk.active = false;
              pk.respawnTimer = 10;
              spawnParticles(pk.x, pk.y, '#F59E0B', 10, 150);
              if (actor.isUser) soundEngine.playReload();
            }
          }
        }
      }

      // Integrate bullets & check hits
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        const stepX = b.vx * dt;
        const stepY = b.vy * dt;
        b.x += stepX;
        b.y += stepY;
        b.distanceTraveled += Math.hypot(stepX, stepY);

        if (
          b.x < 12 ||
          b.x > ARENA_W - 12 ||
          b.y < 12 ||
          b.y > ARENA_H - 12 ||
          b.distanceTraveled >= b.maxRange ||
          pointInObstacle(b.x, b.y)
        ) {
          spawnParticles(b.x, b.y, b.color, 4, 140);
          bullets.splice(i, 1);
          continue;
        }

        let hit = false;
        for (const target of actors) {
          if (!target.alive || target.team === b.team) continue;
          if (Math.hypot(b.x - target.x, b.y - target.y) <= target.radius + 4) {
            target.hp -= b.damage;
            target.hitFlashTime = 0.1;
            spawnParticles(b.x, b.y, '#FCA5A5', 6, 170);

            const attacker = actors.find((a) => a.id === b.ownerId);
            if (attacker?.isUser) {
              soundEngine.playHit();
            }
            if (target.isUser) {
              shakeIntensity = Math.min(10, shakeIntensity + 4);
            }

            if (target.hp <= 0) {
              target.hp = 0;
              target.alive = false;
              target.respawnTime = 2.6;
              target.deaths += 1;

              if (attacker) {
                attacker.kills += 1;
                attacker.score += 100;
              }
              if (b.team === 'allies') {
                alliesScore += 1;
              } else {
                rivalsScore += 1;
              }

              killfeed.unshift(
                `${attacker?.displayName ?? 'Operative'} eliminated ${target.displayName}`
              );
              if (killfeed.length > 3) killfeed.pop();

              spawnParticles(target.x, target.y, '#F59E0B', 22, 260);

              if (attacker?.isUser || target.isUser) {
                hitstopRemaining = 0.045;
                shakeIntensity = 9;
                if (attacker?.isUser) {
                  soundEngine.playElimination();
                }
              }
            }

            bullets.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (hit) continue;
      }

      // Update particles
      for (const p of particlePool) {
        if (!p.active) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.life -= dt;
        if (p.life <= 0) p.active = false;
      }
    };

    const renderArena = (nowMs: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.max(1, Math.floor(rect.width * dpr));
      const targetH = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#080C12';
      ctx.fillRect(0, 0, rect.width, rect.height);

      const scale = Math.min(rect.width / ARENA_W, rect.height / ARENA_H);
      const offsetX = (rect.width - ARENA_W * scale) / 2;
      const offsetY = (rect.height - ARENA_H * scale) / 2;

      const shakeX = (Math.random() - 0.5) * shakeIntensity;
      const shakeY = (Math.random() - 0.5) * shakeIntensity;

      ctx.translate(offsetX + shakeX, offsetY + shakeY);
      ctx.scale(scale, scale);

      // Arena floor
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      // Tactical grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= ARENA_W; gx += 60) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, ARENA_H);
        ctx.stroke();
      }
      for (let gy = 0; gy <= ARENA_H; gy += 60) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(ARENA_W, gy);
        ctx.stroke();
      }

      // Center sector ring
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ARENA_W / 2, ARENA_H / 2, 160, 0, Math.PI * 2);
      ctx.stroke();

      // Arena boundary border
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, ARENA_W - 20, ARENA_H - 20);

      // Supply pickups
      for (const pk of pickups) {
        if (!pk.active) continue;
        ctx.save();
        ctx.translate(pk.x, pk.y);
        ctx.fillStyle = pk.type === 'medkit' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.18)';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pk.type === 'medkit' ? '#10B981' : '#F59E0B';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = pk.type === 'medkit' ? '#34D399' : '#FBBF24';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pk.type === 'medkit' ? '+' : 'AM', 0, 1);
        ctx.restore();
      }

      // Obstacles / Cover bunkers
      for (const o of OBSTACLES) {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        ctx.fillRect(o.x + 6, o.y + 6, o.w - 12, 6);
      }

      // AI Windup laser telegraphs
      for (const actor of actors) {
        if (!actor.alive || actor.isUser || actor.aiWindup <= 0.12) continue;
        ctx.save();
        ctx.strokeStyle =
          actor.team === 'rivals'
            ? `rgba(244, 63, 94, ${Math.min(0.65, actor.aiWindup)})`
            : `rgba(16, 185, 129, 0.35)`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(actor.x, actor.y);
        ctx.lineTo(
          actor.x + Math.cos(actor.aimAngle) * 340,
          actor.y + Math.sin(actor.aimAngle) * 340
        );
        ctx.stroke();
        ctx.restore();
      }

      // Bullets
      for (const b of bullets) {
        ctx.save();
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Particles
      for (const p of particlePool) {
        if (!p.active) continue;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Combatants
      for (const actor of actors) {
        if (!actor.alive) continue;
        ctx.save();
        ctx.translate(actor.x, actor.y);

        // Team / User ring
        ctx.strokeStyle = actor.isUser
          ? '#F59E0B'
          : actor.team === 'allies'
            ? '#10B981'
            : '#F43F5E';
        ctx.lineWidth = actor.isUser ? 3 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, actor.radius + 4, 0, Math.PI * 2);
        ctx.stroke();

        // Body
        ctx.fillStyle =
          actor.hitFlashTime > 0
            ? '#FFFFFF'
            : actor.isUser
              ? '#D97706'
              : actor.team === 'allies'
                ? '#059669'
                : '#E11D48';
        ctx.beginPath();
        ctx.arc(0, 0, actor.radius, 0, Math.PI * 2);
        ctx.fill();

        // Weapon barrel
        ctx.rotate(actor.aimAngle);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(8, -3.5, 18, 7);
        ctx.restore();

        // Overhead nameplate + health bar
        const barW = 42;
        const hpRatio = Math.max(0, actor.hp / actor.maxHp);
        ctx.fillStyle = 'rgba(11, 15, 23, 0.85)';
        ctx.fillRect(actor.x - barW / 2, actor.y - actor.radius - 16, barW, 5);
        ctx.fillStyle = actor.team === 'allies' ? '#10B981' : '#F43F5E';
        ctx.fillRect(actor.x - barW / 2, actor.y - actor.radius - 16, barW * hpRatio, 5);

        ctx.fillStyle = '#E2E8F0';
        ctx.font = '600 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(actor.displayName, actor.x, actor.y - actor.radius - 21);
      }

      // Subtle tactical reticle for user
      if (actors[0].alive) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mouseWorldX, mouseWorldY, 9, 0, Math.PI * 2);
        ctx.moveTo(mouseWorldX - 14, mouseWorldY);
        ctx.lineTo(mouseWorldX - 5, mouseWorldY);
        ctx.moveTo(mouseWorldX + 5, mouseWorldY);
        ctx.lineTo(mouseWorldX + 14, mouseWorldY);
        ctx.moveTo(mouseWorldX, mouseWorldY - 14);
        ctx.lineTo(mouseWorldX, mouseWorldY - 5);
        ctx.moveTo(mouseWorldX, mouseWorldY + 5);
        ctx.lineTo(mouseWorldX, mouseWorldY + 14);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();

      // Throttled HUD sync (~15Hz) so React never slows the 60fps loop
      if (nowMs - lastHudSync > 65) {
        lastHudSync = nowMs;
        const user = actors[0];
        const wep = activeWeaponFor(user);
        setHud({
          hp: Math.max(0, Math.round(user.hp)),
          maxHp: user.maxHp,
          ammo: user.ammo,
          magSize: wep.magSize,
          reloading: user.reloadingUntil > 0,
          dashReadyPct: Math.round(
            Math.max(0, 1 - user.dashCooldownRemaining / (user.dashCooldownMs / 1000)) * 100
          ),
          weaponName: wep.name,
          alliesScore,
          rivalsScore,
          timeRemainingSec: Math.ceil(Math.max(0, MATCH_DURATION_SEC - elapsedMatchSec)),
          kills: user.kills,
          deaths: user.deaths,
          score: user.score,
          killfeed: [...killfeed],
          respawningSec: user.alive ? 0 : Math.ceil(user.respawnTime),
          scoreboard: [...actors]
            .sort((a, b) => b.score - a.score || b.kills - a.kills)
            .map((a) => ({
              playerId: a.playerId,
              username: a.username,
              displayName: a.displayName,
              profilePictureUrl: a.profilePictureUrl,
              selectedAvatarId: a.selectedAvatarId,
              profileThemeId: a.profileThemeId,
              level: a.level,
              characterId: a.characterId,
              weaponId: a.weaponId,
              team: a.team,
              kills: a.kills,
              deaths: a.deaths,
              score: a.score,
              isUser: a.isUser,
            })),
        });
      }
    };

    const loop = (now: number) => {
      const rawDt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      const dt = Math.min(rawDt, 0.05);

      if (!pausedRef.current && !finishedRef.current) {
        stepSimulation(dt, now);
      }
      renderArena(now);

      if (!finishedRef.current) {
        rafId = window.requestAnimationFrame(loop);
      }
    };

    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [account, bots, mode, onMatchFinished]);

  function handleToggleMute(): void {
    setMuted(soundEngine.toggleMute());
  }

  const mm = String(Math.floor(hud.timeRemainingSec / 60)).padStart(2, '0');
  const ss = String(hud.timeRemainingSec % 60).padStart(2, '0');

  return (
    <div className="relative w-screen h-screen bg-[#080C12] overflow-hidden select-none">
      {/* Isolated 60fps Canvas */}
      <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />

      {/* Low-occlusion HUD Overlay (pointer-events: none wrapper, no backdrop-filter) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-5">
        {/* Top Perimeter Bar */}
        <div className="flex items-start justify-between gap-4">
          {/* Player Vital Cluster */}
          <div className="flex items-center gap-3 rounded-xl bg-[#0B0F17]/90 border border-white/10 px-3.5 py-2.5">
            <PlayerAvatar
              profilePictureUrl={account.profile.profilePictureUrl}
              selectedAvatarId={account.profile.selectedAvatarId}
              profileThemeId={account.profile.profileThemeId}
              displayName={account.profile.displayName}
              size="sm"
            />
            <div className="min-w-[130px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-100 truncate max-w-[90px]">
                  {account.profile.displayName}
                </span>
                <span className="font-mono text-emerald-400 tabular-nums">
                  HP {hud.hp}/{hud.maxHp}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 mt-1 overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${Math.round((hud.hp / hud.maxHp) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono">
                <span>Dash {hud.dashReadyPct}%</span>
                <span>K {hud.kills} · D {hud.deaths}</span>
              </div>
            </div>
          </div>

          {/* Match Score & Timer */}
          <div className="rounded-xl bg-[#0B0F17]/90 border border-white/10 px-5 py-2 text-center">
            <div className="flex items-center gap-4 text-lg font-bold font-display tabular-nums">
              <span className="text-emerald-400">ALLIES {hud.alliesScore}</span>
              <span className="text-slate-400 font-mono text-sm">
                {mm}:{ss}
              </span>
              <span className="text-rose-400">{hud.rivalsScore} RIVALS</span>
            </div>
            <p className="text-[11px] text-slate-400">First to {TARGET_SCORE} Eliminations</p>
          </div>

          {/* Top-right Controls */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowScoreboard((s) => !s)}
              className="p-2.5 rounded-xl bg-[#0B0F17]/90 border border-white/10 text-slate-200 hover:text-amber-400 cursor-pointer"
              title="Toggle Scoreboard (Tab)"
              aria-label="Toggle Scoreboard"
            >
              <Trophy className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToggleMute}
              className="p-2.5 rounded-xl bg-[#0B0F17]/90 border border-white/10 text-slate-200 hover:text-amber-400 cursor-pointer"
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="p-2.5 rounded-xl bg-[#0B0F17]/90 border border-white/10 text-slate-200 hover:text-amber-400 cursor-pointer"
              title="Pause (Esc)"
              aria-label="Pause Match"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Respawn Indicator */}
        {hud.respawningSec > 0 && (
          <div className="self-center rounded-xl bg-[#0B0F17]/95 border border-rose-500/40 px-5 py-2.5 text-center">
            <p className="text-sm font-bold text-rose-400">Operative Down</p>
            <p className="text-xs text-slate-300 tabular-nums">
              Redeploying in {hud.respawningSec}s
            </p>
          </div>
        )}

        {/* Bottom HUD */}
        <div className="flex items-end justify-between gap-4">
          {/* Active Weapon & Ammo */}
          <div className="rounded-xl bg-[#0B0F17]/90 border border-white/10 px-4 py-2.5">
            <p className="text-xs text-amber-400 font-semibold">{hud.weaponName}</p>
            <div className="flex items-baseline gap-2 mt-0.5 font-mono tabular-nums">
              <span className="text-xl font-bold text-slate-100">
                {hud.reloading ? 'RELOADING' : `${hud.ammo} / ${hud.magSize}`}
              </span>
              <span className="text-[11px] text-slate-400">1 Primary · 2 Sidearm · R Reload</span>
            </div>
          </div>

          {/* Mobile Touch Controls (shown on touch/small screens) */}
          <div className="pointer-events-auto flex md:hidden items-center gap-2">
            <button
              type="button"
              onPointerDown={() => {
                touchMoveRef.current = { x: -1, y: 0 };
              }}
              onPointerUp={() => {
                touchMoveRef.current = { x: 0, y: 0 };
              }}
              className="w-11 h-11 rounded-xl bg-[#0B0F17]/90 border border-white/15 text-xs font-bold text-slate-200"
            >
              L
            </button>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onPointerDown={() => {
                  touchMoveRef.current = { x: 0, y: -1 };
                }}
                onPointerUp={() => {
                  touchMoveRef.current = { x: 0, y: 0 };
                }}
                className="w-11 h-9 rounded-lg bg-[#0B0F17]/90 border border-white/15 text-xs font-bold text-slate-200"
              >
                U
              </button>
              <button
                type="button"
                onPointerDown={() => {
                  touchMoveRef.current = { x: 0, y: 1 };
                }}
                onPointerUp={() => {
                  touchMoveRef.current = { x: 0, y: 0 };
                }}
                className="w-11 h-9 rounded-lg bg-[#0B0F17]/90 border border-white/15 text-xs font-bold text-slate-200"
              >
                D
              </button>
            </div>
            <button
              type="button"
              onPointerDown={() => {
                touchMoveRef.current = { x: 1, y: 0 };
              }}
              onPointerUp={() => {
                touchMoveRef.current = { x: 0, y: 0 };
              }}
              className="w-11 h-11 rounded-xl bg-[#0B0F17]/90 border border-white/15 text-xs font-bold text-slate-200"
            >
              R
            </button>
            <button
              type="button"
              onPointerDown={() => {
                touchDashQueuedRef.current = true;
              }}
              className="px-3 h-11 rounded-xl bg-[#1C2536] border border-white/15 text-xs font-semibold text-slate-100"
            >
              Dash
            </button>
            <button
              type="button"
              onPointerDown={() => {
                touchReloadQueuedRef.current = true;
              }}
              className="px-3 h-11 rounded-xl bg-[#1C2536] border border-white/15 text-xs font-semibold text-slate-100"
            >
              Reload
            </button>
            <button
              type="button"
              onPointerDown={() => {
                touchFiringRef.current = true;
              }}
              onPointerUp={() => {
                touchFiringRef.current = false;
              }}
              onPointerLeave={() => {
                touchFiringRef.current = false;
              }}
              className="px-4 h-11 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"
            >
              Fire
            </button>
          </div>

          {/* Killfeed */}
          <div className="hidden sm:flex flex-col items-end gap-1 text-xs">
            {hud.killfeed.map((line, i) => (
              <div
                key={`${line}-${i}`}
                className="rounded-lg bg-[#0B0F17]/90 border border-white/10 px-3 py-1 text-slate-200"
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Match Scoreboard Overlay (Tab) */}
      {showScoreboard && !paused && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#151C28] border border-white/15 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-slate-100">Live Match Scoreboard</h2>
              <button
                type="button"
                onClick={() => setShowScoreboard(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close (Release Tab)
              </button>
            </div>
            <div className="space-y-2">
              {hud.scoreboard.map((row) => (
                <div
                  key={row.playerId}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 border ${
                    row.isUser
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-[#0B0F17] border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerAvatar
                      profilePictureUrl={row.profilePictureUrl}
                      selectedAvatarId={row.selectedAvatarId}
                      profileThemeId={row.profileThemeId}
                      displayName={row.displayName}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {row.displayName}{' '}
                        <span
                          className={`text-xs font-normal ${
                            row.team === 'allies' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          · {row.team === 'allies' ? 'Allies' : 'Rivals'}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400 font-mono truncate">@{row.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-xs font-mono tabular-nums shrink-0">
                    <span className="text-slate-200">K {row.kills}</span>
                    <span className="text-slate-400">D {row.deaths}</span>
                    <span className="text-amber-400 font-bold">{row.score} PTS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {paused && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#151C28] border border-white/10 p-6 text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-100">Match Paused</h2>
            <p className="text-sm text-slate-400 mt-1">
              WASD Move · Mouse Aim &amp; Fire · Space Dash · R Reload
            </p>
            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={() => setPaused(false)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm py-3 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Match</span>
              </button>
              <button
                type="button"
                onClick={onExitToLobby}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B0F17] hover:bg-white/5 border border-white/10 text-slate-200 font-semibold text-sm py-3 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Leave to Lobby</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
