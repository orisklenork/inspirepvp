import * as THREE from 'three';

export interface ArenaObstacleBox {
  id: string;
  label: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface RangeTargetEntity {
  id: string;
  group: THREE.Group;
  headMesh: THREE.Mesh;
  bodyMesh: THREE.Mesh;
  baseX: number;
  baseZ: number;
  moving: boolean;
  phase: number;
  hp: number;
  maxHp: number;
  downUntilMs: number;
}

export interface RainSystem {
  lines: THREE.LineSegments;
  positions: Float32Array;
  speeds: Float32Array;
  count: number;
  ambientLight: THREE.HemisphereLight;
  moonLight: THREE.DirectionalLight;
  baseSkyColor: THREE.Color;
  flashStrength: number;
  nextLightningAt: number;
}

export const ARENA_RADIUS = 27;

export const ARENA_OBSTACLES: ArenaObstacleBox[] = [
  { id: 'mid_w', label: 'Mid West Barrier', minX: -5.2, maxX: -1.8, minY: 0, maxY: 1.12, minZ: -0.7, maxZ: 0.7 },
  { id: 'mid_e', label: 'Mid East Barrier', minX: 1.8, maxX: 5.2, minY: 0, maxY: 1.12, minZ: -0.7, maxZ: 0.7 },
  { id: 'mid_pillar', label: 'Center Pillar', minX: -1.1, maxX: 1.1, minY: 0, maxY: 2.35, minZ: -1.1, maxZ: 1.1 },

  { id: 'cont_nw', label: 'West Container', minX: -14.5, maxX: -11.4, minY: 0, maxY: 2.75, minZ: -8.5, maxZ: -1.5 },
  { id: 'cont_se', label: 'East Container', minX: 11.4, maxX: 14.5, minY: 0, maxY: 2.75, minZ: 1.5, maxZ: 8.5 },

  { id: 'spawn_n', label: 'North Spawn Barrier', minX: -4.2, maxX: 1.2, minY: 0, maxY: 1.15, minZ: -14.6, maxZ: -13.4 },
  { id: 'spawn_s', label: 'South Spawn Barrier', minX: -1.2, maxX: 4.2, minY: 0, maxY: 1.15, minZ: 13.4, maxZ: 14.6 },

  { id: 'crate_ne', label: 'NE Crate Stack', minX: 7.2, maxX: 9.8, minY: 0, maxY: 1.65, minZ: -10.8, maxZ: -8.2 },
  { id: 'crate_sw', label: 'SW Crate Stack', minX: -9.8, maxX: -7.2, minY: 0, maxY: 1.65, minZ: 8.2, maxZ: 10.8 },
  { id: 'crate_w_low', label: 'West Crate', minX: -18.5, maxX: -16.2, minY: 0, maxY: 1.3, minZ: 3.5, maxZ: 5.8 },
  { id: 'crate_e_low', label: 'East Crate', minX: 16.2, maxX: 18.5, minY: 0, maxY: 1.3, minZ: -5.8, maxZ: -3.5 },
];

function createCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, 512, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(4, maxAnisotropy);
  return tex;
}

