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

export const ARENA_RADIUS = 27;

export const ARENA_OBSTACLES: ArenaObstacleBox[] = [
  // Central waist-high tactical cover barriers (stand to shoot over, crouch for full cover!)
  { id: 'mid_w', label: 'Mid West Barrier', minX: -5.2, maxX: -1.8, minY: 0, maxY: 1.12, minZ: -0.7, maxZ: 0.7 },
  { id: 'mid_e', label: 'Mid East Barrier', minX: 1.8, maxX: 5.2, minY: 0, maxY: 1.12, minZ: -0.7, maxZ: 0.7 },
  { id: 'mid_pillar', label: 'Center Pillar', minX: -1.1, maxX: 1.1, minY: 0, maxY: 2.35, minZ: -1.1, maxZ: 1.1 },

  // Symmetrical shipping containers (tall flank cover)
  { id: 'cont_nw', label: 'West Container', minX: -14.5, maxX: -11.4, minY: 0, maxY: 2.75, minZ: -8.5, maxZ: -1.5 },
  { id: 'cont_se', label: 'East Container', minX: 11.4, maxX: 14.5, minY: 0, maxY: 2.75, minZ: 1.5, maxZ: 8.5 },

  // Spawn lane low cover barriers (protects spawns while enabling peek angles)
  { id: 'spawn_n', label: 'North Spawn Barrier', minX: -4.2, maxX: 1.2, minY: 0, maxY: 1.15, minZ: -14.6, maxZ: -13.4 },
  { id: 'spawn_s', label: 'South Spawn Barrier', minX: -1.2, maxX: 4.2, minY: 0, maxY: 1.15, minZ: 13.4, maxZ: 14.6 },

  // Side crate stacks
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
): RangeTargetEntity[] {
  // Warm Tactical Daylight / Golden-Hour Sky & Fog
  const skyColor = new THREE.Color(0x88aac8);
  scene.background = skyColor;
  scene.fog = new THREE.FogExp2(0x88aac8, 0.0115);

  const hemi = new THREE.HemisphereLight(0xcbe6ff, 0x3b362e, 0.95);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.15);
  sun.position.set(24, 38, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 110;
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34;
  sun.shadow.camera.bottom = -34;
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  // Asphalt courtyard floor
  const floorTex = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#3c434f';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4500; i++) {
        const x = (i * 73) % w;
        const y = (i * 197) % h;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(x, y, 3, 3);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    },
    14,
    14,
    maxAnisotropy
  );

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_RADIUS * 2, ARENA_RADIUS * 2),
    new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.9,
      metalness: 0.05,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Extended surrounding desert/industrial ground skirt
  const outerGround = new THREE.Mesh(
    new THREE.RingGeometry(ARENA_RADIUS * 1.35, 220, 48),
    new THREE.MeshStandardMaterial({ color: 0x5c5347, roughness: 0.95 })
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.04;
  scene.add(outerGround);

  // Center lane tactical painted stripes
  const laneMarkMat = new THREE.MeshBasicMaterial({ color: 0xd97706, transparent: true, opacity: 0.45 });
  const centerCircle = new THREE.Mesh(new THREE.RingGeometry(4.8, 5.05, 48), laneMarkMat);
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.y = 0.01;
  scene.add(centerCircle);

  // Textures for cover
  const concreteTex = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#737a84';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect((i * 59) % w, (i * 113) % h, 4, 4);
      }
      ctx.fillStyle = '#e07b24';
      ctx.fillRect(0, 0, w, 28);
      ctx.fillStyle = '#202632';
      for (let x = 0; x < w; x += 48) {
        ctx.fillRect(x, 0, 24, 28);
      }
    },
    1,
    1,
    maxAnisotropy
  );

  const containerTexRed = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#99382a';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 28) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x, 0, 10, h);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 12, 0, 4, h);
      }
    },
    2,
    1,
    maxAnisotropy
  );

  const containerTexBlue = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#28527a';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 28) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x, 0, 10, h);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 12, 0, 4, h);
      }
    },
    2,
    1,
    maxAnisotropy
  );

  const crateTex = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#8b6a44';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#4e3922';
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
      mat = new THREE.MeshStandardMaterial({ map: containerTexRed, roughness: 0.55, metalness: 0.45 });
    } else if (box.id.startsWith('cont_se')) {
      mat = new THREE.MeshStandardMaterial({ map: containerTexBlue, roughness: 0.55, metalness: 0.45 });
    } else if (box.id.startsWith('crate')) {
      mat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85, metalness: 0.05 });
    } else {
      mat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.82, metalness: 0.1 });
    }

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Compound perimeter walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4b5362, roughness: 0.85 });
  const wallThickness = 1.4;
  const wallHeight = 4.4;
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

  // Distant skyline silhouette blocks for depth outside arena walls
  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x3b4454, roughness: 0.9 });
  [
    [-48, 12, -52, 14, 24, 14],
    [52, 16, -46, 18, 32, 16],
    [-54, 9, 44, 16, 18, 16],
    [48, 14, 54, 15, 28, 15],
    [0, 11, -64, 24, 22, 12],
  ].forEach(([x, y, z, w, h, d]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skylineMat);
    b.position.set(x, y, z);
    scene.add(b);
  });

  // Range targets (only spawned in Tactical Firing Range mode)
  const targets: RangeTargetEntity[] = [];
  if (trainingRange) {
    const standMat = new THREE.MeshStandardMaterial({ color: 0x222834, metalness: 0.7, roughness: 0.4 });
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4, metalness: 0.3 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.3 });

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
      targets.push({
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

  return targets;
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
        // Inside AABB fallback push out nearest edge
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
