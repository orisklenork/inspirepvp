import * as THREE from 'three';

export interface WeaponAssembly {
  group: THREE.Group;
  muzzleAnchor: THREE.Object3D;
  magazineMesh: THREE.Mesh;
  magazineBaseY: number;
}

export interface OperativeRig {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightLeg: THREE.Group;
  rightKnee: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  weaponPivot: THREE.Group;
  weaponAssembly: WeaponAssembly;
  visorMat: THREE.MeshStandardMaterial;
  armorMat: THREE.MeshStandardMaterial;
  contactShadow: THREE.Mesh;
  walkPhase: number;
  crouchBlend: number;
  aimBlend: number;
  recoilOffset: number;
  weaponId: string;
}

export interface FirstPersonRig {
  root: THREE.Group;
  weaponHolder: THREE.Group;
  leftArmMesh: THREE.Group;
  rightArmMesh: THREE.Group;
  weaponAssembly: WeaponAssembly;
  weaponId: string;
  recoil: number;
  swayX: number;
  swayY: number;
  bobPhase: number;
  aimBlend: number;
  reloadBlend: number;
}

export interface ZombieRig {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  walkPhase: number;
  variant: 'shambler' | 'sprinter' | 'brute';
}

function getGunMaterials() {
  return {
    steel: new THREE.MeshStandardMaterial({
      color: 0x2c3442,
      metalness: 0.88,
      roughness: 0.24,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xb8c2cf,
      metalness: 0.94,
      roughness: 0.16,
    }),
    darkMetal: new THREE.MeshStandardMaterial({
      color: 0x141820,
      metalness: 0.78,
      roughness: 0.38,
    }),
    polymer: new THREE.MeshStandardMaterial({
      color: 0x1b2029,
      metalness: 0.18,
      roughness: 0.70,
    }),
    oliveStock: new THREE.MeshStandardMaterial({
      color: 0x2d4233,
      metalness: 0.12,
      roughness: 0.68,
    }),
    wood: new THREE.MeshStandardMaterial({
      color: 0x5c341d,
      metalness: 0.05,
      roughness: 0.65,
    }),
    tanPolymer: new THREE.MeshStandardMaterial({
      color: 0x584d3d,
      metalness: 0.12,
      roughness: 0.74,
    }),
    accentMetal: new THREE.MeshStandardMaterial({
      color: 0xe67e22,
      metalness: 0.82,
      roughness: 0.24,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xd4a438,
      metalness: 0.9,
      roughness: 0.2,
    }),
    opticGlow: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.25,
      metalness: 0.4,
      roughness: 0.15,
    }),
    redDot: new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      emissive: 0xff2d20,
      emissiveIntensity: 1.6,
    }),
  };
}

