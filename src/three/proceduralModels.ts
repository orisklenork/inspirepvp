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

function getGunMaterials() {
  return {
    steel: new THREE.MeshStandardMaterial({
      color: 0x262d38,
      metalness: 0.85,
      roughness: 0.28,
    }),
    darkMetal: new THREE.MeshStandardMaterial({
      color: 0x161b24,
      metalness: 0.75,
      roughness: 0.42,
    }),
    polymer: new THREE.MeshStandardMaterial({
      color: 0x1e222b,
      metalness: 0.15,
      roughness: 0.72,
    }),
    tanPolymer: new THREE.MeshStandardMaterial({
      color: 0x4b4338,
      metalness: 0.12,
      roughness: 0.76,
    }),
    accentMetal: new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.82,
      roughness: 0.25,
    }),
    opticGlow: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.1,
      metalness: 0.4,
      roughness: 0.15,
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
    // Frame + Grip
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

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 10), m.darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.038, 0.19);
    group.add(barrel);

    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 12), m.darkMetal);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.038, 0.24);
    group.add(suppressor);

    magazineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.09, 0.036), m.darkMetal);
    magazineBaseY = -0.08;
    magazineMesh.position.set(0, magazineBaseY, -0.035);
    magazineMesh.rotation.x = 0.22;
    group.add(magazineMesh);

    muzzleAnchor.position.set(0, 0.038, 0.305);
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

    // Magnified sniper scope
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 12), m.darkMetal);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.095, 0.11);
    group.add(scopeTube);

    const scopeFront = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.05, 12), m.steel);
    scopeFront.rotation.x = Math.PI / 2;
    scopeFront.position.set(0, 0.095, 0.25);
    group.add(scopeFront);

    const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), m.opticGlow);
    scopeLens.position.set(0, 0.095, 0.276);
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
    // Default: VX-7 Pulse Rifle (Assault Rifle)
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.09, 0.22), m.polymer);
    stock.position.set(0, 0.005, -0.19);
    group.add(stock);

    const bufferTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 10), m.darkMetal);
    bufferTube.rotation.x = Math.PI / 2;
    bufferTube.position.set(0, 0.022, -0.11);
    group.add(bufferTube);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.085, 0.26), m.steel);
    receiver.position.set(0, 0.024, 0.05);
    group.add(receiver);

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.062, 0.26), m.darkMetal);
    handguard.position.set(0, 0.03, 0.30);
    group.add(handguard);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.014, 0.42), m.steel);
    rail.position.set(0, 0.072, 0.16);
    group.add(rail);

    const optic = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.036, 0.07), m.darkMetal);
    optic.position.set(0, 0.096, 0.07);
    group.add(optic);

    const opticLens = new THREE.Mesh(new THREE.CircleGeometry(0.011, 10), m.opticGlow);
    opticLens.position.set(0, 0.096, 0.106);
    group.add(opticLens);

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