export function buildArenaEnvironment(
  scene: THREE.Scene,
  maxAnisotropy: number,
  trainingRange: boolean
): { rangeTargets: RangeTargetEntity[]; rain: RainSystem } {
  // Atmospheric Stormy Night Sky & Horizon Fog
  const baseSkyColor = new THREE.Color(0x070b14);
  scene.background = baseSkyColor.clone();
  scene.fog = new THREE.FogExp2(0x080d18, 0.0185);

  // Cool night sky / dark ground fill
  const ambientLight = new THREE.HemisphereLight(0x3a527a, 0x0b0e16, 0.85);
  scene.add(ambientLight);

  // Cool Moonlight directional key light with crisp shadows
  const moonLight = new THREE.DirectionalLight(0xa3c4f3, 1.55);
  moonLight.position.set(22, 36, 18);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.near = 4;
  moonLight.shadow.camera.far = 100;
  moonLight.shadow.camera.left = -32;
  moonLight.shadow.camera.right = 32;
  moonLight.shadow.camera.top = 32;
  moonLight.shadow.camera.bottom = -32;
  moonLight.shadow.bias = -0.0007;
  scene.add(moonLight);

  // Warm tungsten compound floodlights in opposing corners for rich cinematic contrast
  const floodPositions: [number, number, number][] = [
    [-22, 9.5, -22],
    [22, 9.5, 22],
  ];
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x1e2530, metalness: 0.7, roughness: 0.45 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  floodPositions.forEach(([fx, fy, fz]) => {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, fy, 8), mastMat);
    mast.position.set(fx, fy * 0.5, fz);
    scene.add(mast);

    const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 0.55), lampGlowMat);
    head.position.set(fx, fy, fz);
    head.lookAt(0, 0, 0);
    scene.add(head);

    const pt = new THREE.PointLight(0xffa94d, 26, 36, 1.6);
    pt.position.set(fx * 0.92, fy - 0.5, fz * 0.92);
    scene.add(pt);
  });

  // Rain-slick wet dark asphalt courtyard
  const floorTex = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#151922';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4200; i++) {
        const x = (i * 79) % w;
        const y = (i * 193) % h;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(120,160,210,0.045)' : 'rgba(0,0,0,0.12)';
        ctx.fillRect(x, y, 4, 4);
      }
      // Wet puddle patches
      ctx.fillStyle = 'rgba(20, 32, 52, 0.35)';
      ctx.beginPath();
      ctx.ellipse(160, 210, 85, 52, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(380, 360, 95, 60, -0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    },
    12,
    12,
    maxAnisotropy
  );

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_RADIUS * 2, ARENA_RADIUS * 2),
    new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.32,
      metalness: 0.28,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Extended surrounding dark wasteland ground
  const outerGround = new THREE.Mesh(
    new THREE.RingGeometry(ARENA_RADIUS * 1.32, 240, 48),
    new THREE.MeshStandardMaterial({ color: 0x0c1018, roughness: 0.92 })
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.04;
  scene.add(outerGround);

  // Glowing center tactical zone ring
  const laneMarkMat = new THREE.MeshBasicMaterial({ color: 0xff7a2f, transparent: true, opacity: 0.42 });
  const centerCircle = new THREE.Mesh(new THREE.RingGeometry(4.8, 5.05, 48), laneMarkMat);
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.y = 0.012;
  scene.add(centerCircle);

  // Concrete hazard Jersey barriers
  const concreteTex = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#333b48';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2000; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.10)';
        ctx.fillRect((i * 59) % w, (i * 113) % h, 4, 4);
      }
      ctx.fillStyle = '#ea6a1f';
      ctx.fillRect(0, 0, w, 26);
      ctx.fillStyle = '#12161f';
      for (let x = 0; x < w; x += 48) {
        ctx.fillRect(x, 0, 24, 26);
      }
    },
    1,
    1,
    maxAnisotropy
  );

  const containerTexRed = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#63221b';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 28) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x, 0, 10, h);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + 12, 0, 4, h);
      }
    },
    2,
    1,
    maxAnisotropy
  );

  const containerTexBlue = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#1b3552';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 28) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x, 0, 10, h);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + 12, 0, 4, h);
      }
    },
    2,
    1,
    maxAnisotropy
  );

  const crateTex = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#473623';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#241a10';
      ctx.lineWidth = 22;
      ctx.strokeRect(11, 11, w - 22, h - 22);
      ctx.beginPath();
      ctx.moveTo(20, 20);
      ctx.lineTo(w - 20, h - 20);
      ctx.stroke();
    },
    1,
    1,
    maxAnisotropy
  );

  for (const box of ARENA_OBSTACLES) {
    const sx = box.maxX - box.minX;
    const sy = box.maxY - box.minY;
    const sz = box.maxZ - box.minZ;
    const cx = (box.minX + box.maxX) * 0.5;
    const cy = (box.minY + box.maxY) * 0.5;
    const cz = (box.minZ + box.maxZ) * 0.5;

    let mat: THREE.MeshStandardMaterial;
    if (box.id.startsWith('cont_nw')) {
      mat = new THREE.MeshStandardMaterial({ map: containerTexRed, roughness: 0.36, metalness: 0.55 });
    } else if (box.id.startsWith('cont_se')) {
      mat = new THREE.MeshStandardMaterial({ map: containerTexBlue, roughness: 0.36, metalness: 0.55 });
    } else if (box.id.startsWith('crate')) {
      mat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.72, metalness: 0.08 });
    } else {
      mat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.62, metalness: 0.15 });
    }

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Perimeter security wall with glowing warning strip
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.75, metalness: 0.25 });
  const wallThickness = 1.4;
  const wallHeight = 4.2;
  const wallSpan = ARENA_RADIUS * 2 + wallThickness;

  [
    { x: 0, z: -ARENA_RADIUS - 0.5, w: wallSpan, d: wallThickness },
    { x: 0, z: ARENA_RADIUS + 0.5, w: wallSpan, d: wallThickness },
    { x: -ARENA_RADIUS - 0.5, z: 0, w: wallThickness, d: wallSpan },
    { x: ARENA_RADIUS + 0.5, z: 0, w: wallThickness, d: wallSpan },
  ].forEach((w) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w.w, wallHeight, w.d), wallMat);
    wall.position.set(w.x, wallHeight * 0.5, w.z);
    wall.receiveShadow = true;
    scene.add(wall);
  });

  // Distant Night Skyline with lit city window grids (atmospheric depth)
  const buildingTex = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#0c111c';
      ctx.fillRect(0, 0, w, h);
      for (let y = 24; y < h - 24; y += 26) {
        for (let x = 20; x < w - 20; x += 28) {
          if (((x * 13 + y * 29) % 7) < 2) {
            ctx.fillStyle = (x + y) % 5 === 0 ? '#ff9f43' : '#38bdf8';
            ctx.fillRect(x, y, 12, 10);
          }
        }
      }
    },
    1,
    2,
    maxAnisotropy
  );
  const skylineMat = new THREE.MeshStandardMaterial({
    map: buildingTex,
    emissive: 0x162238,
    emissiveMap: buildingTex,
    emissiveIntensity: 0.65,
    roughness: 0.85,
  });
  [
    [-52, 18, -56, 16, 36, 16],
    [54, 22, -52, 18, 44, 18],
    [-56, 14, 48, 16, 28, 16],
    [52, 19, 56, 16, 38, 16],
    [0, 16, -68, 26, 32, 14],
    [-28, 13, 66, 20, 26, 14],
  ].forEach(([x, y, z, w, h, d]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skylineMat);
    b.position.set(x, y, z);
    scene.add(b);
  });

  // Tactical 3D Firing Range Targets
  const rangeTargets: RangeTargetEntity[] = [];
  if (trainingRange) {
    const standMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, metalness: 0.7, roughness: 0.4 });
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0xff6b2b,
      emissive: 0x6b2000,
      emissiveIntensity: 0.4,
      roughness: 0.35,
      metalness: 0.3,
    });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0x6b5500,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.3,
    });

    const targetConfigs = [
      { id: 't1', x: -6, z: -12, moving: false },
      { id: 't2', x: 0, z: -16, moving: true },
      { id: 't3', x: 6, z: -12, moving: false },
      { id: 't4', x: -10, z: -20, moving: true },
      { id: 't5', x: 10, z: -20, moving: true },
    ];

    targetConfigs.forEach((cfg, idx) => {
      const g = new THREE.Group();
      g.position.set(cfg.x, 0, cfg.z);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), standMat);
      post.position.y = 0.45;
      g.add(post);

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.10), plateMat.clone());
      body.position.y = 1.25;
      body.castShadow = true;
      g.add(body);

      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.10, 14), headMat.clone());
      head.rotation.x = Math.PI / 2;
      head.position.y = 1.80;
      head.castShadow = true;
      g.add(head);

      scene.add(g);
      rangeTargets.push({
        id: cfg.id,
        group: g,
        headMesh: head,
        bodyMesh: body,
        baseX: cfg.x,
        baseZ: cfg.z,
        moving: cfg.moving,
        phase: idx * 1.4,
        hp: 100,
        maxHp: 100,
        downUntilMs: 0,
      });
    });
  }

  // Falling 3D Rain Streaks System (Single draw call!)
  const rainCount = 1200;
  const positions = new Float32Array(rainCount * 2 * 3);
  const speeds = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    const rx = (Math.random() - 0.5) * 38;
    const ry = Math.random() * 18;
    const rz = (Math.random() - 0.5) * 38;
    speeds[i] = 17 + Math.random() * 8;
    const idx = i * 6;
    positions[idx] = rx;
    positions[idx + 1] = ry;
    positions[idx + 2] = rz;
    positions[idx + 3] = rx - 0.08;
    positions[idx + 4] = ry - 0.65;
    positions[idx + 5] = rz - 0.05;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0x9ec5ff,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  scene.add(rainLines);

  return {
    rangeTargets,
    rain: {
      lines: rainLines,
      positions,
      speeds,
      count: rainCount,
      ambientLight,
      moonLight,
      baseSkyColor,
      flashStrength: 0,
      nextLightningAt: performance.now() + 9000,
    },
  };
}