export function createWeaponMesh(weaponId: string): WeaponAssembly {
  const m = getGunMaterials();
  const group = new THREE.Group();
  const muzzleAnchor = new THREE.Object3D();
  let magazineMesh: THREE.Mesh;
  let magazineBaseY = -0.07;

  if (weaponId === 'tactical_sidearm') {
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.12, 0.048), m.polymer);
    grip.position.set(0, -0.06, -0.03);
    grip.rotation.x = 0.22;
    group.add(grip);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.03, 0.20), m.polymer);
    frame.position.set(0, 0.005, 0.05);
    group.add(frame);

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.042, 0.22), m.steel);
    slide.position.set(0, 0.038, 0.045);
    group.add(slide);

    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 12), m.darkMetal);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.038, 0.22);
    group.add(suppressor);

    magazineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.09, 0.036), m.darkMetal);
    magazineBaseY = -0.08;
    magazineMesh.position.set(0, magazineBaseY, -0.035);
    magazineMesh.rotation.x = 0.22;
    group.add(magazineMesh);

    muzzleAnchor.position.set(0, 0.038, 0.29);
  } else if (weaponId === 'desert_hawk') {
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.13, 0.054), m.polymer);
    grip.position.set(0, -0.065, -0.04);
    grip.rotation.x = 0.24;
    group.add(grip);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.034, 0.24), m.chrome);
    frame.position.set(0, 0.008, 0.07);
    group.add(frame);

    const heavySlide = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.052, 0.27), m.chrome);
    heavySlide.position.set(0, 0.046, 0.085);
    group.add(heavySlide);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.014, 0.18), m.darkMetal);
    rail.position.set(0, 0.075, 0.12);
    group.add(rail);

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.048, 0.04), m.darkMetal);
    muzzle.position.set(0, 0.045, 0.23);
    group.add(muzzle);

    magazineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.10, 0.042), m.steel);
    magazineBaseY = -0.085;
    magazineMesh.position.set(0, magazineBaseY, -0.04);
    magazineMesh.rotation.x = 0.24;
    group.add(magazineMesh);

    muzzleAnchor.position.set(0, 0.046, 0.26);
  } else if (weaponId === 'phantom_ak') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.095, 0.24), m.wood);
    stock.position.set(0, -0.015, -0.20);
    stock.rotation.x = 0.12;
    group.add(stock);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.085, 0.26), m.darkMetal);
    receiver.position.set(0, 0.024, 0.05);
    group.add(receiver);

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.068, 0.22), m.wood);
    handguard.position.set(0, 0.022, 0.28);
    group.add(handguard);

    const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 10), m.steel);
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, 0.062, 0.28);
    group.add(gasTube);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.28, 10), m.darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.032, 0.50);
    group.add(barrel);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.11, 0.046), m.polymer);
    grip.position.set(0, -0.055, -0.04);
    grip.rotation.x = 0.26;
    group.add(grip);

    // Signature curved AK mag (two angled segments)
    magazineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.17, 0.064), m.steel);
    magazineBaseY = -0.085;
    magazineMesh.position.set(0, magazineBaseY, 0.12);
    magazineMesh.rotation.x = 0.26;
    group.add(magazineMesh);

    muzzleAnchor.position.set(0, 0.032, 0.65);
  } else if (weaponId === 'scatter_cannon') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.095, 0.25), m.polymer);
    stock.position.set(0, -0.015, -0.18);
    stock.rotation.x = 0.08;
    group.add(stock);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.08, 0.24), m.darkMetal);
    receiver.position.set(0, 0.02, 0.04);
    group.add(receiver);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.48, 12), m.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.046, 0.36);
    group.add(barrel);

    const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 10), m.darkMetal);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, 0.012, 0.33);
    group.add(magTube);

    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.17, 10), m.tanPolymer);
    pump.rotation.x = Math.PI / 2;
    pump.position.set(0, 0.012, 0.31);
    group.add(pump);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.11, 0.05), m.polymer);
    grip.position.set(0, -0.05, -0.04);
    grip.rotation.x = 0.28;
    group.add(grip);

    magazineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.055, 0.14), m.accentMetal);
    magazineBaseY = 0.022;
    magazineMesh.position.set(0.033, magazineBaseY, 0.04);
    group.add(magazineMesh);

    muzzleAnchor.position.set(0, 0.046, 0.61);
  } else if (weaponId === 'rail_carbine') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.10, 0.28), m.darkMetal);
    stock.position.set(0, 0.0, -0.22);
    group.add(stock);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.085, 0.32), m.steel);
    receiver.position.set(0, 0.025, 0.05);
    group.add(receiver);

    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.064, 0.30), m.darkMetal);
    shroud.position.set(0, 0.032, 0.34);
    group.add(shroud);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.42, 12), m.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.036, 0.62);
    group.add(barrel);

    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 12), m.darkMetal);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.095, 0.11);
    group.add(scopeTube);

    const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.019, 12), m.opticGlow);
    scopeLens.position.set(0, 0.095, 0.252);
    group.add(scopeLens);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.11, 0.048), m.polymer);
    grip.position.set(0, -0.055, -0.04);
    grip.rotation.x = 0.26;
    group.add(grip);

    magazineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.11, 0.075), m.darkMetal);
    magazineBaseY = -0.055;
    magazineMesh.position.set(0, magazineBaseY, 0.10);
    group.add(magazineMesh);

    muzzleAnchor.position.set(0, 0.036, 0.84);
  } else if (weaponId === 'awp_viper') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.11, 0.32), m.oliveStock);
    stock.position.set(0, -0.005, -0.22);
    group.add(stock);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.078, 0.42), m.oliveStock);
    chassis.position.set(0, 0.018, 0.12);
    group.add(chassis);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.62, 12), m.darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.042, 0.58);
    group.add(barrel);

    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.032, 0.075), m.steel);
    brake.position.set(0, 0.042, 0.90);
    group.add(brake);

    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 12), m.darkMetal);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.102, 0.12);
    group.add(scope);

    const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), m.opticGlow);
    scopeLens.position.set(0, 0.102, 0.292);
    group.add(scopeLens);

    magazineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.095, 0.08), m.darkMetal);
    magazineBaseY = -0.045;
    magazineMesh.position.set(0, magazineBaseY, 0.12);
    group.add(magazineMesh);

    muzzleAnchor.position.set(0, 0.042, 0.94);
  } else if (weaponId === 'titan_lmg') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.24), m.polymer);
    stock.position.set(0, 0.005, -0.20);
    group.add(stock);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.105, 0.34), m.darkMetal);
    receiver.position.set(0, 0.032, 0.06);
    group.add(receiver);

    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.078, 0.32), m.steel);
    shroud.position.set(0, 0.04, 0.36);
    group.add(shroud);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.016, 0.32, 10), m.darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.042, 0.62);
    group.add(barrel);

    // Carry handle
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.18), m.tanPolymer);
    handle.position.set(0, 0.115, 0.12);
    group.add(handle);

    // Belt feed brass strip
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.022, 0.09), m.brass);
    belt.position.set(-0.055, 0.02, 0.10);
    group.add(belt);

    // Large 85-rd box magazine drum
    magazineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.14, 0.13), m.oliveStock);
    magazineBaseY = -0.08;
    magazineMesh.position.set(0, magazineBaseY, 0.11);
    group.add(magazineMesh);

    muzzleAnchor.position.set(0, 0.042, 0.79);
  } else if (weaponId === 'valkyrie_smg') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.075, 0.16), m.polymer);
    stock.position.set(0, 0.01, -0.15);
    group.add(stock);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.085, 0.26), m.darkMetal);
    receiver.position.set(0, 0.022, 0.04);
    group.add(receiver);

    const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.08, 0.035), m.tanPolymer);
    foregrip.position.set(0, -0.045, 0.17);
    group.add(foregrip);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 10), m.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.24);
    group.add(barrel);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.105, 0.045), m.polymer);
    grip.position.set(0, -0.055, -0.04);
    grip.rotation.x = 0.24;
    group.add(grip);

    const optic = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.055), m.steel);
    optic.position.set(0, 0.08, 0.05);
    group.add(optic);

    magazineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.17, 0.038), m.steel);
    magazineBaseY = -0.085;
    magazineMesh.position.set(0, magazineBaseY, 0.09);
    magazineMesh.rotation.x = -0.15;
    group.add(magazineMesh);

    muzzleAnchor.position.set(0, 0.03, 0.33);
  } else {
    // Default: VX-7 Assault Rifle
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.09, 0.22), m.polymer);
    stock.position.set(0, 0.005, -0.19);
    group.add(stock);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.085, 0.26), m.steel);
    receiver.position.set(0, 0.024, 0.05);
    group.add(receiver);

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.062, 0.26), m.darkMetal);
    handguard.position.set(0, 0.03, 0.30);
    group.add(handguard);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.014, 0.42), m.steel);
    rail.position.set(0, 0.072, 0.16);
    group.add(rail);

    const holoFrame = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.036, 0.065), m.darkMetal);
    holoFrame.position.set(0, 0.096, 0.07);
    group.add(holoFrame);

    const redDotDot = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 8), m.redDot);
    redDotDot.position.set(0, 0.098, 0.07);
    group.add(redDotDot);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.22, 10), m.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.032, 0.51);
    group.add(barrel);

    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.055, 10), m.accentMetal);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.032, 0.62);
    group.add(muzzleBrake);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.11, 0.046), m.polymer);
    grip.position.set(0, -0.055, -0.04);
    grip.rotation.x = 0.26;
    group.add(grip);

    magazineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.145, 0.062), m.tanPolymer);
    magazineBaseY = -0.075;
    magazineMesh.position.set(0, magazineBaseY, 0.11);
    magazineMesh.rotation.x = -0.16;
    group.add(magazineMesh);

    muzzleAnchor.position.set(0, 0.032, 0.65);
  }

  group.add(muzzleAnchor);
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return { group, muzzleAnchor, magazineMesh, magazineBaseY };
}

