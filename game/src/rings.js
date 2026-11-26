// SENJA MERPATI — rings, waypoints and mission progress.
// Rings are golden toruses that bob and spin; flying through one collects it.
// A mission is a list of steps: rings, fly-to points, or landings.
import * as THREE from 'three';
import { RINGS, RUNWAYS, CARRIER, RING_SCORE, LAND_SCORE, MISSION_SCORE } from './config.js';

export function createRings(scene) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffc233, emissive: 0xff9500, emissiveIntensity: 0.9,
    metalness: 0.6, roughness: 0.35,
  });
  const dimMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a2a, emissive: 0x442200, emissiveIntensity: 0.4,
    metalness: 0.4, roughness: 0.6,
  });
  const meshes = RINGS.map((r, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(6, 0.55, 12, 36), mat.clone());
    m.position.set(r.x, r.y, r.z);
    // Face the ring toward the home runway so it reads as a gate to fly through.
    m.rotation.y = Math.atan2(-(r.x + 170), -(r.z + 90)) + Math.PI / 2;
    m.userData.baseY = r.y;
    m.userData.index = i;
    m.visible = false;
    group.add(m);
    return m;
  });
  scene.add(group);

  // Waypoint beacon: a tall glowing pillar marking the current target.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 120, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  beacon.visible = false;
  scene.add(beacon);

  let active = []; // ring indices of the current step
  let collected = 0;

  function setActive(indices) {
    active = indices.slice();
    collected = 0;
    meshes.forEach((m, i) => {
      m.visible = active.includes(i);
      m.material = active.includes(i) ? mat : dimMat;
    });
  }

  function clear() {
    meshes.forEach((m) => { m.visible = false; });
    beacon.visible = false;
    active = [];
  }

  function setBeacon(x, y, z) {
    beacon.position.set(x, Math.max(y, 10), z);
    beacon.visible = true;
  }

  function hideBeacon() { beacon.visible = false; }

  // Returns the index of a ring just flown through, or -1.
  function checkPass(px, py, pz) {
    for (const i of active) {
      const m = meshes[i];
      if (!m.visible) continue;
      const dx = px - m.position.x, dy = py - m.position.y, dz = pz - m.position.z;
      if (dx * dx + dy * dy + dz * dz < 8.5 * 8.5) {
        m.visible = false;
        collected++;
        return i;
      }
    }
    return -1;
  }

  function update(dt, elapsed) {
    for (const m of meshes) {
      if (!m.visible) continue;
      m.position.y = m.userData.baseY + Math.sin(elapsed * 0.9 + m.userData.index) * 1.2;
      m.rotation.z += dt * 0.25;
    }
    if (beacon.visible) beacon.rotation.y += dt * 0.4;
  }

  return { setActive, clear, setBeacon, hideBeacon, checkPass, update,
    get collected() { return collected; },
    get activeCount() { return active.length; },
    ringPos(i) { return RINGS[i]; },
  };
}

// Mission runner: steps in order, scoring, timers.
export function createMission(mission, rings, onEvent) {
  let stepIdx = 0;
  let stepRingsDone = 0;
  let timeLeft = 0;
  let score = 0;
  let done = false;
  // Rings collected across the whole mission (for the HUD progress counter).
  let ringsCollected = 0;
  const totalRings = mission.steps.reduce(
    (n, s) => n + (s.type === 'rings' ? s.rings.length : 0), 0);

  function currentStep() { return mission.steps[stepIdx]; }

  function startStep() {
    const step = currentStep();
    if (!step) { done = true; onEvent('mission-complete', { score: score + MISSION_SCORE }); return; }
    if (step.type === 'rings') {
      rings.setActive(step.rings);
      stepRingsDone = 0;
      if (step.time) timeLeft = step.time;
    } else if (step.type === 'flyto') {
      rings.clear();
      rings.setBeacon(step.at.x, step.at.y, step.at.z);
    } else if (step.type === 'land') {
      rings.clear();
      const t = step.target === 'carrier'
        ? { x: CARRIER.x, y: CARRIER.deckY, z: CARRIER.z }
        : RUNWAYS.find((r) => r.id === step.target);
      rings.setBeacon(t.x, t.y + 30, t.z);
    }
    onEvent('step', { label: step.label });
  }

  function start() {
    stepIdx = 0; score = 0; done = false; ringsCollected = 0;
    startStep();
  }

  function onRing(i) {
    const step = currentStep();
    if (!step || step.type !== 'rings') return;
    stepRingsDone++;
    ringsCollected++;
    score += RING_SCORE;
    onEvent('ring', { index: i, score, left: step.rings.length - stepRingsDone });
    if (stepRingsDone >= step.rings.length) {
      rings.hideBeacon();
      stepIdx++;
      startStep();
    }
  }

  function onFlyTo(px, py, pz) {
    const step = currentStep();
    if (!step || step.type !== 'flyto') return false;
    const dx = px - step.at.x, dy = py - step.at.y, dz = pz - step.at.z;
    if (dx * dx + dy * dy + dz * dz < step.radius * step.radius) {
      score += RING_SCORE;
      onEvent('flyto', { score });
      rings.hideBeacon();
      stepIdx++;
      startStep();
      return true;
    }
    return false;
  }

  function onLand(target) {
    const step = currentStep();
    if (!step || step.type !== 'land') return false;
    const ok = (step.target === 'carrier' && target.type === 'carrier')
      || (step.target !== 'carrier' && target.type === 'runway' && target.id === step.target);
    if (!ok) return false;
    score += LAND_SCORE;
    onEvent('land', { score, target: step.target });
    rings.hideBeacon();
    stepIdx++;
    startStep();
    return stepIdx >= mission.steps.length;
  }

  function tick(dt) {
    const step = currentStep();
    if (step && step.time) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        onEvent('timeout', { score });
        return 'timeout';
      }
    }
    return null;
  }

  function targetPos() {
    const step = currentStep();
    if (!step) return null;
    if (step.type === 'rings') {
      const next = step.rings[stepRingsDone];
      if (next === undefined) return null;
      return RINGS[next];
    }
    if (step.type === 'flyto') return step.at;
    if (step.type === 'land') {
      if (step.target === 'carrier') return { x: CARRIER.x, y: CARRIER.deckY, z: CARRIER.z };
      const rw = RUNWAYS.find((r) => r.id === step.target);
      return { x: rw.x, y: rw.height, z: rw.z };
    }
    return null;
  }

  return { start, onRing, onFlyTo, onLand, tick, targetPos, currentStep,
    get stepLabel() { const s = currentStep(); return s ? s.label : 'Misi selesai'; },
    get score() { return score; },
    get ringsDone() { return ringsCollected; },
    get ringsTotal() { return totalRings; },
    get timeLeft() { return timeLeft; },
    get finished() { return done; },
    get stepIndex() { return stepIdx; },
    get stepTotal() { return mission.steps.length; },
  };
}
