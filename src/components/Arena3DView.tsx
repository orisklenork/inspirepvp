import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Crosshair,
  LogOut,
  RotateCw,
  Shield,
  Volume2,
  VolumeX,
  Gamepad2,
  Trophy,
} from 'lucide-react';
import { getCharacterById, getWeaponById } from '../lib/catalog.ts';
import { leaveBattleRoom, syncRoomCombat } from '../lib/api.ts';
import {
  buildArenaEnvironment,
  raycastObstacles,
  resolvePlayerObstacleCollision,
  type RangeTargetEntity,
} from '../three/arenaEnvironment.ts';
import {
  createOperativeRig,
  swapRigWeapon,
  updateOperativePose,
  type OperativeRig,
} from '../three/proceduralModels.ts';
import { soundEngine } from '../three/soundEngine.ts';
import type {
  CombatEvent,
  GameMode,
  GameRoom,
  MatchParticipantResult,
  PlayerAccountBundle,
} from '../types/game.ts';

interface Arena3DViewProps {
  account: PlayerAccountBundle;
  mode: GameMode;
  room: GameRoom | null;
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

interface TracerBeam {
  mesh: THREE.Mesh;
  expiresAt: number;
}

interface HitFeedback {
  id: number;
  damage: number;
  headshot: boolean;
  ts: number;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    let rendererStr = '';
    if (dbg) {
      rendererStr = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '').toLowerCase();
    }
    const lose = gl.getExtension('WEBGL_lose_context');
    lose?.loseContext();
    return (
      rendererStr.includes('swiftshader') ||
      rendererStr.includes('llvmpipe') ||
      rendererStr.includes('software') ||
      rendererStr.includes('warp')
    );
  } catch {
    return false;
  }
}