export function createFirstPersonRig(weaponId: string): FirstPersonRig {
  const root = new THREE.Group();
  const weaponHolder = new THREE.Group();
  root.add(weaponHolder);

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x1a2230,
    roughness: 0.78,
    metalness: 0.12,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x0f131b,
    roughness: 0.62,
    metalness: 0.25,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xff7a2f,
    emissive: 0xff7a2f,
    emissiveIntensity: 0.35,
    roughness: 0.35,
  });

  // Right shooting forearm & gloved hand
  const rightArmMesh = new THREE.Group();
  const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.072, 0.34), sleeveMat);
  rForearm.position.set(0.04, -0.095, -0.22);
  rForearm.rotation.set(0.18, -0.14, 0);
  rightArmMesh.add(rForearm);
  const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.062, 0.095), gloveMat);
  rGlove.position.set(0.0, -0.048, -0.04);
  rightArmMesh.add(rGlove);
  const rWatch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.04), trimMat);
  rWatch.position.set(0.04, -0.06, -0.15);
  rightArmMesh.add(rWatch);
  weaponHolder.add(rightArmMesh);

  // Left support hand & forearm gripping barrel/handguard
  const leftArmMesh = new THREE.Group();
  const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.068, 0.36), sleeveMat);
  lForearm.position.set(-0.15, -0.10, -0.02);
  lForearm.rotation.set(0.22, 0.56, 0);
  leftArmMesh.add(lForearm);
  const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.056, 0.09), gloveMat);
  lGlove.position.set(-0.015, -0.02, 0.16);
  leftArmMesh.add(lGlove);
  weaponHolder.add(leftArmMesh);

  // Rotate weapon mesh so barrel points along -Z away from camera
  const weaponAssembly = createWeaponMesh(weaponId);
  weaponAssembly.group.rotation.y = Math.PI;
  weaponHolder.add(weaponAssembly.group);

  // Disable shadows on FPS viewmodel so it never casts self-shadow glitches near camera
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });

  weaponHolder.position.set(0.21, -0.20, -0.44);

  return {
    root,
    weaponHolder,
    leftArmMesh,
    rightArmMesh,
    weaponAssembly,
    weaponId,
    recoil: 0,
    swayX: 0,
    swayY: 0,
    bobPhase: 0,
    aimBlend: 0,
    reloadBlend: 0,
  };
}

