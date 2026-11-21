import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Crosshair,
  Eye,
  Gamepad2,
  LogOut,
  MousePointer,
  RotateCw,
  Shield,
  Skull,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getCharacterById, getWeaponById } from '../lib/catalog.ts';
import { leaveBattleRoom, syncRoomCombat } from '../lib/api.ts';
import {
  buildArenaEnvironment,
  raycastObstacles,
  resolvePlayerObstacleCollision,
  updateRainSystem,
} from '../three/arenaEnvironment.ts';
import {
  createFirstPersonRig,
  createOperativeRig,
  createZombieRig,
  swapFirstPersonWeapon,
  swapRigWeapon,
  updateFirstPersonRig,
  updateOperativePose,
  updateZombiePose,
  type OperativeRig,
  type ZombieRig,
} from '../three/proceduralModels.ts';
import { soundEngine } from '../three/soundEngine.ts';
import type {
  CameraPerspective,
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

interface ZombieEntity {
  id: number;
  variant: 'shambler' | 'sprinter' | 'brute';
  rig: ZombieRig;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  scoreValue: number;
  lastAttackMs: number;
  hitFlashUntil: number;
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

const MAX_ZOMBIE_WAVES = 5;

export function Arena3DView({
  account,
  mode,
  room: initialRoom,
  onMatchFinished,
  onExitToLobby,
}: Arena3DViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { profile } = account;
  const isTraining = mode === 'training_range';
  const isZombieMode = mode === 'zombie_survival';
  const isPvp = mode === '1v1_duel' && Boolean(initialRoom);

  const roomCode = initialRoom?.code ?? null;
  const maxKillsTarget = initialRoom?.maxKills ?? 5;
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
  const isSniperActive = activeWeaponId === 'awp_viper' || activeWeaponId === 'rail_carbine';

  const [perspective, setPerspective] = useState<CameraPerspective>('fps');
  const perspectiveRef = useRef<CameraPerspective>('fps');

  const [muted, setMuted] = useState(false);
  const [touchMode, setTouchMode] = useState(() =>
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 900)
  );
  const touchModeRef = useRef(touchMode);
  touchModeRef.current = touchMode;

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
    oppHp: 110,
    oppMaxHp: 110,
    rangeHits: 0,
    rangeHeadshots: 0,
    zombieWave: 1,
    zombiesRemaining: 0,
    zombieScore: 0,
    elapsedSec: 0,
    pointerLocked: false,
    hurtFlash: false,
  });

  const [hitBanner, setHitBanner] = useState<HitFeedback | null>(null);
  const [killNotice, setKillNotice] = useState<string | null>(null);
  const [matchEndedState, setMatchEndedState] = useState<{
    finished: boolean;
    victory: boolean;
    myKills: number;
    myDeaths: number;
    oppKills: number;
    oppDeaths: number;
    score: number;
    waveReached?: number;
  } | null>(null);

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
    yaw: isHost ? 0 : Math.PI,
    pitch: -0.02,
  });

  useEffect(() => {
    controlsRef.current.yaw = isHost ? 0 : Math.PI;
  }, [isHost]);

  const activeSlotRef = useRef<'primary' | 'secondary'>('primary');
  const roomRef = useRef<GameRoom | null>(initialRoom);
  roomRef.current = initialRoom;
  const oppRef = useRef(opponentParticipant);
  oppRef.current = opponentParticipant;
  const onMatchFinishedRef = useRef(onMatchFinished);
  onMatchFinishedRef.current = onMatchFinished;
  const onExitToLobbyRef = useRef(onExitToLobby);
  onExitToLobbyRef.current = onExitToLobby;

  const rendererDomRef = useRef<HTMLCanvasElement | null>(null);
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

  function selectWeaponSlot(slot: 'primary' | 'secondary'): void {
    if (activeSlotRef.current === slot) return;
    activeSlotRef.current = slot;
    setActiveSlot(slot);
    controlsRef.current.switchQueued = slot;
  }

  function togglePerspective(): void {
    const next: CameraPerspective = perspectiveRef.current === 'fps' ? 'tps' : 'fps';
    perspectiveRef.current = next;
    setPerspective(next);
  }

  function requestMouseLock(): void {
    soundEngine.unlock();
    soundEngine.startRain();
    const el = rendererDomRef.current;
    if (!el) return;
    if (document.pointerLockElement === el) {
      document.exitPointerLock?.();
    } else {
      try {
        el.requestPointerLock?.();
      } catch {
        // ignore
      }
    }
  }

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    finishedTriggeredRef.current = false;

    const softwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !softwareGl,
      powerPreference: 'high-performance',
    });
    rendererDomRef.current = renderer.domElement;
    renderer.setPixelRatio(softwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
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
      72,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      320
    );
    scene.add(camera);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const { rangeTargets, rain } = buildArenaEnvironment(scene, maxAniso, isTraining);

    // Third-person operative rig (shown in TPS)
    const selfRig = createOperativeRig({
      characterId: profile.selectedCharacterId,
      accentHex: selfCharacter.accentColor,
      weaponId: primaryWeaponId,
    });
    const startX = isZombieMode ? 0 : isHost ? -2.5 : 2.5;
    const startZ = isZombieMode ? 0 : isHost ? 20 : -20;
    selfRig.root.position.set(startX, 0, startZ);
    selfRig.root.visible = perspectiveRef.current === 'tps';
    scene.add(selfRig.root);

    // First-person tactical arms + weapon viewmodel attached to camera
    const fpRig = createFirstPersonRig(primaryWeaponId);
    fpRig.root.visible = perspectiveRef.current === 'fps';
    camera.add(fpRig.root);

    // Remote opponent rig (1v1 PvP)
    let oppRig: OperativeRig | null = null;
    const oppInfo = oppRef.current;
    if (isPvp && oppInfo) {
      oppRig = createOperativeRig({
        characterId: oppInfo.characterId,
        accentHex: '#F43F5E',
        weaponId: oppInfo.weaponId,
      });
      oppRig.root.position.set(isHost ? 2.5 : -2.5, 0, isHost ? -20 : 20);
      scene.add(oppRig.root);
    }

    const muzzleLight = new THREE.PointLight(0xffb347, 0, 8);
    scene.add(muzzleLight);

    const tracerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd27d,
      transparent: true,
      opacity: 0.92,
    });
    const enemyTracerMaterial = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.92,
    });
    const activeTracers: TracerBeam[] = [];

    function spawnTracer(start: THREE.Vector3, end: THREE.Vector3, isEnemy: boolean): void {
      const dist = start.distanceTo(end);
      if (dist < 0.05) return;
      const geo = new THREE.CylinderGeometry(0.016, 0.016, dist, 6);
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, isEnemy ? enemyTracerMaterial : tracerMaterial);
      mesh.position.copy(start).lerp(end, 0.5);
      mesh.lookAt(end);
      scene.add(mesh);
      activeTracers.push({ mesh, expiresAt: performance.now() + 85 });
    }

    const sim = {
      x: startX,
      y: 0,
      vy: 0,
      z: startZ,
      vx: 0,
      vz: 0,
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
      camFov: 72,
      crouchHeightBlend: 0,
      camPos: new THREE.Vector3(startX, 1.62, startZ),
      camLook: new THREE.Vector3(startX, 1.5, startZ + (isHost ? -10 : 10)),
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
      hurtFlashUntil: 0,
      startMs: performance.now(),
      seenEventIds: new Set<string>(),
    };

    const oppNet = {
      targetX: isHost ? 2.5 : -2.5,
      targetY: 0,
      targetZ: isHost ? -20 : 20,
      vx: 0,
      vz: 0,
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
      weaponId: oppInfo?.weaponId ?? 'pulse_rifle',
    };

    // Zombie Outbreak Survival state
    const zombies: ZombieEntity[] = [];
    let zombieIdSeq = 1;
    let currentWave = 1;
    let waveIntermissionUntil = 0;
    let waveBannerShownFor = 0;
    let zombieScore = 0;
    let nextGroanAt = performance.now() + 2500;

    function spawnZombieWave(wave: number): void {
      const total = 5 + wave * 3; // Wave 1: 8, Wave 2: 11, Wave 3: 14, Wave 4: 17, Wave 5: 20
      for (let i = 0; i < total; i++) {
        let variant: 'shambler' | 'sprinter' | 'brute' = 'shambler';
        if (wave >= 3 && i % 7 === 0) variant = 'brute';
        else if (wave >= 2 && i % 3 === 1) variant = 'sprinter';

        const angle = (i / total) * Math.PI * 2 + Math.random() * 0.35;
        const dist = 21 + Math.random() * 4.5;
        const rawX = Math.cos(angle) * dist;
        const rawZ = Math.sin(angle) * dist;
        const safe = resolvePlayerObstacleCollision(rawX, rawZ, 0.55);

        const rig = createZombieRig(variant);
        rig.root.position.set(safe.x, 0, safe.z);
        scene.add(rig.root);

        const baseHp = variant === 'brute' ? 230 : variant === 'sprinter' ? 68 : 95;
        const hpScale = 1 + (wave - 1) * 0.14;
        const maxHp = Math.round(baseHp * hpScale);
        const speed =
          variant === 'sprinter'
            ? 4.7 + wave * 0.16
            : variant === 'brute'
              ? 2.45 + wave * 0.08
              : 3.15 + wave * 0.11;

        zombies.push({
          id: zombieIdSeq++,
          variant,
          rig,
          x: safe.x,
          z: safe.z,
          hp: maxHp,
          maxHp,
          speed,
          damage: variant === 'brute' ? 26 : variant === 'sprinter' ? 14 : 17,
          scoreValue: variant === 'brute' ? 320 : variant === 'sprinter' ? 160 : 120,
          lastAttackMs: 0,
          hitFlashUntil: 0,
        });
      }
      setKillNotice(`WAVE ${wave} / ${MAX_ZOMBIE_WAVES} INCOMING`);
      window.setTimeout(() => setKillNotice(null), 2200);
    }

    if (isZombieMode) {
      spawnZombieWave(1);
    }

    // Scratch vectors
    const tmpForward = new THREE.Vector3();
    const tmpRight = new THREE.Vector3();
    const tmpRayOrigin = new THREE.Vector3();
    const tmpRayDir = new THREE.Vector3();
    const tmpMuzzleWorld = new THREE.Vector3();
    const tmpShoulderPos = new THREE.Vector3();
    const tmpDesiredCam = new THREE.Vector3();
    const tmpDesiredLook = new THREE.Vector3();
    const tmpBackDir = new THREE.Vector3();
    const tmpShotEnd = new THREE.Vector3();
    const tmpTargetHead = new THREE.Vector3();
    const tmpTargetCenter = new THREE.Vector3();
    const tmpToCenter = new THREE.Vector3();

    let draggingMouseLook = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let rainStarted = false;

    const unlockAudioAndRain = () => {
      soundEngine.unlock();
      if (!rainStarted) {
        rainStarted = true;
        soundEngine.startRain();
      }
    };

    const onCanvasPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      unlockAudioAndRain();
      if (e.button === 2) {
        controlsRef.current.aiming = true;
        return;
      }
      if (e.button === 0) {
        draggingMouseLook = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        controlsRef.current.firing = true;
      }
    };

    const onWindowPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const sens = controlsRef.current.aiming ? 0.0017 : 0.0028;
      let dx = 0;
      let dy = 0;
      if (document.pointerLockElement === renderer.domElement) {
        dx = e.movementX;
        dy = e.movementY;
      } else if (draggingMouseLook) {
        dx = e.clientX - lastMouseX;
        dy = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
      if (dx !== 0 || dy !== 0) {
        controlsRef.current.yaw -= dx * sens;
        controlsRef.current.pitch = THREE.MathUtils.clamp(
          controlsRef.current.pitch - dy * sens,
          -0.95,
          0.82
        );
        fpRig.swayX = THREE.MathUtils.clamp(fpRig.swayX - dx * 0.015, -1.2, 1.2);
        fpRig.swayY = THREE.MathUtils.clamp(fpRig.swayY + dy * 0.015, -1.2, 1.2);
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

    const resetStuckInputs = () => {
      controlsRef.current.keys.clear();
      controlsRef.current.firing = false;
      controlsRef.current.aiming = false;
      controlsRef.current.sprinting = false;
      draggingMouseLook = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      unlockAudioAndRain();
      const code = e.code;
      controlsRef.current.keys.add(code);
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        controlsRef.current.sprinting = true;
      }
      if ((code === 'KeyC' || code === 'ControlLeft') && !e.repeat) {
        controlsRef.current.crouched = !controlsRef.current.crouched;
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
      if (code === 'KeyV' && !e.repeat) {
        togglePerspective();
      }
      if (code === 'KeyL' && !e.repeat) {
        requestMouseLock();
      }
      if (code === 'Digit1') selectWeaponSlot('primary');
      if (code === 'Digit2') selectWeaponSlot('secondary');
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
    window.addEventListener('blur', resetStuckInputs);
    document.addEventListener('visibilitychange', resetStuckInputs);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    // Real-time 1v1 Sync Loop (65ms, velocity dead-reckoning + column-isolated server updates)
    let syncInFlight = false;
    let syncInterval: number | null = null;

    if (isPvp && roomCode) {
      syncInterval = window.setInterval(async () => {
        if (syncInFlight || finishedTriggeredRef.current) return;
        syncInFlight = true;
        try {
          sim.seq += 1;
          const slotWeaponId =
            activeSlotRef.current === 'primary' ? primaryWeaponId : secondaryWeaponId;
          const shotPayload = sim.pendingShotEvent ?? undefined;
          sim.pendingShotEvent = null;

          const res = await syncRoomCombat(roomCode, {
            x: sim.x,
            y: sim.y,
            z: sim.z,
            yaw: controlsRef.current.yaw,
            pitch: controlsRef.current.pitch,
            vx: sim.vx,
            vz: sim.vz,
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

          const prevHp = sim.hp;
          sim.hp = res.selfState.hp;
          sim.maxHp = res.selfState.maxHp;
          if (sim.hp < prevHp) {
            sim.hurtFlashUntil = performance.now() + 260;
          }

          if (sim.alive && !res.selfState.alive) {
            sim.alive = false;
            sim.respawnAtMs = performance.now() + 2200;
            setKillNotice('ELIMINATED! RESPAWNING...');
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
            oppNet.targetX = res.opponentState.x;
            oppNet.targetY = res.opponentState.y;
            oppNet.targetZ = res.opponentState.z;
            oppNet.vx = res.opponentState.vx || 0;
            oppNet.vz = res.opponentState.vz || 0;
            oppNet.targetYaw = res.opponentState.yaw;
            oppNet.targetPitch = res.opponentState.pitch;
            oppNet.crouched = res.opponentState.crouched;
            oppNet.aiming = res.opponentState.aiming;
            oppNet.reloading = res.opponentState.reloading;
            oppNet.alive = res.opponentState.alive;
            oppNet.hp = res.opponentState.hp;
            oppNet.maxHp = res.opponentState.maxHp;
            oppNet.weaponId = res.opponentState.weaponId;
            oppNet.speed = Math.hypot(oppNet.vx, oppNet.vz);
          }

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
              score: sim.myKills * 220 + (victory ? 300 : 80),
            });
          }
        } catch {
          // Keep local loop smooth during transient packet loss
        } finally {
          syncInFlight = false;
        }
      }, 65);
    }

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
      fpRig.recoil = 1.0;

      const recoilKick =
        wId === 'awp_viper'
          ? 0.045
          : wId === 'rail_carbine'
            ? 0.028
            : wId === 'desert_hawk'
              ? 0.026
              : wId === 'scatter_cannon'
                ? 0.028
                : 0.0095;
      controlsRef.current.pitch = THREE.MathUtils.clamp(
        controlsRef.current.pitch + recoilKick,
        -0.95,
        0.82
      );

      camera.getWorldPosition(tmpRayOrigin);
      camera.getWorldDirection(tmpRayDir);

      const spreadFactor =
        w.spreadRad *
        (controlsRef.current.aiming ? 0.25 : 1.0) *
        (controlsRef.current.crouched ? 0.72 : 1.0);

      if (perspectiveRef.current === 'fps' && fpRig.root.visible) {
        fpRig.weaponAssembly.muzzleAnchor.getWorldPosition(tmpMuzzleWorld);
      } else if (perspectiveRef.current === 'fps') {
        tmpMuzzleWorld
          .copy(tmpRayOrigin)
          .addScaledVector(tmpRayDir, 0.45)
          .addScaledVector(tmpRight, 0.14);
        tmpMuzzleWorld.y -= 0.1;
      } else {
        selfRig.weaponAssembly.muzzleAnchor.getWorldPosition(tmpMuzzleWorld);
      }
      muzzleLight.position.copy(tmpMuzzleWorld);
      muzzleLight.intensity = 4.8;

      let hitOppHead = false;
      let totalOppDamage = 0;
      let anyOppHit = false;
      let tracerTarget = tmpShotEnd.copy(tmpRayOrigin).addScaledVector(tmpRayDir, 70);

      for (let p = 0; p < w.pellets; p++) {
        const sx = (Math.random() - 0.5) * spreadFactor;
        const sy = (Math.random() - 0.5) * spreadFactor;
        const shotDir = tmpRayDir
          .clone()
          .add(new THREE.Vector3(sx, sy, (Math.random() - 0.5) * spreadFactor))
          .normalize();

        const wallDist = raycastObstacles(tmpRayOrigin, shotDir, 95);
        let hitDist = wallDist;

        if (isPvp && oppRig && oppNet.alive) {
          const crouchOffset = oppNet.crouched ? -0.42 : 0;
          tmpTargetHead.set(oppNet.x, oppNet.y + 1.62 + crouchOffset, oppNet.z);
          tmpTargetCenter.set(oppNet.x, oppNet.y + 1.05 + crouchOffset * 0.55, oppNet.z);

          const headHit = raySphereHit(tmpRayOrigin, shotDir, tmpTargetHead, 0.27, wallDist);
          const bodyHit = raySphereHit(tmpRayOrigin, shotDir, tmpTargetCenter, 0.46, wallDist);

          if (headHit !== null && headHit < wallDist) {
            hitDist = headHit;
            anyOppHit = true;
            hitOppHead = true;
            totalOppDamage += Math.round(w.damage * 1.75);
          } else if (bodyHit !== null && bodyHit < wallDist) {
            hitDist = bodyHit;
            anyOppHit = true;
            totalOppDamage += w.damage;
          }
        } else if (isZombieMode) {
          let closestZombieIdx = -1;
          let closestDist = wallDist;
          let closestIsHead = false;

          for (let zi = 0; zi < zombies.length; zi++) {
            const zmb = zombies[zi];
            const scale = zmb.variant === 'brute' ? 1.28 : zmb.variant === 'sprinter' ? 0.96 : 1.03;
            tmpTargetHead.set(zmb.x, 1.65 * scale, zmb.z);
            tmpTargetCenter.set(zmb.x, 1.08 * scale, zmb.z);

            const hHit = raySphereHit(tmpRayOrigin, shotDir, tmpTargetHead, 0.26 * scale, closestDist);
            if (hHit !== null && hHit < closestDist) {
              closestDist = hHit;
              closestZombieIdx = zi;
              closestIsHead = true;
            }
            const bHit = raySphereHit(
              tmpRayOrigin,
              shotDir,
              tmpTargetCenter,
              0.44 * scale,
              closestDist
            );
            if (bHit !== null && bHit < closestDist) {
              closestDist = bHit;
              closestZombieIdx = zi;
              closestIsHead = false;
            }
          }

          if (closestZombieIdx >= 0) {
            hitDist = closestDist;
            const zmb = zombies[closestZombieIdx];
            const dmg = closestIsHead ? Math.round(w.damage * 1.85) : w.damage;
            zmb.hp -= dmg;
            zmb.hitFlashUntil = nowMs + 110;
            // Knockback away from shot direction
            const kb = resolvePlayerObstacleCollision(
              zmb.x + shotDir.x * 0.22,
              zmb.z + shotDir.z * 0.22,
              0.42
            );
            zmb.x = kb.x;
            zmb.z = kb.z;

            soundEngine.playHitmarker(closestIsHead);
            setHitBanner({
              id: Date.now() + p,
              damage: dmg,
              headshot: closestIsHead,
              ts: nowMs,
            });

            if (zmb.hp <= 0) {
              scene.remove(zmb.rig.root);
              zombies.splice(closestZombieIdx, 1);
              sim.myKills += 1;
              zombieScore += zmb.scoreValue + (closestIsHead ? 60 : 0);
              soundEngine.playKill();
            }
          }
        } else if (isTraining) {
          for (const tgt of rangeTargets) {
            if (nowMs < tgt.downUntilMs) continue;
            const worldPos = tgt.group.position;
            tmpTargetHead.set(worldPos.x, 1.80, worldPos.z);
            tmpTargetCenter.set(worldPos.x, 1.22, worldPos.z);
            const hHit = raySphereHit(tmpRayOrigin, shotDir, tmpTargetHead, 0.24, wallDist);
            const bHit = raySphereHit(tmpRayOrigin, shotDir, tmpTargetCenter, 0.42, wallDist);
            if (hHit !== null && hHit < wallDist) {
              hitDist = hHit;
              const dmg = Math.round(w.damage * 1.85);
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

      if (anyOppHit) {
        soundEngine.playHitmarker(hitOppHead);
        setHitBanner({
          id: Date.now(),
          damage: totalOppDamage,
          headshot: hitOppHead,
          ts: nowMs,
        });
      }

      if (isPvp) {
        sim.shotSeq += 1;
        sim.pendingShotEvent = {
          shotSeq: sim.shotSeq,
          origin: [tmpMuzzleWorld.x, tmpMuzzleWorld.y, tmpMuzzleWorld.z],
          end: [tracerTarget.x, tracerTarget.y, tracerTarget.z],
          hitOpponent: anyOppHit,
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
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          if (sync) {
            gl.flush();
            const poll = () => {
              const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
              if (status === gl.SIGNALED) {
                gl.deleteSync(sync);
                fn();
              } else {
                timerId = window.setTimeout(poll, 8);
              }
            };
            timerId = window.setTimeout(poll, 16);
            return;
          }
        }
        timerId = window.setTimeout(fn, 35);
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
        swapFirstPersonWeapon(fpRig, nextId);
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
      let moveSpeed = selfCharacter.moveSpeed / 36;
      if (controlsRef.current.crouched) moveSpeed *= 0.58;
      else if (controlsRef.current.aiming) moveSpeed *= 0.72;
      else if (controlsRef.current.sprinting || moveLen > 0.92) moveSpeed *= 1.24;

      let actualSpeed = 0;
      sim.vx = 0;
      sim.vz = 0;
      if (sim.alive && moveLen > 0.05 && !finishedTriggeredRef.current) {
        const nf = moveFwd / Math.max(1, moveLen);
        const ns = moveStrafe / Math.max(1, moveLen);
        const vx = (tmpForward.x * nf + tmpRight.x * ns) * moveSpeed;
        const vz = (tmpForward.z * nf + tmpRight.z * ns) * moveSpeed;
        const resolved = resolvePlayerObstacleCollision(sim.x + vx * dt, sim.z + vz * dt, 0.42);
        sim.vx = (resolved.x - sim.x) / dt;
        sim.vz = (resolved.z - sim.z) / dt;
        sim.x = resolved.x;
        sim.z = resolved.z;
        actualSpeed = Math.hypot(sim.vx, sim.vz);
      }

      // Jump physics
      if (controlsRef.current.jumpQueued) {
        controlsRef.current.jumpQueued = false;
        if (sim.alive && sim.grounded) {
          sim.vy = 5.6;
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
      if (controlsRef.current.firing && !finishedTriggeredRef.current) {
        attemptFireWeapon(now);
      }

      // Update local TPS rig & FPS rig
      const isFps = perspectiveRef.current === 'fps';
      selfRig.root.visible = !isFps;
      selfRig.root.position.set(sim.x, sim.y, sim.z);
      selfRig.root.rotation.y = yaw + Math.PI;
      updateOperativePose(selfRig, {
        dt,
        speed: actualSpeed,
        crouched: controlsRef.current.crouched,
        aiming: controlsRef.current.aiming,
        reloading: isReloading,
        pitch: controlsRef.current.pitch,
        alive: sim.alive,
      });

      const sniperScoped =
        isFps &&
        controlsRef.current.aiming &&
        (curWeaponId === 'awp_viper' || curWeaponId === 'rail_carbine');
      fpRig.root.visible = isFps && sim.alive && !sniperScoped;
      if (fpRig.root.visible) {
        updateFirstPersonRig(fpRig, {
          dt,
          speed: actualSpeed,
          aiming: controlsRef.current.aiming,
          reloading: isReloading,
          crouched: controlsRef.current.crouched,
        });
      }

      // Smooth dead-reckoned remote opponent interpolation (PvP)
      if (oppRig) {
        if (oppNet.alive && oppNet.speed > 0.1) {
          oppNet.x += oppNet.vx * dt;
          oppNet.z += oppNet.vz * dt;
        }
        oppNet.x = THREE.MathUtils.damp(oppNet.x, oppNet.targetX, 16, dt);
        oppNet.y = THREE.MathUtils.damp(oppNet.y, oppNet.targetY, 16, dt);
        oppNet.z = THREE.MathUtils.damp(oppNet.z, oppNet.targetZ, 16, dt);

        let yawDiff = oppNet.targetYaw - oppNet.yaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        oppNet.yaw += yawDiff * Math.min(1, 16 * dt);
        oppNet.pitch = THREE.MathUtils.damp(oppNet.pitch, oppNet.targetPitch, 16, dt);

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

      // Zombie Survival AI & Wave Progression
      if (isZombieMode && !finishedTriggeredRef.current) {
        if (zombies.length === 0) {
          if (currentWave >= MAX_ZOMBIE_WAVES) {
            finishedTriggeredRef.current = true;
            if (document.pointerLockElement) document.exitPointerLock?.();
            setMatchEndedState({
              finished: true,
              victory: true,
              myKills: sim.myKills,
              myDeaths: sim.myDeaths,
              oppKills: 0,
              oppDeaths: 0,
              score: zombieScore + 600,
              waveReached: currentWave,
            });
          } else if (waveIntermissionUntil === 0) {
            waveIntermissionUntil = now + 2600;
            if (waveBannerShownFor !== currentWave) {
              waveBannerShownFor = currentWave;
              setKillNotice(`WAVE ${currentWave} CLEARED! +25 HP & REFILL`);
              sim.hp = Math.min(sim.maxHp, sim.hp + 25);
              sim.ammoPrimary = getWeaponById(primaryWeaponId).magSize;
              sim.ammoSecondary = getWeaponById(secondaryWeaponId).magSize;
              window.setTimeout(() => setKillNotice(null), 2100);
            }
          } else if (now >= waveIntermissionUntil) {
            waveIntermissionUntil = 0;
            currentWave += 1;
            spawnZombieWave(currentWave);
          }
        } else {
          if (now >= nextGroanAt) {
            nextGroanAt = now + 4200 + Math.random() * 4500;
            soundEngine.playZombieGroan();
          }

          for (let i = 0; i < zombies.length; i++) {
            const zmb = zombies[i];
            const dx = sim.x - zmb.x;
            const dz = sim.z - zmb.z;
            const dist = Math.hypot(dx, dz);
            const zYaw = Math.atan2(dx, dz);

            if (dist > 1.05 && sim.alive) {
              const dirX = dx / dist;
              const dirZ = dz / dist;
              // Soft separation so zombies don't stack inside one another
              let sepX = 0;
              let sepZ = 0;
              for (let j = 0; j < zombies.length; j++) {
                if (i === j) continue;
                const ox = zmb.x - zombies[j].x;
                const oz = zmb.z - zombies[j].z;
                const odSq = ox * ox + oz * oz;
                if (odSq > 0.001 && odSq < 1.15) {
                  const od = Math.sqrt(odSq);
                  sepX += (ox / od) * (1.1 - od);
                  sepZ += (oz / od) * (1.1 - od);
                }
              }

              const nextPos = resolvePlayerObstacleCollision(
                zmb.x + (dirX * zmb.speed + sepX * 1.4) * dt,
                zmb.z + (dirZ * zmb.speed + sepZ * 1.4) * dt,
                zmb.variant === 'brute' ? 0.56 : 0.38
              );
              zmb.x = nextPos.x;
              zmb.z = nextPos.z;
            }

            if (dist <= 1.38 && sim.alive && now - zmb.lastAttackMs > 950) {
              zmb.lastAttackMs = now;
              sim.hp = Math.max(0, sim.hp - zmb.damage);
              sim.hurtFlashUntil = now + 300;
              soundEngine.playZombieGroan();

              if (sim.hp <= 0) {
                sim.alive = false;
                sim.myDeaths += 1;
                finishedTriggeredRef.current = true;
                if (document.pointerLockElement) document.exitPointerLock?.();
                setMatchEndedState({
                  finished: true,
                  victory: false,
                  myKills: sim.myKills,
                  myDeaths: 1,
                  oppKills: 0,
                  oppDeaths: 0,
                  score: zombieScore,
                  waveReached: currentWave,
                });
              }
            }

            zmb.rig.root.position.set(zmb.x, 0, zmb.z);
            zmb.rig.root.rotation.y = zYaw;
            zmb.rig.root.scale.setScalar(
              (zmb.variant === 'brute' ? 1.28 : zmb.variant === 'sprinter' ? 0.96 : 1.03) *
                (now < zmb.hitFlashUntil ? 1.05 : 1.0)
            );
            updateZombiePose(zmb.rig, dt, dist > 1.05 ? zmb.speed : 0.4);
          }
        }
      }

      // Animate training range targets
      if (isTraining) {
        const sec = now * 0.001;
        for (const t of rangeTargets) {
          if (t.moving) {
            t.group.position.x = t.baseX + Math.sin(sec * 1.45 + t.phase) * 2.8;
          }
          const isDown = now < t.downUntilMs;
          t.group.rotation.x = THREE.MathUtils.damp(
            t.group.rotation.x,
            isDown ? Math.PI / 2 : 0,
            14,
            dt
          );
        }
      }

      // Update Stormy Night Rain & Lightning
      updateRainSystem(scene, rain, sim.x, sim.z, dt, now, () => {
        soundEngine.playThunder();
      });

      // Camera FOV + First-Person vs Third-Person Positioning
      const targetFov = controlsRef.current.aiming
        ? curWeaponId === 'awp_viper'
          ? 24
          : curWeaponId === 'rail_carbine'
            ? 34
            : 48
        : isFps
          ? 74
          : 62;
      if (Math.abs(sim.camFov - targetFov) > 0.05) {
        sim.camFov = THREE.MathUtils.damp(sim.camFov, targetFov, 15, dt);
        camera.fov = sim.camFov;
        camera.updateProjectionMatrix();
      }

      sim.crouchHeightBlend = THREE.MathUtils.damp(
        sim.crouchHeightBlend,
        controlsRef.current.crouched ? 1 : 0,
        14,
        dt
      );
      const eyeY = sim.y + THREE.MathUtils.lerp(1.62, 1.14, sim.crouchHeightBlend);
      const pitch = controlsRef.current.pitch;

      if (isFps) {
        // First-Person Eye Camera (crisp, zero wall clip, direct sightline)
        const cosP = Math.cos(pitch);
        const sinP = Math.sin(pitch);
        camera.position.set(sim.x, eyeY, sim.z);
        tmpDesiredLook.set(
          sim.x + tmpForward.x * cosP * 24,
          eyeY + sinP * 24,
          sim.z + tmpForward.z * cosP * 24
        );
        camera.lookAt(tmpDesiredLook);
      } else {
        // Third-Person Tactical Over-the-Shoulder Camera
        const shoulderOffsetRight = controlsRef.current.aiming ? 0.56 : 0.68;
        const camBackDist = controlsRef.current.aiming ? 1.75 : 3.2;

        tmpShoulderPos.set(
          sim.x + tmpRight.x * shoulderOffsetRight,
          eyeY,
          sim.z + tmpRight.z * shoulderOffsetRight
        );

        const horizBack = Math.cos(pitch) * camBackDist;
        const vertOffset = -Math.sin(pitch) * camBackDist;
        tmpBackDir
          .set(-tmpForward.x * horizBack, vertOffset + 0.28, -tmpForward.z * horizBack)
          .normalize();
        const maxCamDist = raycastObstacles(tmpShoulderPos, tmpBackDir, camBackDist) - 0.25;
        const safeDist = Math.max(0.65, maxCamDist);

        tmpDesiredCam.copy(tmpShoulderPos).addScaledVector(tmpBackDir, safeDist);
        tmpDesiredCam.y = Math.max(0.45, tmpDesiredCam.y);

        tmpDesiredLook.set(
          tmpShoulderPos.x + tmpForward.x * 28,
          eyeY + Math.sin(pitch) * 28,
          tmpShoulderPos.z + tmpForward.z * 28
        );

        sim.camPos.lerp(tmpDesiredCam, 1 - Math.exp(-24 * dt));
        sim.camLook.lerp(tmpDesiredLook, 1 - Math.exp(-28 * dt));
        camera.position.copy(sim.camPos);
        camera.lookAt(sim.camLook);
      }

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

      // Throttled React HUD sync (~16Hz)
      if (now - lastHudSync > 60) {
        lastHudSync = now;
        const reloadPct = isReloading
          ? Math.min(
              100,
              Math.round((1 - (sim.reloadingUntil - now) / sim.reloadDurationMs) * 100)
            )
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
          zombieWave: currentWave,
          zombiesRemaining: zombies.length,
          zombieScore,
          elapsedSec: Math.floor((now - sim.startMs) / 1000),
          hurtFlash: now < sim.hurtFlashUntil,
        }));
      }

      afterDraw(tick);
    };

    afterDraw(tick);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timerId) window.clearTimeout(timerId);
      if (syncInterval) window.clearInterval(syncInterval);
      soundEngine.stopRain();
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock?.();
      }
      renderer.domElement.removeEventListener('pointerdown', onCanvasPointerDown);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('blur', resetStuckInputs);
      document.removeEventListener('visibilitychange', resetStuckInputs);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
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
    roomCode,
    mode,
    isHost,
    isPvp,
    isTraining,
    isZombieMode,
    primaryWeaponId,
    secondaryWeaponId,
    profile.playerId,
    profile.selectedCharacterId,
    selfCharacter.accentColor,
    selfCharacter.maxHp,
  ]);

  useEffect(() => {
    if (!hitBanner) return;
    const t = window.setTimeout(() => setHitBanner(null), 460);
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
    soundEngine.startRain();
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
    const sens = controlsRef.current.aiming ? 0.0036 : 0.0056;
    controlsRef.current.yaw -= dx * sens;
    controlsRef.current.pitch = THREE.MathUtils.clamp(
      controlsRef.current.pitch - dy * sens,
      -0.95,
      0.82
    );
  }

  function handleAimTouchEnd(e: React.PointerEvent<HTMLDivElement>): void {
    if (aimTouchRef.current.id === e.pointerId) {
      aimTouchRef.current.id = null;
    }
  }

  function submitFinishedResult(): void {
    if (isZombieMode && matchEndedState) {
      const userParticipant: MatchParticipantResult = {
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
        kills: matchEndedState.myKills,
        deaths: matchEndedState.myDeaths,
        score: matchEndedState.score,
        isUser: true,
      };
      onMatchFinishedRef.current({
        mode: 'zombie_survival',
        outcome: matchEndedState.victory ? 'victory' : 'defeat',
        kills: matchEndedState.myKills,
        deaths: matchEndedState.myDeaths,
        score: matchEndedState.score,
        durationSec: Math.max(10, hud.elapsedSec),
        participants: [userParticipant],
      });
      return;
    }

    if (!initialRoom || !opponentParticipant) {
      onExitToLobbyRef.current();
      return;
    }

    const endInfo = matchEndedState ?? {
      victory: hud.myKills >= hud.oppKills,
      myKills: hud.myKills,
      myDeaths: hud.myDeaths,
      oppKills: hud.oppKills,
      oppDeaths: hud.oppDeaths,
      score: hud.myKills * 220,
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

    onMatchFinishedRef.current({
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
    if (isPvp && roomCode && !matchEndedState) {
      await leaveBattleRoom(roomCode).catch(() => {});
    }
    onExitToLobbyRef.current();
  }

  const sniperScopeVisible = hud.aiming && isSniperActive && perspective === 'fps';

  return (
    <div className="fixed inset-0 bg-[#070b14] overflow-hidden select-none">
      {/* Three.js Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Hurt Red Vignette Overlay */}
      {hud.hurtFlash && (
        <div
          className="pointer-events-none fixed inset-0 z-10"
          style={{
            background:
              'radial-gradient(circle at center, transparent 45%, rgba(225, 29, 72, 0.45) 100%)',
          }}
        />
      )}

      {/* Sniper Scope Aperture Overlay (FPS + ADS with Sniper Rifle) */}
      {sniperScopeVisible && (
        <div
          className="pointer-events-none fixed inset-0 z-15 flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle at center, transparent 26%, rgba(4, 7, 14, 0.96) 27.5%)',
          }}
        >
          <div className="relative w-[52vmin] h-[52vmin] rounded-full border-2 border-sky-400/50">
            <div className="absolute inset-x-0 top-1/2 h-px bg-sky-300/75" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-sky-300/75" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-rose-500" />
          </div>
        </div>
      )}

      {/* Center Dynamic Tactical Crosshair */}
      {!sniperScopeVisible && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-20">
          <div
            className={`relative transition-transform duration-75 ${
              hud.aiming ? 'scale-75' : hud.crouched ? 'scale-90' : 'scale-100'
            }`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(255,122,47,0.95)]" />
            <div className="absolute left-1/2 -top-3.5 -translate-x-1/2 w-0.5 h-2.5 bg-white/85" />
            <div className="absolute left-1/2 -bottom-3.5 -translate-x-1/2 w-0.5 h-2.5 bg-white/85" />
            <div className="absolute top-1/2 -left-3.5 -translate-y-1/2 h-0.5 w-2.5 bg-white/85" />
            <div className="absolute top-1/2 -right-3.5 -translate-y-1/2 h-0.5 w-2.5 bg-white/85" />
          </div>

          {hitBanner && (
            <div className="absolute -translate-y-11 flex flex-col items-center">
              <span
                className={`font-display font-extrabold text-xl tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] ${
                  hitBanner.headshot ? 'text-amber-300' : 'text-white'
                }`}
              >
                {hitBanner.headshot ? `HEADSHOT -${hitBanner.damage}` : `-${hitBanner.damage}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Top HUD Bar (Solid dark clay pills, no backdrop-blur over WebGL) */}
      <div className="fixed top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          <button
            type="button"
            onClick={() => void handleExitButton()}
            className="clay-btn-secondary px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
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
            onClick={togglePerspective}
            title="Switch First-Person / Third-Person Camera (V)"
            className="clay-btn-secondary px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-sky-400" />
            <span>{perspective === 'fps' ? '1st Person (V)' : '3rd Person (V)'}</span>
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
            <span className="hidden sm:inline">{touchMode ? 'Touch: ON' : 'Touch'}</span>
          </button>
        </div>

        {/* Center Mode Score Pill */}
        {isTraining ? (
          <div className="rounded-2xl bg-[#101624]/95 border border-white/15 px-4 py-2 flex items-center gap-4 text-xs font-mono shadow-xl">
            <span className="text-orange-400 font-bold">NIGHT FIRING RANGE</span>
            <span className="text-slate-200 tabular-nums">Hits: {hud.rangeHits}</span>
            <span className="text-amber-300 tabular-nums">Headshots: {hud.rangeHeadshots}</span>
          </div>
        ) : isZombieMode ? (
          <div className="rounded-2xl bg-[#101624]/95 border border-rose-400/25 px-5 py-2 flex items-center gap-5 shadow-xl">
            <div className="flex items-center gap-2">
              <Skull className="w-4 h-4 text-rose-400" />
              <span className="font-display text-lg font-extrabold text-white">
                WAVE {hud.zombieWave} / {MAX_ZOMBIE_WAVES}
              </span>
            </div>
            <div className="text-xs font-mono text-amber-300 tabular-nums">
              Left: {hud.zombiesRemaining}
            </div>
            <div className="text-xs font-mono text-emerald-400 tabular-nums">
              Kills: {hud.myKills}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#101624]/95 border border-white/15 px-4 sm:px-6 py-2 flex items-center gap-4 sm:gap-6 shadow-xl">
            <div className="text-right">
              <p className="text-[11px] font-bold text-emerald-400 truncate max-w-[90px]">
                {profile.displayName}
              </p>
              <p className="font-display text-2xl font-extrabold text-white tabular-nums leading-none">
                {hud.myKills}
              </p>
            </div>
            <div className="text-center px-2 border-x border-white/10">
              <p className="text-[10px] font-mono text-slate-400">FIRST TO {maxKillsTarget}</p>
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

        {/* Optional Mouse Lock button (prevents surprise ESC banners unless requested) */}
        <div className="hidden md:flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={requestMouseLock}
            className={`px-3 py-2 rounded-2xl text-[11px] font-mono font-bold inline-flex items-center gap-1.5 cursor-pointer border ${
              hud.pointerLocked
                ? 'bg-emerald-600/90 text-white border-emerald-300/40'
                : 'clay-btn-secondary text-slate-200'
            }`}
            title="Toggle FPS Mouse Lock (L) · Dragging also aims freely"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>{hud.pointerLocked ? 'Mouse Locked (ESC)' : 'Lock Mouse (L)'}</span>
          </button>
        </div>
      </div>

      {/* Kill / Wave Banner */}
      {killNotice && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-30">
          <div className="rounded-2xl bg-orange-600 text-white font-display font-extrabold text-xl tracking-wider px-6 py-2 shadow-2xl border border-orange-300/40">
            {killNotice}
          </div>
        </div>
      )}

      {/* Respawn Overlay (PvP) */}
      {!hud.alive && !matchEndedState && !isZombieMode && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-rose-950/45">
          <div className="clay-card px-8 py-6 text-center">
            <p className="text-xs font-mono text-rose-300">ELIMINATED</p>
            <p className="font-display text-4xl font-extrabold text-white mt-1">
              Respawning in {hud.respawnSec}s
            </p>
          </div>
        </div>
      )}

      {/* Opponent HP Indicator (1v1 PvP) */}
      {isPvp && opponentParticipant && (
        <div className="pointer-events-none fixed top-20 right-4 z-20 hidden sm:block">
          <div className="rounded-2xl bg-[#101624]/92 border border-white/10 px-4 py-2.5 w-48 shadow-lg">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-rose-300 truncate">{opponentParticipant.displayName}</span>
              <span className="font-mono text-slate-300 tabular-nums">{hud.oppHp}</span>
            </div>
            <div className="h-2 rounded-full bg-[#070b14] overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all duration-100"
                style={{ width: `${Math.max(0, Math.min(100, (hud.oppHp / hud.oppMaxHp) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom HP & Gun Loadout Bar */}
      <div className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-end gap-3">
        <div className="pointer-events-auto rounded-2xl bg-[#101624]/95 border border-white/15 px-4 py-2.5 flex items-center gap-4 shadow-2xl">
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
            <div className="h-2.5 rounded-full bg-[#070b14] overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.hp > 50 ? 'bg-emerald-400' : hud.hp > 25 ? 'bg-amber-400' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100))}%` }}
              />
            </div>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <button
            type="button"
            onClick={() => selectWeaponSlot(activeSlot === 'primary' ? 'secondary' : 'primary')}
            className="text-left cursor-pointer"
            title="Switch Gun (1 / 2)"
          >
            <p className="text-[11px] font-bold text-orange-400 truncate max-w-[140px]">
              {activeWeapon.name} · <span className="text-slate-400">{activeSlot === 'primary' ? '[1]' : '[2]'}</span>
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
              <div className="h-1.5 w-24 rounded-full bg-[#070b14] mt-1 overflow-hidden">
                <div
                  className="h-full bg-orange-400 transition-all duration-75"
                  style={{ width: `${hud.reloadProgress}%` }}
                />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Desktop Controls Hint */}
      {!touchMode && !matchEndedState && (
        <div className="pointer-events-none fixed bottom-3 left-4 z-20 hidden lg:block text-[11px] font-mono text-slate-400 bg-[#101624]/90 border border-white/10 rounded-xl px-3 py-1.5">
          WASD Move · Drag or L Aim · Left Click Fire · Right Click/Q Scope · C Crouch · R Reload · V Camera · 1/2 Gun
        </div>
      )}

      {/* Mobile / Touch Controls Overlay */}
      {touchMode && !matchEndedState && (
        <>
          <div
            onPointerDown={handleAimTouchStart}
            onPointerMove={handleAimTouchMove}
            onPointerUp={handleAimTouchEnd}
            onPointerCancel={handleAimTouchEnd}
            className="fixed inset-y-16 right-0 w-1/2 z-20"
            style={{ touchAction: 'none' }}
          />

          <div
            ref={joyContainerRef}
            onPointerDown={(e) => {
              soundEngine.unlock();
              soundEngine.startRain();
              e.currentTarget.setPointerCapture(e.pointerId);
              handleJoyPointer(e, true);
            }}
            onPointerMove={(e) => {
              if (joyKnob.active) handleJoyPointer(e, true);
            }}
            onPointerUp={(e) => handleJoyPointer(e, false)}
            onPointerCancel={(e) => handleJoyPointer(e, false)}
            className="fixed bottom-16 left-5 z-30 w-32 h-32 rounded-full bg-[#101624]/85 border-2 border-white/20 flex items-center justify-center shadow-2xl"
            style={{ touchAction: 'none' }}
          >
            <div
              className="w-12 h-12 rounded-full bg-orange-500 border-2 border-orange-200/70 shadow-lg"
              style={{
                transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
              }}
            />
          </div>

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
                    : 'bg-[#182135]/90 text-white border-white/25'
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
                    : 'bg-[#182135]/90 text-white border-white/25'
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
                className="w-13 h-13 rounded-full bg-[#182135]/90 text-white border-2 border-white/25 font-bold text-[11px] flex flex-col items-center justify-center shadow-lg"
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
                className="w-13 h-13 rounded-full bg-[#182135]/90 text-white border-2 border-white/25 font-bold text-[11px] flex items-center justify-center shadow-lg"
              >
                JUMP
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  soundEngine.unlock();
                  soundEngine.startRain();
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
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
          <div className="clay-card max-w-md w-full p-7 text-center space-y-5">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
                matchEndedState.victory
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {isZombieMode && !matchEndedState.victory ? (
                <Skull className="w-8 h-8" />
              ) : (
                <Trophy className="w-8 h-8" />
              )}
            </div>
            <div>
              <p className="text-xs font-mono text-orange-400">
                {isZombieMode
                  ? `ZOMBIE OUTBREAK · WAVE ${matchEndedState.waveReached ?? 1}`
                  : '1v1 ARENA COMPLETE'}
              </p>
              <h2 className="font-display text-4xl font-extrabold text-white mt-1">
                {matchEndedState.victory ? 'VICTORY!' : isZombieMode ? 'OVERRUN!' : 'DEFEAT'}
              </h2>
            </div>

            {isZombieMode ? (
              <div className="clay-inset p-4 grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-400">Zombies Slain</p>
                  <p className="font-display text-3xl font-extrabold text-emerald-400 tabular-nums">
                    {matchEndedState.myKills}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Combat Score</p>
                  <p className="font-display text-3xl font-extrabold text-amber-400 tabular-nums">
                    {matchEndedState.score}
                  </p>
                </div>
              </div>
            ) : (
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
            )}

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