export function Arena3DView({
  account,
  mode,
  room: initialRoom,
  onMatchFinished,
  onExitToLobby,
}: Arena3DViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { profile } = account;
  const isTraining = mode === 'training_range' || !initialRoom;

  const isHost = initialRoom ? initialRoom.host.playerId === profile.playerId : true;
  const opponentParticipant = initialRoom
    ? isHost
      ? initialRoom.guest
      : initialRoom.host
    : null;

  const primaryWeaponId = profile.favoriteWeaponId || 'pulse_rifle';
  const secondaryWeaponId =
    primaryWeaponId === 'tactical_sidearm' ? 'pulse_rifle' : 'tactical_sidearm';

  const [activeSlot, setActiveSlot] = useState<'primary' | 'secondary'>('primary');
  const activeWeaponId = activeSlot === 'primary' ? primaryWeaponId : secondaryWeaponId;
  const activeWeapon = getWeaponById(activeWeaponId);
  const selfCharacter = getCharacterById(profile.selectedCharacterId);

  const [hud, setHud] = useState({
    hp: selfCharacter.maxHp,
    maxHp: selfCharacter.maxHp,
    ammo: activeWeapon.magSize,
    magSize: activeWeapon.magSize,
    reloading: false,
    reloadProgress: 0,
    crouched: false,
    aiming: false,
    alive: true,
    respawnSec: 0,
    myKills: 0,
    myDeaths: 0,
    oppKills: 0,
    oppDeaths: 0,
    oppHp: 100,
    oppMaxHp: 100,
    rangeHits: 0,
    rangeHeadshots: 0,
    elapsedSec: 0,
    pointerLocked: false,
    showTabBoard: false,
  });

  const [muted, setMuted] = useState(false);
  const [touchMode, setTouchMode] = useState(() =>
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 900)
  );
  const [hitBanner, setHitBanner] = useState<HitFeedback | null>(null);
  const [killNotice, setKillNotice] = useState<string | null>(null);
  const [matchEndedState, setMatchEndedState] = useState<{
    finished: boolean;
    victory: boolean;
    myKills: number;
    myDeaths: number;
    oppKills: number;
    oppDeaths: number;
  } | null>(null);

  // Mutable live game state refs used inside animation loop
  const controlsRef = useRef({
    keys: new Set<string>(),
    joyX: 0,
    joyY: 0,
    firing: false,
    aiming: false,
    crouched: false,
    sprinting: false,
    jumpQueued: false,
    reloadQueued: false,
    switchQueued: null as 'primary' | 'secondary' | null,
    yaw: isHost ? Math.PI : 0, // Host starts at z=+20 looking toward -Z (yaw=PI or 0? let's verify!)
    pitch: -0.04,
  });

  // Note: In Three.js right-handed space, forward vector along yaw=0:
  // If character faces +Z by default (weapon barrel points +Z), then looking toward -Z means yaw = Math.PI!
  // Let's make camera/player forward consistent everywhere:
  // forward = (-Math.sin(yaw), 0, -Math.cos(yaw)) when yaw = 0 points -Z!
  // Let's initialize Host at z=+20 facing -Z (yaw=0) and Guest at z=-20 facing +Z (yaw=Math.PI).
  useEffect(() => {
    controlsRef.current.yaw = isHost ? 0 : Math.PI;
  }, [isHost]);

  const activeSlotRef = useRef<'primary' | 'secondary'>('primary');
  const roomRef = useRef<GameRoom | null>(initialRoom);
  const finishedTriggeredRef = useRef(false);
  const joyContainerRef = useRef<HTMLDivElement | null>(null);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0, active: false });
  const aimTouchRef = useRef<{ id: number | null; lastX: number; lastY: number }>({
    id: null,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    soundEngine.setMuted(muted);
  }, [muted]);

  // Helper to update active weapon slot cleanly
  function selectWeaponSlot(slot: 'primary' | 'secondary'): void {
    if (activeSlotRef.current === slot) return;
    activeSlotRef.current = slot;
    setActiveSlot(slot);
    controlsRef.current.switchQueued = slot;
  }

  // Main Three.js Scene + Physics + Network Sync Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const softwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !softwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(softwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !softwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      62,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.15,
      320
    );

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const rangeTargets: RangeTargetEntity[] = buildArenaEnvironment(scene, maxAniso, isTraining);

    // Self operative rig
    const selfRig = createOperativeRig({
      characterId: profile.selectedCharacterId,
      accentHex: selfCharacter.accentColor,
      weaponId: primaryWeaponId,
    });
    const startX = isHost ? -2.5 : 2.5;
    const startZ = isHost ? 20 : -20;
    selfRig.root.position.set(startX, 0, startZ);
    scene.add(selfRig.root);

    // Opponent operative rig (for live 1v1)
    let oppRig: OperativeRig | null = null;
    if (!isTraining && opponentParticipant) {
      oppRig = createOperativeRig({
        characterId: opponentParticipant.characterId,
        accentHex: '#F43F5E',
        weaponId: opponentParticipant.weaponId,
      });
      oppRig.root.position.set(isHost ? 2.5 : -2.5, 0, isHost ? -20 : 20);
      scene.add(oppRig.root);
    }

    // Muzzle flash light & sprite
    const muzzleLight = new THREE.PointLight(0xffb347, 0, 7);
    scene.add(muzzleLight);

    const tracerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd27d,
      transparent: true,
      opacity: 0.9,
    });
    const enemyTracerMaterial = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.9,
    });
    const activeTracers: TracerBeam[] = [];

    function spawnTracer(
      start: THREE.Vector3,
      end: THREE.Vector3,
      isEnemy: boolean
    ): void {
      const dist = start.distanceTo(end);
      if (dist < 0.05) return;
      const geo = new THREE.CylinderGeometry(0.018, 0.018, dist, 6);
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, isEnemy ? enemyTracerMaterial : tracerMaterial);
      mesh.position.copy(start).lerp(end, 0.5);
      mesh.lookAt(end);
      scene.add(mesh);
      activeTracers.push({ mesh, expiresAt: performance.now() + 90 });
    }

    // Local simulation state
    const sim = {
      x: startX,
      y: 0,
      vy: 0,
      z: startZ,
      grounded: true,
      hp: selfCharacter.maxHp,
      maxHp: selfCharacter.maxHp,
      alive: true,
      respawnAtMs: 0,
      ammoPrimary: getWeaponById(primaryWeaponId).magSize,
      ammoSecondary: getWeaponById(secondaryWeaponId).magSize,
      reloadingUntil: 0,
      reloadDurationMs: 1100,
      lastFireMs: 0,
      camFov: 62,
      camPos: new THREE.Vector3(startX, 2.2, startZ + (isHost ? 3.5 : -3.5)),
      camLook: new THREE.Vector3(startX, 1.4, startZ),
      seq: 0,
      shotSeq: 0,
      pendingShotEvent: null as null | {
        shotSeq: number;
        origin: [number, number, number];
        end: [number, number, number];
        hitOpponent: boolean;
        damage: number;
        headshot: boolean;
      },
      myKills: 0,
      myDeaths: 0,
      oppKills: 0,
      oppDeaths: 0,
      rangeHits: 0,
      rangeHeadshots: 0,
      startMs: performance.now(),
      seenEventIds: new Set<string>(),
    };

    const oppNet = {
      targetX: isHost ? 2.5 : -2.5,
      targetY: 0,
      targetZ: isHost ? -20 : 20,
      targetYaw: isHost ? Math.PI : 0,
      targetPitch: 0,
      x: isHost ? 2.5 : -2.5,
      y: 0,
      z: isHost ? -20 : 20,
      yaw: isHost ? Math.PI : 0,
      pitch: 0,
      crouched: false,
      aiming: false,
      reloading: false,
      alive: true,
      hp: 110,
      maxHp: 110,
      speed: 0,
      weaponId: opponentParticipant?.weaponId ?? 'pulse_rifle',
    };

    // Reusable Three.js scratch vectors (no per-frame allocations)
    const tmpForward = new THREE.Vector3();
    const tmpRight = new THREE.Vector3();
    const tmpRayOrigin = new THREE.Vector3();
    const tmpRayDir = new THREE.Vector3();
    const tmpMuzzleWorld = new THREE.Vector3();
    const tmpShoulderPos = new THREE.Vector3();
    const tmpDesiredCam = new THREE.Vector3();
    const tmpDesiredLook = new THREE.Vector3();
    const tmpShotEnd = new THREE.Vector3();
    const tmpOppCenter = new THREE.Vector3();
    const tmpOppHead = new THREE.Vector3();
    const tmpToCenter = new THREE.Vector3();

    // Pointer lock & mouse look handlers
    let draggingMouseLook = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const onCanvasPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      soundEngine.unlock();
      if (e.button === 2) {
        controlsRef.current.aiming = true;
        return;
      }
      if (e.button === 0) {
        if (document.pointerLockElement !== renderer.domElement && !touchMode) {
          try {
            renderer.domElement.requestPointerLock?.();
          } catch {
            // fallback drag look
          }
          draggingMouseLook = true;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
        }
        controlsRef.current.firing = true;
      }
    };

    const onWindowPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const sens = controlsRef.current.aiming ? 0.0017 : 0.0027;
      if (document.pointerLockElement === renderer.domElement) {
        controlsRef.current.yaw -= e.movementX * sens;
        controlsRef.current.pitch = THREE.MathUtils.clamp(
          controlsRef.current.pitch - e.movementY * sens,
          -0.85,
          0.72
        );
      } else if (draggingMouseLook) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        controlsRef.current.yaw -= dx * sens;
        controlsRef.current.pitch = THREE.MathUtils.clamp(
          controlsRef.current.pitch - dy * sens,
          -0.85,
          0.72
        );
      }
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      if (e.button === 2) controlsRef.current.aiming = false;
      if (e.button === 0) {
        controlsRef.current.firing = false;
        draggingMouseLook = false;
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onPointerLockChange = () => {
      setHud((h) => ({ ...h, pointerLocked: document.pointerLockElement === renderer.domElement }));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      controlsRef.current.keys.add(code);
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        controlsRef.current.sprinting = true;
      }
      if (code === 'KeyC' || code === 'ControlLeft') {
        if (!e.repeat) {
          controlsRef.current.crouched = !controlsRef.current.crouched;
        }
      }
      if (code === 'Space') {
        e.preventDefault();
        controlsRef.current.jumpQueued = true;
      }
      if (code === 'KeyR') {
        controlsRef.current.reloadQueued = true;
      }
      if (code === 'KeyQ') {
        controlsRef.current.aiming = true;
      }
      if (code === 'Digit1') selectWeaponSlot('primary');
      if (code === 'Digit2') selectWeaponSlot('secondary');
      if (code === 'Tab') {
        e.preventDefault();
        setHud((h) => ({ ...h, showTabBoard: true }));
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      controlsRef.current.keys.delete(code);
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        controlsRef.current.sprinting = false;
      }
      if (code === 'KeyQ') {
        controlsRef.current.aiming = false;
      }
      if (code === 'Tab') {
        setHud((h) => ({ ...h, showTabBoard: false }));
      }
    };

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    // Background 1v1 network sync loop (every 80ms)
    let syncInFlight = false;
    let syncInterval: number | null = null;

    if (!isTraining && initialRoom) {
      syncInterval = window.setInterval(async () => {
        if (syncInFlight || finishedTriggeredRef.current) return;
        syncInFlight = true;
        try {
          sim.seq += 1;
          const slotWeaponId =
            activeSlotRef.current === 'primary' ? primaryWeaponId : secondaryWeaponId;
          const shotPayload = sim.pendingShotEvent ?? undefined;
          sim.pendingShotEvent = null;

          const res = await syncRoomCombat(initialRoom.code, {
            x: sim.x,
            y: sim.y,
            z: sim.z,
            yaw: controlsRef.current.yaw,
            pitch: controlsRef.current.pitch,
            vx: 0,
            vz: 0,
            crouched: controlsRef.current.crouched,
            sprinting: controlsRef.current.sprinting,
            aiming: controlsRef.current.aiming,
            reloading: performance.now() < sim.reloadingUntil,
            weaponId: slotWeaponId,
            characterId: profile.selectedCharacterId,
            seq: sim.seq,
            shotEvent: shotPayload,
          });

          roomRef.current = res.room;

          // Sync authoritative self HP / alive status from server
          sim.hp = res.selfState.hp;
          sim.maxHp = res.selfState.maxHp;
          if (sim.alive && !res.selfState.alive) {
            sim.alive = false;
            sim.respawnAtMs = performance.now() + 2200;
            setKillNotice('Eliminated! Respawning...');
            window.setTimeout(() => setKillNotice(null), 1800);
          } else if (!sim.alive && res.selfState.alive) {
            sim.alive = true;
            sim.x = res.selfState.x;
            sim.z = res.selfState.z;
            sim.ammoPrimary = getWeaponById(primaryWeaponId).magSize;
            sim.ammoSecondary = getWeaponById(secondaryWeaponId).magSize;
          }

          sim.myKills = isHost ? res.room.host.kills : res.room.guest?.kills ?? 0;
          sim.myDeaths = isHost ? res.room.host.deaths : res.room.guest?.deaths ?? 0;
          sim.oppKills = isHost ? res.room.guest?.kills ?? 0 : res.room.host.kills;
          sim.oppDeaths = isHost ? res.room.guest?.deaths ?? 0 : res.room.host.deaths;

          if (res.opponentState) {
            const prevX = oppNet.targetX;
            const prevZ = oppNet.targetZ;
            oppNet.targetX = res.opponentState.x;
            oppNet.targetY = res.opponentState.y;
            oppNet.targetZ = res.opponentState.z;
            oppNet.targetYaw = res.opponentState.yaw;
            oppNet.targetPitch = res.opponentState.pitch;
            oppNet.crouched = res.opponentState.crouched;
            oppNet.aiming = res.opponentState.aiming;
            oppNet.reloading = res.opponentState.reloading;
            oppNet.alive = res.opponentState.alive;
            oppNet.hp = res.opponentState.hp;
            oppNet.maxHp = res.opponentState.maxHp;
            oppNet.weaponId = res.opponentState.weaponId;
            oppNet.speed = Math.hypot(oppNet.targetX - prevX, oppNet.targetZ - prevZ) * 12;
          }

          // Render opponent shot tracers & kill events
          res.events.forEach((ev: CombatEvent) => {
            if (sim.seenEventIds.has(ev.id)) return;
            sim.seenEventIds.add(ev.id);
            if (ev.type === 'shot' && ev.fromPlayerId !== profile.playerId && ev.origin && ev.end) {
              spawnTracer(
                new THREE.Vector3(ev.origin[0], ev.origin[1], ev.origin[2]),
                new THREE.Vector3(ev.end[0], ev.end[1], ev.end[2]),
                true
              );
              soundEngine.playGunshot(oppNet.weaponId);
            }
            if (ev.type === 'kill' && ev.fromPlayerId === profile.playerId) {
              soundEngine.playKill();
              setKillNotice(ev.headshot ? 'HEADSHOT ELIMINATION!' : 'ELIMINATION!');
              window.setTimeout(() => setKillNotice(null), 1800);
            }
          });

          if (res.room.status === 'finished' && !finishedTriggeredRef.current) {
            finishedTriggeredRef.current = true;
            const victory = res.room.winnerPlayerId === profile.playerId;
            if (document.pointerLockElement) {
              document.exitPointerLock?.();
            }
            setMatchEndedState({
              finished: true,
              victory,
              myKills: sim.myKills,
              myDeaths: sim.myDeaths,
              oppKills: sim.oppKills,
              oppDeaths: sim.oppDeaths,
            });
          }
        } catch {
          // transient network hiccup - keep running smoothly
        } finally {
          syncInFlight = false;
        }
      }, 85);
    }

    // Ray-sphere helper for accurate headshot & body hitbox detection
    function raySphereHit(
      origin: THREE.Vector3,
      dir: THREE.Vector3,
      center: THREE.Vector3,
      radius: number,
      maxDist: number
    ): number | null {
      tmpToCenter.copy(center).sub(origin);
      const proj = tmpToCenter.dot(dir);
      if (proj < 0 || proj > maxDist) return null;
      const perpSq = tmpToCenter.lengthSq() - proj * proj;
      if (perpSq > radius * radius) return null;
      const thc = Math.sqrt(radius * radius - perpSq);
      return Math.max(0, proj - thc);
    }

    function attemptFireWeapon(nowMs: number): void {
      if (!sim.alive || nowMs < sim.reloadingUntil) return;
      const slot = activeSlotRef.current;
      const wId = slot === 'primary' ? primaryWeaponId : secondaryWeaponId;
      const w = getWeaponById(wId);

      if (nowMs - sim.lastFireMs < w.fireRateMs) return;

      const curAmmo = slot === 'primary' ? sim.ammoPrimary : sim.ammoSecondary;
      if (curAmmo <= 0) {
        sim.lastFireMs = nowMs;
        soundEngine.playEmptyClick();
        controlsRef.current.reloadQueued = true;
        return;
      }

      sim.lastFireMs = nowMs;
      if (slot === 'primary') sim.ammoPrimary -= 1;
      else sim.ammoSecondary -= 1;

      soundEngine.playGunshot(wId);
      selfRig.recoilOffset = 1.0;

      // Subtle camera recoil kick
      controlsRef.current.pitch = THREE.MathUtils.clamp(
        controlsRef.current.pitch + (wId === 'rail_carbine' ? 0.032 : 0.012),
        -0.85,
        0.72
      );

      // Compute camera ray (center of crosshair!)
      camera.getWorldPosition(tmpRayOrigin);
      camera.getWorldDirection(tmpRayDir);

      // Apply weapon spread (tighter while ADS aiming or crouching)
      const spreadFactor =
        w.spreadRad *
        (controlsRef.current.aiming ? 0.32 : 1.0) *
        (controlsRef.current.crouched ? 0.72 : 1.0);

      selfRig.weaponAssembly.muzzleAnchor.getWorldPosition(tmpMuzzleWorld);
      muzzleLight.position.copy(tmpMuzzleWorld);
      muzzleLight.intensity = 4.5;

      let bestOppHitDist = Infinity;
      let hitOppHead = false;
      let totalOppDamage = 0;
      let anyHit = false;
      let tracerTarget = tmpShotEnd.copy(tmpRayOrigin).addScaledVector(tmpRayDir, 65);

      for (let p = 0; p < w.pellets; p++) {
        const sx = (Math.random() - 0.5) * spreadFactor;
        const sy = (Math.random() - 0.5) * spreadFactor;
        const shotDir = tmpRayDir
          .clone()
          .add(new THREE.Vector3(sx, sy, (Math.random() - 0.5) * spreadFactor))
          .normalize();

        const wallDist = raycastObstacles(tmpRayOrigin, shotDir, 90);
        let hitDist = wallDist;

        if (!isTraining && oppRig && oppNet.alive) {
          const crouchOffset = oppNet.crouched ? -0.42 : 0;
          tmpOppHead.set(oppNet.x, oppNet.y + 1.62 + crouchOffset, oppNet.z);
          tmpOppCenter.set(oppNet.x, oppNet.y + 1.05 + crouchOffset * 0.55, oppNet.z);

          const headHit = raySphereHit(tmpRayOrigin, shotDir, tmpOppHead, 0.25, wallDist);
          const bodyHit = raySphereHit(tmpRayOrigin, shotDir, tmpOppCenter, 0.44, wallDist);

          if (headHit !== null && headHit < wallDist) {
            hitDist = headHit;
            anyHit = true;
            hitOppHead = true;
            totalOppDamage += Math.round(w.damage * 1.75);
            if (headHit < bestOppHitDist) bestOppHitDist = headHit;
          } else if (bodyHit !== null && bodyHit < wallDist) {
            hitDist = bodyHit;
            anyHit = true;
            totalOppDamage += w.damage;
            if (bodyHit < bestOppHitDist) bestOppHitDist = bodyHit;
          }
        } else if (isTraining) {
          for (const tgt of rangeTargets) {
            if (nowMs < tgt.downUntilMs) continue;
            const worldPos = tgt.group.position;
            tmpOppHead.set(worldPos.x, 1.80, worldPos.z);
            tmpOppCenter.set(worldPos.x, 1.22, worldPos.z);
            const hHit = raySphereHit(tmpRayOrigin, shotDir, tmpOppHead, 0.23, wallDist);
            const bHit = raySphereHit(tmpRayOrigin, shotDir, tmpOppCenter, 0.40, wallDist);
            if (hHit !== null && hHit < wallDist) {
              hitDist = hHit;
              const dmg = Math.round(w.damage * 1.75);
              tgt.hp -= dmg;
              sim.rangeHits += 1;
              sim.rangeHeadshots += 1;
              soundEngine.playHitmarker(true);
              setHitBanner({ id: Date.now() + p, damage: dmg, headshot: true, ts: nowMs });
              if (tgt.hp <= 0) {
                tgt.downUntilMs = nowMs + 1800;
                tgt.hp = tgt.maxHp;
                soundEngine.playKill();
              }
            } else if (bHit !== null && bHit < wallDist) {
              hitDist = bHit;
              const dmg = w.damage;
              tgt.hp -= dmg;
              sim.rangeHits += 1;
              soundEngine.playHitmarker(false);
              setHitBanner({ id: Date.now() + p, damage: dmg, headshot: false, ts: nowMs });
              if (tgt.hp <= 0) {
                tgt.downUntilMs = nowMs + 1800;
                tgt.hp = tgt.maxHp;
                soundEngine.playKill();
              }
            }
          }
        }

        const endPt = tmpRayOrigin.clone().addScaledVector(shotDir, hitDist);
        if (p === 0) tracerTarget = endPt;
        spawnTracer(tmpMuzzleWorld, endPt, false);
      }

      if (anyHit) {
        soundEngine.playHitmarker(hitOppHead);
        setHitBanner({
          id: Date.now(),
          damage: totalOppDamage,
          headshot: hitOppHead,
          ts: nowMs,
        });
      }

      if (!isTraining) {
        sim.shotSeq += 1;
        sim.pendingShotEvent = {
          shotSeq: sim.shotSeq,
          origin: [tmpMuzzleWorld.x, tmpMuzzleWorld.y, tmpMuzzleWorld.z],
          end: [tracerTarget.x, tracerTarget.y, tracerTarget.z],
          hitOpponent: anyHit,
          damage: totalOppDamage,
          headshot: hitOppHead,
        };
      }
    }

    let rafId = 0;
    let timerId = 0;
    let lastTime = performance.now();
    let lastHudSync = 0;

    function afterDraw(fn: () => void): void {
      if (softwareGl) {
        timerId = window.setTimeout(fn, 16);
      } else {
        rafId = window.requestAnimationFrame(fn);
      }
    }

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      // Weapon switch queue
      if (controlsRef.current.switchQueued) {
        const nextId =
          controlsRef.current.switchQueued === 'primary' ? primaryWeaponId : secondaryWeaponId;
        controlsRef.current.switchQueued = null;
        sim.reloadingUntil = 0;
        swapRigWeapon(selfRig, nextId);
      }

      const curSlot = activeSlotRef.current;
      const curWeaponId = curSlot === 'primary' ? primaryWeaponId : secondaryWeaponId;
      const curWeapon = getWeaponById(curWeaponId);

      // Reload handling
      if (controlsRef.current.reloadQueued) {
        controlsRef.current.reloadQueued = false;
        const curAmmo = curSlot === 'primary' ? sim.ammoPrimary : sim.ammoSecondary;
        if (now >= sim.reloadingUntil && curAmmo < curWeapon.magSize) {
          sim.reloadingUntil = now + curWeapon.reloadMs;
          sim.reloadDurationMs = curWeapon.reloadMs;
          soundEngine.playReload();
        }
      }

      if (sim.reloadingUntil > 0 && now >= sim.reloadingUntil) {
        sim.reloadingUntil = 0;
        if (curSlot === 'primary') sim.ammoPrimary = curWeapon.magSize;
        else sim.ammoSecondary = curWeapon.magSize;
      }

      const isReloading = sim.reloadingUntil > 0 && now < sim.reloadingUntil;

      // Movement vector relative to camera yaw
      const yaw = controlsRef.current.yaw;
      tmpForward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      tmpRight.set(Math.cos(yaw), 0, -Math.sin(yaw));

      let moveFwd = 0;
      let moveStrafe = 0;
      const k = controlsRef.current.keys;
      if (k.has('KeyW') || k.has('ArrowUp')) moveFwd += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) moveFwd -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) moveStrafe += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) moveStrafe -= 1;

      if (Math.abs(controlsRef.current.joyX) > 0.05 || Math.abs(controlsRef.current.joyY) > 0.05) {
        moveStrafe += controlsRef.current.joyX;
        moveFwd -= controlsRef.current.joyY;
      }

      const moveLen = Math.hypot(moveFwd, moveStrafe);
      let moveSpeed = (selfCharacter.moveSpeed / 38); // ~5.6 - 7.3 m/s
      if (controlsRef.current.crouched) moveSpeed *= 0.56;
      else if (controlsRef.current.aiming) moveSpeed *= 0.72;
      else if (controlsRef.current.sprinting || moveLen > 0.92) moveSpeed *= 1.24;

      let actualSpeed = 0;
      if (sim.alive && moveLen > 0.05) {
        const nf = moveFwd / Math.max(1, moveLen);
        const ns = moveStrafe / Math.max(1, moveLen);
        const vx = (tmpForward.x * nf + tmpRight.x * ns) * moveSpeed;
        const vz = (tmpForward.z * nf + tmpRight.z * ns) * moveSpeed;
        const resolved = resolvePlayerObstacleCollision(
          sim.x + vx * dt,
          sim.z + vz * dt,
          0.42
        );
        sim.x = resolved.x;
        sim.z = resolved.z;
        actualSpeed = Math.hypot(vx, vz);
      }

      // Jump physics
      if (controlsRef.current.jumpQueued) {
        controlsRef.current.jumpQueued = false;
        if (sim.alive && sim.grounded) {
          sim.vy = 5.4;
          sim.grounded = false;
          controlsRef.current.crouched = false;
        }
      }
      if (!sim.grounded) {
        sim.vy -= 16.5 * dt;
        sim.y += sim.vy * dt;
        if (sim.y <= 0) {
          sim.y = 0;
          sim.vy = 0;
          sim.grounded = true;
        }
      }

      // Firing check
      if (controlsRef.current.firing) {
        attemptFireWeapon(now);
      }

      // Update local operative rig
      selfRig.root.position.set(sim.x, sim.y, sim.z);
      selfRig.root.rotation.y = yaw + Math.PI; // rig's front faces +Z in local space; yaw=0 faces -Z
      updateOperativePose(selfRig, {
        dt,
        speed: actualSpeed,
        crouched: controlsRef.current.crouched,
        aiming: controlsRef.current.aiming,
        reloading: isReloading,
        pitch: controlsRef.current.pitch,
        alive: sim.alive,
      });

      // Update remote opponent rig smoothly
      if (oppRig) {
        oppNet.x = THREE.MathUtils.damp(oppNet.x, oppNet.targetX, 14, dt);
        oppNet.y = THREE.MathUtils.damp(oppNet.y, oppNet.targetY, 14, dt);
        oppNet.z = THREE.MathUtils.damp(oppNet.z, oppNet.targetZ, 14, dt);

        // Shortest angular interpolation
        let yawDiff = oppNet.targetYaw - oppNet.yaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        oppNet.yaw += yawDiff * Math.min(1, 14 * dt);
        oppNet.pitch = THREE.MathUtils.damp(oppNet.pitch, oppNet.targetPitch, 14, dt);

        swapRigWeapon(oppRig, oppNet.weaponId);
        oppRig.root.position.set(oppNet.x, oppNet.y, oppNet.z);
        oppRig.root.rotation.y = oppNet.yaw + Math.PI;
        updateOperativePose(oppRig, {
          dt,
          speed: oppNet.speed,
          crouched: oppNet.crouched,
          aiming: oppNet.aiming,
          reloading: oppNet.reloading,
          pitch: oppNet.pitch,
          alive: oppNet.alive,
        });
      }

      // Animate training range targets
      if (isTraining) {
        const sec = now * 0.001;
        for (const t of rangeTargets) {
          if (t.moving) {
            t.group.position.x = t.baseX + Math.sin(sec * 1.45 + t.phase) * 2.8;
          }
          const isDown = now < t.downUntilMs;
          t.group.rotation.x = THREE.MathUtils.damp(t.group.rotation.x, isDown ? Math.PI / 2 : 0, 14, dt);
        }
      }

      // Over-the-shoulder Free-Fire Third-Person Camera with obstacle collision pull-in
      const targetFov = controlsRef.current.aiming
        ? curWeaponId === 'rail_carbine'
          ? 34
          : 44
        : 62;
      if (Math.abs(sim.camFov - targetFov) > 0.05) {
        sim.camFov = THREE.MathUtils.damp(sim.camFov, targetFov, 14, dt);
        camera.fov = sim.camFov;
        camera.updateProjectionMatrix();
      }

      const eyeY = sim.y + (controlsRef.current.crouched ? 1.16 : 1.62);
      const shoulderOffsetRight = controlsRef.current.aiming ? 0.56 : 0.68;
      const camBackDist = controlsRef.current.aiming ? 1.75 : 3.2;
      const pitch = controlsRef.current.pitch;

      tmpShoulderPos.set(
        sim.x + tmpRight.x * shoulderOffsetRight,
        eyeY,
        sim.z + tmpRight.z * shoulderOffsetRight
      );

      const horizBack = Math.cos(pitch) * camBackDist;
      const vertOffset = -Math.sin(pitch) * camBackDist;
      const backDir = new THREE.Vector3(
        -tmpForward.x * horizBack,
        vertOffset + 0.28,
        -tmpForward.z * horizBack
      ).normalize();
      const maxCamDist = raycastObstacles(tmpShoulderPos, backDir, camBackDist) - 0.25;
      const safeDist = Math.max(0.65, maxCamDist);

      tmpDesiredCam
        .copy(tmpShoulderPos)
        .addScaledVector(backDir, safeDist);
      tmpDesiredCam.y = Math.max(0.45, tmpDesiredCam.y);

      tmpDesiredLook.set(
        tmpShoulderPos.x + tmpForward.x * 28,
        eyeY + Math.sin(pitch) * 28,
        tmpShoulderPos.z + tmpForward.z * 28
      );

      sim.camPos.lerp(tmpDesiredCam, 1 - Math.exp(-22 * dt));
      sim.camLook.lerp(tmpDesiredLook, 1 - Math.exp(-26 * dt));
      camera.position.copy(sim.camPos);
      camera.lookAt(sim.camLook);

      // Decay muzzle light & clean expired tracers
      if (muzzleLight.intensity > 0.02) {
        muzzleLight.intensity = THREE.MathUtils.damp(muzzleLight.intensity, 0, 28, dt);
      } else {
        muzzleLight.intensity = 0;
      }

      for (let i = activeTracers.length - 1; i >= 0; i--) {
        if (now >= activeTracers[i].expiresAt) {
          scene.remove(activeTracers[i].mesh);
          activeTracers[i].mesh.geometry.dispose();
          activeTracers.splice(i, 1);
        }
      }

      renderer.render(scene, camera);

      // Throttle React HUD updates (~15Hz)
      if (now - lastHudSync > 65) {
        lastHudSync = now;
        const reloadPct = isReloading
          ? Math.min(100, Math.round((1 - (sim.reloadingUntil - now) / sim.reloadDurationMs) * 100))
          : 0;
        setHud((prev) => ({
          ...prev,
          hp: sim.hp,
          maxHp: sim.maxHp,
          ammo: curSlot === 'primary' ? sim.ammoPrimary : sim.ammoSecondary,
          magSize: curWeapon.magSize,
          reloading: isReloading,
          reloadProgress: reloadPct,
          crouched: controlsRef.current.crouched,
          aiming: controlsRef.current.aiming,
          alive: sim.alive,
          respawnSec: !sim.alive ? Math.max(0, Math.ceil((sim.respawnAtMs - now) / 1000)) : 0,
          myKills: sim.myKills,
          myDeaths: sim.myDeaths,
          oppKills: sim.oppKills,
          oppDeaths: sim.oppDeaths,
          oppHp: oppNet.hp,
          oppMaxHp: oppNet.maxHp,
          rangeHits: sim.rangeHits,
          rangeHeadshots: sim.rangeHeadshots,
          elapsedSec: Math.floor((now - sim.startMs) / 1000),
        }));
      }

      afterDraw(tick);
    };

    afterDraw(tick);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timerId) window.clearTimeout(timerId);
      if (syncInterval) window.clearInterval(syncInterval);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.();
      }
      renderer.domElement.removeEventListener('pointerdown', onCanvasPointerDown);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [
    initialRoom,
    isHost,
    isTraining,
    opponentParticipant,
    primaryWeaponId,
    profile.playerId,
    profile.selectedCharacterId,
    secondaryWeaponId,
    selfCharacter.accentColor,
    selfCharacter.maxHp,
    touchMode,
  ]);

  // Clear hit banner after 450ms
  useEffect(() => {
    if (!hitBanner) return;
    const t = window.setTimeout(() => setHitBanner(null), 480);
    return () => window.clearTimeout(t);
  }, [hitBanner]);

  function handleJoyPointer(e: React.PointerEvent<HTMLDivElement>, active: boolean): void {
    e.stopPropagation();
    const box = joyContainerRef.current?.getBoundingClientRect();
    if (!box) return;
    if (!active) {
      controlsRef.current.joyX = 0;
      controlsRef.current.joyY = 0;
      controlsRef.current.sprinting = false;
      setJoyKnob({ x: 0, y: 0, active: false });
      return;
    }
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const maxR = box.width * 0.42;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxR, dist);
    const angle = Math.atan2(dy, dx);
    const nx = dist > 2 ? (Math.cos(angle) * clamped) / maxR : 0;
    const ny = dist > 2 ? (Math.sin(angle) * clamped) / maxR : 0;
    controlsRef.current.joyX = nx;
    controlsRef.current.joyY = ny;
    controlsRef.current.sprinting = dist > maxR * 0.85;
    setJoyKnob({ x: nx * maxR, y: ny * maxR, active: true });
  }

  function handleAimTouchStart(e: React.PointerEvent<HTMLDivElement>): void {
    soundEngine.unlock();
    if (aimTouchRef.current.id !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    aimTouchRef.current = { id: e.pointerId, lastX: e.clientX, lastY: e.clientY };
  }

  function handleAimTouchMove(e: React.PointerEvent<HTMLDivElement>): void {
    if (aimTouchRef.current.id !== e.pointerId) return;
    const dx = e.clientX - aimTouchRef.current.lastX;
    const dy = e.clientY - aimTouchRef.current.lastY;
    aimTouchRef.current.lastX = e.clientX;
    aimTouchRef.current.lastY = e.clientY;
    const sens = controlsRef.current.aiming ? 0.0038 : 0.0056;
    controlsRef.current.yaw -= dx * sens;
    controlsRef.current.pitch = THREE.MathUtils.clamp(
      controlsRef.current.pitch - dy * sens,
      -0.85,
      0.72
    );
  }

  function handleAimTouchEnd(e: React.PointerEvent<HTMLDivElement>): void {
    if (aimTouchRef.current.id === e.pointerId) {
      aimTouchRef.current.id = null;
    }
  }

  function submitFinishedResult(): void {
    if (!initialRoom || !opponentParticipant) {
      onExitToLobby();
      return;
    }
    const endInfo = matchEndedState ?? {
      victory: hud.myKills >= hud.oppKills,
      myKills: hud.myKills,
      myDeaths: hud.myDeaths,
      oppKills: hud.oppKills,
      oppDeaths: hud.oppDeaths,
    };

    const participants: MatchParticipantResult[] = [
      {
        playerId: profile.playerId,
        username: profile.username,
        displayName: profile.displayName,
        profilePictureUrl: profile.profilePictureUrl,
        selectedAvatarId: profile.selectedAvatarId,
        profileThemeId: profile.profileThemeId,
        level: profile.level,
        characterId: profile.selectedCharacterId,
        weaponId: primaryWeaponId,
        team: 'allies',
        kills: endInfo.myKills,
        deaths: endInfo.myDeaths,
        score: endInfo.myKills * 220 + (endInfo.victory ? 300 : 80),
        isUser: true,
      },
      {
        playerId: opponentParticipant.playerId,
        username: opponentParticipant.username,
        displayName: opponentParticipant.displayName,
        profilePictureUrl: opponentParticipant.profilePictureUrl,
        selectedAvatarId: opponentParticipant.selectedAvatarId,
        profileThemeId: opponentParticipant.profileThemeId,
        level: opponentParticipant.level,
        characterId: opponentParticipant.characterId,
        weaponId: opponentParticipant.weaponId,
        team: 'rivals',
        kills: endInfo.oppKills,
        deaths: endInfo.oppDeaths,
        score: endInfo.oppKills * 220 + (!endInfo.victory ? 300 : 80),
        isUser: false,
      },
    ];

    onMatchFinished({
      mode: '1v1_duel',
      outcome: endInfo.victory ? 'victory' : 'defeat',
      kills: endInfo.myKills,
      deaths: endInfo.myDeaths,
      score: endInfo.myKills * 220 + (endInfo.victory ? 300 : 80),
      durationSec: Math.max(10, hud.elapsedSec),
      participants,
    });
  }

  async function handleExitButton(): Promise<void> {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    if (!isTraining && initialRoom && !matchEndedState) {
      await leaveBattleRoom(initialRoom.code).catch(() => {});
    }
    onExitToLobby();
  }

  return (
    <div className="fixed inset-0 bg-[#0d1320] overflow-hidden select-none">
      {/* Three.js Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Center Dynamic Tactical Crosshair */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-20">
        <div
          className={`relative transition-transform duration-75 ${
            hud.aiming ? 'scale-75' : hud.crouched ? 'scale-90' : 'scale-100'
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(255,122,47,0.9)]" />
          <div className="absolute left-1/2 -top-3.5 -translate-x-1/2 w-0.5 h-2.5 bg-white/85" />
          <div className="absolute left-1/2 -bottom-3.5 -translate-x-1/2 w-0.5 h-2.5 bg-white/85" />
          <div className="absolute top-1/2 -left-3.5 -translate-y-1/2 h-0.5 w-2.5 bg-white/85" />
          <div className="absolute top-1/2 -right-3.5 -translate-y-1/2 h-0.5 w-2.5 bg-white/85" />
        </div>

        {/* Hitmarker & Damage Number */}
        {hitBanner && (
          <div className="absolute -translate-y-10 flex flex-col items-center">
            <span
              className={`font-display font-extrabold text-xl tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
                hitBanner.headshot ? 'text-amber-300' : 'text-white'
              }`}
            >
              {hitBanner.headshot ? `HEADSHOT -${hitBanner.damage}` : `-${hitBanner.damage}`}
            </span>
          </div>
        )}
      </div>

      {/* Top Match Scoreboard Bar (No backdrop-blur over WebGL) */}
      <div className="fixed top-3 left-3 right-3 z-30 flex items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => void handleExitButton()}
            className="clay-btn-secondary px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="clay-btn-secondary p-2 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setTouchMode((t) => !t)}
            title="Toggle On-Screen Touch Controls"
            className={`px-3 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border ${
              touchMode
                ? 'bg-orange-600 text-white border-orange-300/40'
                : 'clay-btn-secondary text-slate-200'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{touchMode ? 'Touch HUD: ON' : 'Touch HUD'}</span>
          </button>
        </div>

        {/* Center 1v1 Score Pill / Training Stats */}
        {isTraining ? (
          <div className="rounded-2xl bg-[#182135]/95 border border-white/15 px-5 py-2 flex items-center gap-5 text-xs font-mono shadow-xl">
            <span className="text-orange-400 font-bold">3D FIRING RANGE</span>
            <span className="text-slate-200 tabular-nums">Hits: {hud.rangeHits}</span>
            <span className="text-amber-300 tabular-nums">Headshots: {hud.rangeHeadshots}</span>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#182135]/95 border border-white/15 px-4 sm:px-6 py-2 flex items-center gap-4 sm:gap-6 shadow-xl">
            <div className="text-right">
              <p className="text-[11px] font-bold text-emerald-400 truncate max-w-[90px]">
                {profile.displayName}
              </p>
              <p className="font-display text-2xl font-extrabold text-white tabular-nums leading-none">
                {hud.myKills}
              </p>
            </div>
            <div className="text-center px-2 border-x border-white/10">
              <p className="text-[10px] font-mono text-slate-400">FIRST TO {initialRoom?.maxKills ?? 5}</p>
              <p className="text-xs font-mono font-bold text-orange-400 tabular-nums">
                {Math.floor(hud.elapsedSec / 60)}:
                {String(hud.elapsedSec % 60).padStart(2, '0')}
              </p>
            </div>
            <div className="text-left">
              <p className="text-[11px] font-bold text-rose-400 truncate max-w-[90px]">
                {opponentParticipant?.displayName ?? 'Opponent'}
              </p>
              <p className="font-display text-2xl font-extrabold text-white tabular-nums leading-none">
                {hud.oppKills}
              </p>
            </div>
          </div>
        )}

        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-200 bg-[#182135]/90 border border-white/10 rounded-xl px-3 py-1.5">
          <span>
            {hud.pointerLocked
              ? 'Mouse Locked · ESC Unlock'
              : 'Click Arena to Lock Aim · WASD Move · C Crouch · R Reload'}
          </span>
        </div>
      </div>

      {/* Kill / Elimination Toast */}
      {killNotice && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-30">
          <div className="rounded-2xl bg-orange-600 text-white font-display font-extrabold text-xl tracking-wider px-6 py-2 shadow-2xl border border-orange-300/40">
            {killNotice}
          </div>
        </div>
      )}

      {/* Respawn Overlay */}
      {!hud.alive && !matchEndedState && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-rose-950/40">
          <div className="clay-card px-8 py-6 text-center">
            <p className="text-xs font-mono text-rose-300">ELIMINATED</p>
            <p className="font-display text-4xl font-extrabold text-white mt-1">
              Respawning in {hud.respawnSec}s
            </p>
          </div>
        </div>
      )}

      {/* Opponent HP Indicator (1v1) */}
      {!isTraining && opponentParticipant && (
        <div className="pointer-events-none fixed top-20 right-4 z-20 hidden sm:block">
          <div className="rounded-2xl bg-[#182135]/90 border border-white/10 px-4 py-2.5 w-48 shadow-lg">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-rose-300 truncate">{opponentParticipant.displayName}</span>
              <span className="font-mono text-slate-300 tabular-nums">{hud.oppHp}</span>
            </div>
            <div className="h-2 rounded-full bg-[#0d1320] overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all duration-100"
                style={{ width: `${Math.max(0, Math.min(100, (hud.oppHp / hud.oppMaxHp) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Health & Weapon Loadout Bar */}
      <div className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-end gap-3">
        <div className="pointer-events-auto rounded-2xl bg-[#182135]/95 border border-white/15 px-4 py-2.5 flex items-center gap-4 shadow-2xl">
          {/* HP Bar */}
          <div className="w-32 sm:w-44">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-emerald-400 inline-flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                HP
              </span>
              <span className="font-mono font-bold text-white tabular-nums">
                {hud.hp} / {hud.maxHp}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[#0d1320] overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.hp > 50 ? 'bg-emerald-400' : hud.hp > 25 ? 'bg-amber-400' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100))}%` }}
              />
            </div>
          </div>

          <div className="h-8 w-px bg-white/10" />

          {/* Gun & Ammo */}
          <button
            type="button"
            onClick={() => selectWeaponSlot(activeSlot === 'primary' ? 'secondary' : 'primary')}
            className="text-left cursor-pointer"
            title="Switch Primary / Sidearm (1 / 2)"
          >
            <p className="text-[11px] font-bold text-orange-400 truncate max-w-[130px]">
              {activeWeapon.name}
            </p>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-xl font-extrabold text-white tabular-nums">
                {hud.reloading ? 'RELOAD' : hud.ammo}
              </span>
              {!hud.reloading && (
                <span className="text-xs text-slate-400 tabular-nums">/ {hud.magSize}</span>
              )}
            </div>
            {hud.reloading && (
              <div className="h-1.5 w-24 rounded-full bg-[#0d1320] mt-1 overflow-hidden">
                <div
                  className="h-full bg-orange-400 transition-all duration-75"
                  style={{ width: `${hud.reloadProgress}%` }}
                />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile / Touch Controls Overlay (Right-half aim zone + Left Joystick + Free-Fire Action Buttons) */}
      {touchMode && !matchEndedState && (
        <>
          {/* Right-side invisible touch aim pad */}
          <div
            onPointerDown={handleAimTouchStart}
            onPointerMove={handleAimTouchMove}
            onPointerUp={handleAimTouchEnd}
            onPointerCancel={handleAimTouchEnd}
            className="fixed inset-y-16 right-0 w-1/2 z-20"
            style={{ touchAction: 'none' }}
          />

          {/* Left Virtual Thumbstick */}
          <div
            ref={joyContainerRef}
            onPointerDown={(e) => {
              soundEngine.unlock();
              e.currentTarget.setPointerCapture(e.pointerId);
              handleJoyPointer(e, true);
            }}
            onPointerMove={(e) => {
              if (joyKnob.active) handleJoyPointer(e, true);
            }}
            onPointerUp={(e) => handleJoyPointer(e, false)}
            onPointerCancel={(e) => handleJoyPointer(e, false)}
            className="fixed bottom-16 left-5 z-30 w-32 h-32 rounded-full bg-[#182135]/80 border-2 border-white/20 flex items-center justify-center shadow-2xl"
            style={{ touchAction: 'none' }}
          >
            <div
              className="w-12 h-12 rounded-full bg-orange-500 border-2 border-orange-200/70 shadow-lg"
              style={{
                transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
              }}
            />
          </div>

          {/* Right Ergonomic Tactical Action Cluster */}
          <div
            className="fixed bottom-16 right-4 z-30 flex flex-col items-end gap-3"
            style={{ touchAction: 'none' }}
          >
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  controlsRef.current.aiming = !controlsRef.current.aiming;
                }}
                className={`w-13 h-13 rounded-full font-bold text-[11px] border-2 flex items-center justify-center shadow-lg ${
                  hud.aiming
                    ? 'bg-sky-500 text-slate-950 border-sky-200'
                    : 'bg-[#1f2940]/90 text-white border-white/25'
                }`}
              >
                SCOPE
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  controlsRef.current.crouched = !controlsRef.current.crouched;
                }}
                className={`w-13 h-13 rounded-full font-bold text-[11px] border-2 flex items-center justify-center shadow-lg ${
                  hud.crouched
                    ? 'bg-amber-400 text-slate-950 border-amber-200'
                    : 'bg-[#1f2940]/90 text-white border-white/25'
                }`}
              >
                CROUCH
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  controlsRef.current.reloadQueued = true;
                }}
                className="w-13 h-13 rounded-full bg-[#1f2940]/90 text-white border-2 border-white/25 font-bold text-[11px] flex flex-col items-center justify-center shadow-lg"
              >
                <RotateCw className="w-4 h-4" />
                <span>RLD</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  controlsRef.current.jumpQueued = true;
                }}
                className="w-13 h-13 rounded-full bg-[#1f2940]/90 text-white border-2 border-white/25 font-bold text-[11px] flex items-center justify-center shadow-lg"
              >
                JUMP
              </button>

              {/* Big Free-Fire Trigger Button */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  soundEngine.unlock();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  controlsRef.current.firing = true;
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  controlsRef.current.firing = false;
                }}
                onPointerCancel={() => {
                  controlsRef.current.firing = false;
                }}
                className="w-20 h-20 rounded-full bg-orange-600 active:bg-orange-500 text-white border-4 border-orange-200/70 font-display font-extrabold text-lg flex flex-col items-center justify-center shadow-2xl"
              >
                <Crosshair className="w-6 h-6" />
                <span className="text-xs">FIRE</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Match Finished Summary Modal */}
      {matchEndedState && (
        <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
          <div className="clay-card max-w-md w-full p-7 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-orange-500/20 text-orange-400">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xs font-mono text-orange-400">1v1 ARENA COMPLETE</p>
              <h2 className="font-display text-4xl font-extrabold text-white mt-1">
                {matchEndedState.victory ? 'VICTORY!' : 'DEFEAT'}
              </h2>
            </div>

            <div className="clay-inset p-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-400">{profile.displayName}</p>
                <p className="font-display text-3xl font-extrabold text-emerald-400 tabular-nums">
                  {matchEndedState.myKills} Kills
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">
                  {opponentParticipant?.displayName ?? 'Opponent'}
                </p>
                <p className="font-display text-3xl font-extrabold text-rose-400 tabular-nums">
                  {matchEndedState.oppKills} Kills
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={submitFinishedResult}
              className="clay-btn-primary w-full py-3.5 font-bold text-base cursor-pointer"
            >
              Claim Rewards &amp; View Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