export function swapFirstPersonWeapon(fp: FirstPersonRig, weaponId: string): void {
  if (fp.weaponId === weaponId) return;
  fp.weaponHolder.remove(fp.weaponAssembly.group);
  const next = createWeaponMesh(weaponId);
  next.group.rotation.y = Math.PI;
  next.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });
  fp.weaponHolder.add(next.group);
  fp.weaponAssembly = next;
  fp.weaponId = weaponId;
}

export function updateFirstPersonRig(
  fp: FirstPersonRig,
  params: {
    dt: number;
    speed: number;
    aiming: boolean;
    reloading: boolean;
    crouched: boolean;
  }
): void {
  const { dt, speed, aiming, reloading, crouched } = params;
  fp.aimBlend = THREE.MathUtils.damp(fp.aimBlend, aiming ? 1 : 0, 16, dt);
  fp.reloadBlend = THREE.MathUtils.damp(fp.reloadBlend, reloading ? 1 : 0, 12, dt);
  fp.recoil = THREE.MathUtils.damp(fp.recoil, 0, 18, dt);

  if (speed > 0.25) {
    fp.bobPhase += dt * (7.5 + speed * 1.15);
  }
  const bobScale = (1 - fp.aimBlend * 0.78) * Math.min(1, speed / 5);
  const bobX = Math.cos(fp.bobPhase * 0.5) * 0.012 * bobScale;
  const bobY = Math.abs(Math.sin(fp.bobPhase)) * 0.014 * bobScale;

  // Smoothly pull gun into center sightline when ADS aiming
  const hipX = 0.21;
  const adsX = 0.0;
  const hipY = crouched ? -0.22 : -0.195;
  const adsY = -0.128;
  const hipZ = -0.44;
  const adsZ = -0.35;

  fp.weaponHolder.position.x =
    THREE.MathUtils.lerp(hipX, adsX, fp.aimBlend) + bobX + fp.swayX * 0.015;
  fp.weaponHolder.position.y =
    THREE.MathUtils.lerp(hipY, adsY, fp.aimBlend) -
    bobY -
    fp.reloadBlend * 0.14 +
    fp.swayY * 0.012;
  fp.weaponHolder.position.z =
    THREE.MathUtils.lerp(hipZ, adsZ, fp.aimBlend) + fp.recoil * 0.065;

  fp.weaponHolder.rotation.x = fp.recoil * 0.11 - fp.reloadBlend * 0.42;
  fp.weaponHolder.rotation.z = fp.reloadBlend * 0.52;
  fp.weaponHolder.rotation.y = fp.swayX * -0.06;

  fp.swayX = THREE.MathUtils.damp(fp.swayX, 0, 10, dt);
  fp.swayY = THREE.MathUtils.damp(fp.swayY, 0, 10, dt);

  const mag = fp.weaponAssembly.magazineMesh;
  mag.position.y = fp.weaponAssembly.magazineBaseY - fp.reloadBlend * 0.14;
}