export function updateRainSystem(
  scene: THREE.Scene,
  rain: RainSystem,
  centerX: number,
  centerZ: number,
  dt: number,
  nowMs: number,
  onLightning?: () => void
): void {
  const pos = rain.positions;
  const n = rain.count;
  const span = 38;
  const half = span * 0.5;

  for (let i = 0; i < n; i++) {
    const idx = i * 6;
    const fall = rain.speeds[i] * dt;
    pos[idx + 1] -= fall;
    pos[idx + 4] -= fall;
    pos[idx] -= 1.4 * dt;
    pos[idx + 3] -= 1.4 * dt;

    if (pos[idx + 1] < 0) {
      const rx = centerX + (Math.random() - 0.5) * span;
      const rz = centerZ + (Math.random() - 0.5) * span;
      const ry = 14 + Math.random() * 6;
      pos[idx] = rx;
      pos[idx + 1] = ry;
      pos[idx + 2] = rz;
      pos[idx + 3] = rx - 0.08;
      pos[idx + 4] = ry - 0.65;
      pos[idx + 5] = rz - 0.05;
    } else {
      // Keep rain bubble centered around moving player
      if (pos[idx] < centerX - half) {
        pos[idx] += span;
        pos[idx + 3] += span;
      } else if (pos[idx] > centerX + half) {
        pos[idx] -= span;
        pos[idx + 3] -= span;
      }
      if (pos[idx + 2] < centerZ - half) {
        pos[idx + 2] += span;
        pos[idx + 5] += span;
      } else if (pos[idx + 2] > centerZ + half) {
        pos[idx + 2] -= span;
        pos[idx + 5] -= span;
      }
    }
  }
  (rain.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

  // Periodic subtle lightning storm flash
  if (nowMs >= rain.nextLightningAt) {
    rain.flashStrength = 1.0;
    rain.nextLightningAt = nowMs + 13000 + Math.random() * 14000;
    onLightning?.();
  }
  if (rain.flashStrength > 0.01) {
    rain.flashStrength = THREE.MathUtils.damp(rain.flashStrength, 0, 9, dt);
    rain.moonLight.intensity = 1.55 + rain.flashStrength * 3.8;
    rain.ambientLight.intensity = 0.85 + rain.flashStrength * 1.4;
    if (scene.background instanceof THREE.Color) {
      scene.background.setRGB(
        0.027 + rain.flashStrength * 0.22,
        0.043 + rain.flashStrength * 0.28,
        0.078 + rain.flashStrength * 0.36
      );
    }
  } else {
    rain.moonLight.intensity = 1.55;
    rain.ambientLight.intensity = 0.85;
  }
}

export function resolvePlayerObstacleCollision(
  x: number,
  z: number,
  radius: number
): { x: number; z: number } {
  let nx = THREE.MathUtils.clamp(x, -(ARENA_RADIUS - 1.0), ARENA_RADIUS - 1.0);
  let nz = THREE.MathUtils.clamp(z, -(ARENA_RADIUS - 1.0), ARENA_RADIUS - 1.0);

  for (const b of ARENA_OBSTACLES) {
    const closestX = THREE.MathUtils.clamp(nx, b.minX, b.maxX);
    const closestZ = THREE.MathUtils.clamp(nz, b.minZ, b.maxZ);
    const dx = nx - closestX;
    const dz = nz - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const push = radius - dist;
        nx += (dx / dist) * push;
        nz += (dz / dist) * push;
      } else {
        const dLeft = Math.abs(nx - b.minX);
        const dRight = Math.abs(b.maxX - nx);
        const dTop = Math.abs(nz - b.minZ);
        const dBot = Math.abs(b.maxZ - nz);
        const minEdge = Math.min(dLeft, dRight, dTop, dBot);
        if (minEdge === dLeft) nx = b.minX - radius;
        else if (minEdge === dRight) nx = b.maxX + radius;
        else if (minEdge === dTop) nz = b.minZ - radius;
        else nz = b.maxZ + radius;
      }
    }
  }
  return { x: nx, z: nz };
}

export function raycastObstacles(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist: number
): number {
  let closest = maxDist;
  const invX = Math.abs(dir.x) > 1e-6 ? 1 / dir.x : 1e9;
  const invY = Math.abs(dir.y) > 1e-6 ? 1 / dir.y : 1e9;
  const invZ = Math.abs(dir.z) > 1e-6 ? 1 / dir.z : 1e9;

  for (const b of ARENA_OBSTACLES) {
    const t1 = (b.minX - origin.x) * invX;
    const t2 = (b.maxX - origin.x) * invX;
    const t3 = (b.minY - origin.y) * invY;
    const t4 = (b.maxY - origin.y) * invY;
    const t5 = (b.minZ - origin.z) * invZ;
    const t6 = (b.maxZ - origin.z) * invZ;

    const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
    const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));
    if (tmax >= 0 && tmin <= tmax && tmin >= 0 && tmin < closest) {
      closest = tmin;
    }
  }
  return closest;
}