export function createOperativeRig(options: {
  characterId: string;
  accentHex: string;
  weaponId: string;
}): OperativeRig {
  const root = new THREE.Group();

  const fatigueColor =
    options.characterId === 'specter'
      ? 0x1e293b
      : options.characterId === 'bastion'
        ? 0x2c3028
        : options.characterId === 'medic'
          ? 0x1e3032
          : 0x263142;

  const vestColor =
    options.characterId === 'specter'
      ? 0x141b28
      : options.characterId === 'bastion'
        ? 0x3b3830
        : options.characterId === 'medic'
          ? 0x1a3835
          : 0x1d2536;

  const clothMat = new THREE.MeshStandardMaterial({
    color: fatigueColor,
    roughness: 0.78,
    metalness: 0.08,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: vestColor,
    roughness: 0.46,
    metalness: 0.42,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x12161f,
    roughness: 0.72,
    metalness: 0.18,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc49576,
    roughness: 0.65,
    metalness: 0.02,
  });
  const accentColor = new THREE.Color(options.accentHex || '#ff7a2f');
  const visorMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.45,
    metalness: 0.85,
    roughness: 0.16,
  });

  // Contact shadow disc at foot ground plane
  const shadowGeo = new THREE.CircleGeometry(0.42, 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x050810,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.015;
  root.add(contactShadow);

  // Pelvis root (~0.92m off ground when standing)
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.92, 0);
  root.add(pelvis);

  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.24), armorMat);
  waist.position.y = 0.02;
  pelvis.add(waist);

  // Utility pouches
  const pouchL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.10), bootMat);
  pouchL.position.set(-0.20, 0.01, 0.02);
  pelvis.add(pouchL);

  const pouchR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.10), bootMat);
  pouchR.position.set(0.20, 0.01, 0.02);
  pelvis.add(pouchR);

  // Legs
  function makeLeg(side: -1 | 1): { hip: THREE.Group; knee: THREE.Group } {
    const hip = new THREE.Group();
    hip.position.set(side * 0.125, -0.05, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.074, 0.44, 12), clothMat);
    thigh.position.y = -0.22;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.44, 0);
    hip.add(knee);

    const kneepad = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.10, 0.08), armorMat);
    kneepad.position.set(0, 0, 0.055);
    knee.add(kneepad);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.058, 0.36, 12), clothMat);
    shin.position.y = -0.18;
    knee.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.24), bootMat);
    boot.position.set(0, -0.38, 0.045);
    knee.add(boot);

    pelvis.add(hip);
    return { hip, knee };
  }

  const leftL = makeLeg(-1);
  const rightL = makeLeg(1);

  // Torso
  const torso = new THREE.Group();
  torso.position.set(0, 0.10, 0);
  pelvis.add(torso);

  const chestCore = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.48, 0.25), clothMat);
  chestCore.position.y = 0.24;
  torso.add(chestCore);

  const vestFront = new THREE.Mesh(
    new THREE.BoxGeometry(options.characterId === 'bastion' ? 0.44 : 0.38, 0.38, 0.29),
    armorMat
  );
  vestFront.position.set(0, 0.26, 0.01);
  torso.add(vestFront);

  // Tactical trim stripe across vest
  const trimStripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.305), visorMat);
  trimStripe.position.set(0, 0.35, 0.01);
  torso.add(trimStripe);

  // Tactical backpack
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.14), bootMat);
  backpack.position.set(0, 0.27, -0.19);
  torso.add(backpack);

  if (options.characterId === 'vanguard' || options.characterId === 'medic') {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.26, 6), bootMat);
    antenna.position.set(-0.11, 0.50, -0.21);
    torso.add(antenna);
  }

  // Head + Helmet
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.52, 0);
  torso.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.11, 10), skinMat);
  neck.position.y = 0.03;
  headGroup.add(neck);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.132, 16, 14), skinMat);
  cranium.scale.set(0.95, 1.08, 1.0);
  cranium.position.y = 0.16;
  headGroup.add(cranium);

  // Combat Helmet Dome
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.148, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    armorMat
  );
  helmet.position.set(0, 0.17, -0.01);
  headGroup.add(helmet);

  // Helmet cheek side guards
  const helmetRim = new THREE.Mesh(new THREE.CylinderGeometry(0.146, 0.152, 0.05, 16), bootMat);
  helmetRim.position.set(0, 0.18, -0.01);
  headGroup.add(helmetRim);

  // Tactical Visor / Goggles
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.058, 0.08), visorMat);
  visor.position.set(0, 0.175, 0.115);
  headGroup.add(visor);

  // Face mask lower half
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.075, 0.11), bootMat);
  mask.position.set(0, 0.105, 0.075);
  headGroup.add(mask);

  // Arms
  function makeArm(side: -1 | 1): THREE.Group {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.255, 0.44, 0);

    const pauldron = new THREE.Mesh(
      new THREE.BoxGeometry(
        options.characterId === 'bastion' ? 0.16 : 0.125,
        0.13,
        0.15
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

  // Weapon pivot attached to torso shoulder plane
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
    rig.walkPhase = THREE.MathUtils.damp(rig.walkPhase, Math.round(rig.walkPhase / Math.PI) * Math.PI, 8, dt);
  }

  const strideAmp = Math.min(0.65, speed * 0.085) * (1 - rig.crouchBlend * 0.32);
  const s = Math.sin(rig.walkPhase);

  // Pelvis drop on crouch + subtle stride bob
  const basePelvisY = 0.92 - rig.crouchBlend * 0.34;
  const bob = speed > 0.3 ? Math.abs(Math.cos(rig.walkPhase)) * 0.03 : 0;
  rig.pelvis.position.y = basePelvisY + bob;

  // Legs crouch bend + walk swing
  const crouchHip = -rig.crouchBlend * 0.92;
  const crouchKnee = rig.crouchBlend * 1.25;
  rig.leftLeg.rotation.x = crouchHip + s * strideAmp;
  rig.rightLeg.rotation.x = crouchHip - s * strideAmp;
  rig.leftKnee.rotation.x = crouchKnee + Math.max(0, -s * strideAmp * 0.9);
  rig.rightKnee.rotation.x = crouchKnee + Math.max(0, s * strideAmp * 0.9);

  // Torso forward lean when crouching or sprinting
  rig.torso.rotation.x = rig.crouchBlend * 0.24 + Math.min(0.12, speed * 0.012);

  // Head tracks vertical aim pitch gently
  rig.headGroup.rotation.x = THREE.MathUtils.clamp(pitch * 0.55, -0.5, 0.5);

  // Arms raised in two-hand tactical grip toward weaponPivot
  const reloadDrop = reloading ? -0.45 : 0;
  rig.rightArm.rotation.x = -1.25 - rig.aimBlend * 0.16 + pitch * 0.5 + reloadDrop;
  rig.rightArm.rotation.z = -0.18;
  rig.leftArm.rotation.x = -1.18 - rig.aimBlend * 0.14 + pitch * 0.5 + reloadDrop * 0.6;
  rig.leftArm.rotation.z = 0.36;
  rig.leftArm.rotation.y = 0.28;

  // Weapon aim + recoil + reload magazine animation
  rig.weaponPivot.position.x = THREE.MathUtils.lerp(0.17, 0.11, rig.aimBlend);
  rig.weaponPivot.position.y = THREE.MathUtils.lerp(0.32, 0.39, rig.aimBlend);
  rig.weaponPivot.position.z = 0.28 - rig.recoilOffset * 0.07;
  rig.weaponPivot.rotation.x = pitch * 0.72 - rig.recoilOffset * 0.22 + (reloading ? 0.55 : 0);
  rig.weaponPivot.rotation.z = reloading ? -0.45 : 0;

  const mag = rig.weaponAssembly.magazineMesh;
  mag.position.y = rig.weaponAssembly.magazineBaseY - (reloading ? 0.11 : 0);
}