export function createOperativeRig(options: {
  characterId: string;
  accentHex: string;
  weaponId: string;
}): OperativeRig {
  const root = new THREE.Group();

  const fatigueColor =
    options.characterId === 'specter'
      ? 0x162030
      : options.characterId === 'bastion'
        ? 0x262922
        : options.characterId === 'medic'
          ? 0x182b2c
          : 0x1b2333;

  const vestColor =
    options.characterId === 'specter'
      ? 0x0e141f
      : options.characterId === 'bastion'
        ? 0x2f2d26
        : options.characterId === 'medic'
          ? 0x132b29
          : 0x121926;

  const clothMat = new THREE.MeshStandardMaterial({
    color: fatigueColor,
    roughness: 0.78,
    metalness: 0.1,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: vestColor,
    roughness: 0.42,
    metalness: 0.52,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x0c0f16,
    roughness: 0.65,
    metalness: 0.25,
  });
  const balaclavaMat = new THREE.MeshStandardMaterial({
    color: 0x181c24,
    roughness: 0.85,
    metalness: 0.05,
  });
  const accentColor = new THREE.Color(options.accentHex || '#ff7a2f');
  const visorMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.9,
    metalness: 0.85,
    roughness: 0.14,
  });

  const shadowGeo = new THREE.CircleGeometry(0.42, 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x04060c,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.015;
  root.add(contactShadow);

  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.92, 0);
  root.add(pelvis);

  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.24), armorMat);
  waist.position.y = 0.02;
  pelvis.add(waist);

  const pouchL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.11), bootMat);
  pouchL.position.set(-0.20, 0.01, 0.02);
  pelvis.add(pouchL);

  const pouchR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.11), bootMat);
  pouchR.position.set(0.20, 0.01, 0.02);
  pelvis.add(pouchR);

  function makeLeg(side: -1 | 1): { hip: THREE.Group; knee: THREE.Group } {
    const hip = new THREE.Group();
    hip.position.set(side * 0.125, -0.05, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.076, 0.44, 12), clothMat);
    thigh.position.y = -0.22;
    hip.add(thigh);

    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.10), bootMat);
    holster.position.set(side * 0.09, -0.20, 0);
    hip.add(holster);

    const knee = new THREE.Group();
    knee.position.set(0, -0.44, 0);
    hip.add(knee);

    const kneepad = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.11, 0.085), armorMat);
    kneepad.position.set(0, 0, 0.055);
    knee.add(kneepad);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.06, 0.36, 12), clothMat);
    shin.position.y = -0.18;
    knee.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.105, 0.24), bootMat);
    boot.position.set(0, -0.38, 0.045);
    knee.add(boot);

    pelvis.add(hip);
    return { hip, knee };
  }

  const leftL = makeLeg(-1);
  const rightL = makeLeg(1);

  const torso = new THREE.Group();
  torso.position.set(0, 0.10, 0);
  pelvis.add(torso);

  const chestCore = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.48, 0.25), clothMat);
  chestCore.position.y = 0.24;
  torso.add(chestCore);

  const vestFront = new THREE.Mesh(
    new THREE.BoxGeometry(options.characterId === 'bastion' ? 0.44 : 0.39, 0.39, 0.30),
    armorMat
  );
  vestFront.position.set(0, 0.26, 0.01);
  torso.add(vestFront);

  // Mag pouches across chest rig
  [-0.1, 0, 0.1].forEach((px) => {
    const magPouch = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.12, 0.055), bootMat);
    magPouch.position.set(px, 0.19, 0.17);
    torso.add(magPouch);
  });

  // Glowing tactical IFF accent bar on chest & back
  const trimStripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.036, 0.315), visorMat);
  trimStripe.position.set(0, 0.37, 0.01);
  torso.add(trimStripe);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.15), bootMat);
  backpack.position.set(0, 0.27, -0.20);
  torso.add(backpack);

  const radioAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, 0.28, 6), bootMat);
  radioAntenna.position.set(-0.12, 0.50, -0.22);
  torso.add(radioAntenna);

  // Armored Tactical Helmet + Balaclava Head (no cartoony bare pink sphere!)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.52, 0);
  torso.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.08, 0.11, 10), balaclavaMat);
  neck.position.y = 0.03;
  headGroup.add(neck);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.132, 16, 14), balaclavaMat);
  cranium.scale.set(0.95, 1.08, 1.0);
  cranium.position.y = 0.16;
  headGroup.add(cranium);

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.152, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.60),
    armorMat
  );
  helmet.position.set(0, 0.17, -0.01);
  headGroup.add(helmet);

  const helmetRim = new THREE.Mesh(new THREE.CylinderGeometry(0.148, 0.156, 0.055, 16), bootMat);
  helmetRim.position.set(0, 0.18, -0.01);
  headGroup.add(helmetRim);

  // NVG / Dual tactical goggle visor
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.056, 0.08), visorMat);
  visor.position.set(0, 0.175, 0.118);
  headGroup.add(visor);

  // NVG front bridge mount
  const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 0.05), bootMat);
  nvgMount.position.set(0, 0.23, 0.14);
  headGroup.add(nvgMount);

  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.08, 0.11), armorMat);
  mask.position.set(0, 0.105, 0.078);
  headGroup.add(mask);

  function makeArm(side: -1 | 1): THREE.Group {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.255, 0.44, 0);

    const pauldron = new THREE.Mesh(
      new THREE.BoxGeometry(
        options.characterId === 'bastion' ? 0.16 : 0.13,
        0.13,
        0.16
      ),
      armorMat
    );
    pauldron.position.set(side * 0.015, -0.02, 0);
    shoulder.add(pauldron);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.27, 10), clothMat);
    upperArm.position.set(0, -0.14, 0);
    shoulder.add(upperArm);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.26, 10), armorMat);
    forearm.position.set(0, -0.36, 0.06);
    forearm.rotation.x = -0.35;
    shoulder.add(forearm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.08, 0.09), bootMat);
    glove.position.set(0, -0.47, 0.12);
    shoulder.add(glove);

    torso.add(shoulder);
    return shoulder;
  }

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.14, 0.34, 0.26);
  torso.add(weaponPivot);

  const weaponAssembly = createWeaponMesh(options.weaponId);
  weaponPivot.add(weaponAssembly.group);

  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj !== contactShadow) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return {
    root,
    pelvis,
    torso,
    headGroup,
    leftLeg: leftL.hip,
    leftKnee: leftL.knee,
    rightLeg: rightL.hip,
    rightKnee: rightL.knee,
    leftArm,
    rightArm,
    weaponPivot,
    weaponAssembly,
    visorMat,
    armorMat,
    contactShadow,
    walkPhase: 0,
    crouchBlend: 0,
    aimBlend: 0,
    recoilOffset: 0,
    weaponId: options.weaponId,
  };
}

export function swapRigWeapon(rig: OperativeRig, weaponId: string): void {
  if (rig.weaponId === weaponId) return;
  rig.weaponPivot.remove(rig.weaponAssembly.group);
  const next = createWeaponMesh(weaponId);
  rig.weaponPivot.add(next.group);
  rig.weaponAssembly = next;
  rig.weaponId = weaponId;
}

export function updateOperativePose(
  rig: OperativeRig,
  params: {
    dt: number;
    speed: number;
    crouched: boolean;
    aiming: boolean;
    reloading: boolean;
    pitch: number;
    alive: boolean;
  }
): void {
  const { dt, speed, crouched, aiming, reloading, pitch, alive } = params;

  rig.crouchBlend = THREE.MathUtils.damp(rig.crouchBlend, crouched ? 1 : 0, 14, dt);
  rig.aimBlend = THREE.MathUtils.damp(rig.aimBlend, aiming ? 1 : 0, 14, dt);
  rig.recoilOffset = THREE.MathUtils.damp(rig.recoilOffset, 0, 18, dt);

  if (!alive) {
    rig.root.rotation.x = THREE.MathUtils.damp(rig.root.rotation.x, -Math.PI / 2, 10, dt);
    rig.pelvis.position.y = THREE.MathUtils.damp(rig.pelvis.position.y, 0.25, 10, dt);
    return;
  }

  rig.root.rotation.x = THREE.MathUtils.damp(rig.root.rotation.x, 0, 14, dt);

  if (speed > 0.25) {
    rig.walkPhase += dt * (4.8 + speed * 1.45);
  } else {
    rig.walkPhase = THREE.MathUtils.damp(
      rig.walkPhase,
      Math.round(rig.walkPhase / Math.PI) * Math.PI,
      8,
      dt
    );
  }

  const strideAmp = Math.min(0.65, speed * 0.085) * (1 - rig.crouchBlend * 0.32);
  const s = Math.sin(rig.walkPhase);

  const basePelvisY = 0.92 - rig.crouchBlend * 0.34;
  const bob = speed > 0.3 ? Math.abs(Math.cos(rig.walkPhase)) * 0.03 : 0;
  rig.pelvis.position.y = basePelvisY + bob;

  const crouchHip = -rig.crouchBlend * 0.92;
  const crouchKnee = rig.crouchBlend * 1.25;
  rig.leftLeg.rotation.x = crouchHip + s * strideAmp;
  rig.rightLeg.rotation.x = crouchHip - s * strideAmp;
  rig.leftKnee.rotation.x = crouchKnee + Math.max(0, -s * strideAmp * 0.9);
  rig.rightKnee.rotation.x = crouchKnee + Math.max(0, s * strideAmp * 0.9);

  rig.torso.rotation.x = rig.crouchBlend * 0.24 + Math.min(0.12, speed * 0.012);
  rig.headGroup.rotation.x = THREE.MathUtils.clamp(pitch * 0.55, -0.5, 0.5);

  const reloadDrop = reloading ? -0.45 : 0;
  rig.rightArm.rotation.x = -1.25 - rig.aimBlend * 0.16 + pitch * 0.5 + reloadDrop;
  rig.rightArm.rotation.z = -0.18;
  rig.leftArm.rotation.x = -1.18 - rig.aimBlend * 0.14 + pitch * 0.5 + reloadDrop * 0.6;
  rig.leftArm.rotation.z = 0.36;
  rig.leftArm.rotation.y = 0.28;

  rig.weaponPivot.position.x = THREE.MathUtils.lerp(0.17, 0.11, rig.aimBlend);
  rig.weaponPivot.position.y = THREE.MathUtils.lerp(0.32, 0.39, rig.aimBlend);
  rig.weaponPivot.position.z = 0.28 - rig.recoilOffset * 0.07;
  rig.weaponPivot.rotation.x = pitch * 0.72 - rig.recoilOffset * 0.22 + (reloading ? 0.55 : 0);
  rig.weaponPivot.rotation.z = reloading ? -0.45 : 0;

  const mag = rig.weaponAssembly.magazineMesh;
  mag.position.y = rig.weaponAssembly.magazineBaseY - (reloading ? 0.11 : 0);
}

export function createZombieRig(variant: 'shambler' | 'sprinter' | 'brute'): ZombieRig {
  const root = new THREE.Group();
  const scale = variant === 'brute' ? 1.28 : variant === 'sprinter' ? 0.96 : 1.03;
  root.scale.setScalar(scale);

  const skinMat = new THREE.MeshStandardMaterial({
    color: variant === 'brute' ? 0x3f4c3c : variant === 'sprinter' ? 0x4d5a47 : 0x55644f,
    roughness: 0.85,
    metalness: 0.05,
  });
  const ragMat = new THREE.MeshStandardMaterial({
    color: variant === 'brute' ? 0x261d22 : 0x21242b,
    roughness: 0.9,
    metalness: 0.12,
  });
  const woundMat = new THREE.MeshStandardMaterial({
    color: 0x6b1414,
    roughness: 0.55,
    metalness: 0.1,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: variant === 'sprinter' ? 0xff2b2b : variant === 'brute' ? 0xa3e635 : 0xff6b2b,
    emissive: variant === 'sprinter' ? 0xff1e1e : variant === 'brute' ? 0x84cc16 : 0xff5500,
    emissiveIntensity: 1.8,
  });

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 16),
    new THREE.MeshBasicMaterial({ color: 0x04060c, transparent: true, opacity: 0.45, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.13, 0.86, 0);
  const lLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.82, 8), ragMat);
  lLegMesh.position.y = -0.41;
  leftLeg.add(lLegMesh);
  root.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.13, 0.86, 0);
  const rLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.82, 8), ragMat);
  rLegMesh.position.y = -0.41;
  rightLeg.add(rLegMesh);
  root.add(rightLeg);

  const torso = new THREE.Group();
  torso.position.set(0, 0.90, 0);
  root.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.56, 0.24), ragMat);
  chest.position.y = 0.28;
  torso.add(chest);

  const slash = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.255), woundMat);
  slash.position.set(0.03, 0.30, 0.01);
  torso.add(slash);

  const head = new THREE.Group();
  head.position.set(0, 0.62, 0.04);
  torso.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), skinMat);
  skull.scale.set(0.92, 1.12, 1.0);
  skull.position.y = 0.13;
  head.add(skull);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.075, 0.13), skinMat);
  jaw.position.set(0, 0.03, 0.05);
  head.add(jaw);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeMat);
  eyeL.position.set(-0.05, 0.14, 0.125);
  head.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeMat);
  eyeR.position.set(0.05, 0.14, 0.125);
  head.add(eyeR);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.26, 0.50, 0);
  const lArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.62, 8), skinMat);
  lArmMesh.position.set(0, -0.28, 0.08);
  leftArm.add(lArmMesh);
  torso.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.26, 0.50, 0);
  const rArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.62, 8), skinMat);
  rArmMesh.position.set(0, -0.28, 0.08);
  rightArm.add(rArmMesh);
  torso.add(rightArm);

  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj !== shadow) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return {
    root,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    walkPhase: Math.random() * Math.PI * 2,
    variant,
  };
}

export function updateZombiePose(rig: ZombieRig, dt: number, speed: number): void {
  rig.walkPhase += dt * (3.8 + speed * 1.45);
  const s = Math.sin(rig.walkPhase);

  rig.leftLeg.rotation.x = s * 0.55;
  rig.rightLeg.rotation.x = -s * 0.55;

  // Hunched lurching zombie torso & outstretched claw arms
  rig.torso.rotation.x = rig.variant === 'sprinter' ? 0.34 : 0.22;
  rig.torso.rotation.z = s * 0.08;
  rig.head.rotation.z = -s * 0.14;
  rig.leftArm.rotation.x = -1.38 + Math.cos(rig.walkPhase * 0.8) * 0.18;
  rig.rightArm.rotation.x = -1.32 - Math.cos(rig.walkPhase * 0.8) * 0.18;
}
