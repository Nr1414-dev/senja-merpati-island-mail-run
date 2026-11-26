// SENJA MERPATI — Island Mail Run: bootstrap, game loop, state machine, input,
// chase camera. The game runs from static files, no network, no build step.
import * as THREE from 'three';
import { PLANES, MISSIONS, UPGRADES, WORLD_SEED } from './config.js';
import { clamp, damp, mulberry32 } from './random.js';
import { buildWorld } from './world.js';
import { createPlane } from './plane.js';
import { createFlight } from './flight.js';
import { createRings, createMission } from './rings.js';
import { createWeather } from './weather.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { getShotPreset, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2200);
camera.position.set(-200, 30, -40);

const world = buildWorld(scene);
const rings = createRings(scene);
const weather = createWeather(scene, world.sunLight, world.hemi, world.skyMat);
const audio = createAudio();

const state = {
  mode: 'title', // title | playing | paused | crashed | complete | timeout
  planeIndex: 0,
  missionIndex: 0,
  coins: 0,
  upgrades: {},
  missionTime: 0,
};

let plane = null;
let flight = null;
let mission = null;
let camOffset = { dist: 15, height: 5.5, lateral: 0 };
let camSnapped = false;

const keys = {};
const input = { pitch: 0, roll: 0, throttle: 0, brake: false };

function upgradeEffects() {
  const eff = {};
  for (const [id, owned] of Object.entries(state.upgrades)) {
    if (!owned) continue;
    const u = UPGRADES.find((x) => x.id === id);
    if (!u) continue;
    for (const [k, v] of Object.entries(u.apply)) {
      if (typeof v === 'number') eff[k] = (eff[k] || 1) * v;
      else eff[k] = v;
    }
  }
  return eff;
}

function rebuildPlane() {
  if (plane) scene.remove(plane.group);
  plane = createPlane(PLANES[state.planeIndex]);
  scene.add(plane.group);
}

function onMissionEvent(kind, data) {
  if (kind === 'step') {
    hud.toast(data.label);
  } else if (kind === 'ring') {
    audio.ring();
    hud.toast(`Ring! +100  (${data.left} lagi)`);
  } else if (kind === 'flyto') {
    audio.ring();
    hud.toast('Titik jemput tercapai! +100');
  } else if (kind === 'land') {
    audio.land();
    flight.refuel();
    hud.toast('Mendarat! +250 — BBM diisi penuh');
  } else if (kind === 'mission-complete') {
    finishMission(true, data.score);
  } else if (kind === 'timeout') {
    finishMission(false, data.score, 'Waktu habis!');
  }
}

function startMission(index, opts = {}) {
  state.missionIndex = index;
  state.missionTime = 0;
  const spec = PLANES[state.planeIndex];
  rebuildPlane();
  flight = createFlight(spec, upgradeEffects());
  const m = MISSIONS[index];
  mission = createMission(m, rings, onMissionEvent);
  weather.apply(m.weather);
  mission.start();
  hud.setMissionName(m.name);
  hud.setCoins(state.coins);
  hud.hideEnd();
  hud.hidePause();
  hud.show();
  $('screen-title').style.display = 'none';
  state.mode = 'playing';
  camSnapped = false;
  if (!opts.quiet) {
    audio.ensure();
    audio.click();
    hud.toast(m.brief, 4200);
  }
}

function finishMission(win, score, failReason) {
  if (state.mode !== 'playing') return;
  const m = MISSIONS[state.missionIndex];
  if (win) {
    const medal = state.missionTime <= m.par ? 'EMAS 🥇'
      : state.missionTime <= m.par * 1.4 ? 'PERAK 🥈' : 'PERUNGGU 🥉';
    const earned = m.reward + Math.floor(score / 50);
    state.coins += earned;
    audio.fanfare();
    state.mode = 'complete';
    hud.showEnd({
      title: `Misi Selesai — ${m.name}`,
      win: true,
      lines: [
        `Medali: ${medal} (waktu ${Math.round(state.missionTime)} dtk, par ${m.par} dtk)`,
        `Skor misi: ${score}`,
        `Koin pos: +${earned} (total ${state.coins})`,
        'Belanja upgrade di hangar, lalu terbang lagi!',
      ],
    });
  } else {
    audio.crash();
    state.mode = 'timeout';
    hud.showEnd({
      title: failReason || 'Misi Gagal',
      win: false,
      lines: [`Skor: ${score}`, 'Coba lagi — ganti pesawat atau pasang upgrade di hangar.'],
    });
  }
  hud.setCoins(state.coins);
}

function crashPlane() {
  if (state.mode !== 'playing') return;
  audio.crash();
  state.mode = 'crashed';
  hud.showEnd({
    title: 'Pesawat Jatuh!',
    win: false,
    lines: [
      `Kerusakan 100% — ${PLANES[state.planeIndex].name} hancur.`,
      `Skor misi: ${mission ? mission.score : 0}`,
      'Periksa ketinggian dan kecepatan sebelum mendarat.',
    ],
  });
}

const hud = createHud({
  selectPlane(i) { state.planeIndex = i; },
  selectMission(i) { state.missionIndex = i; },
  start() { startMission(state.missionIndex); },
  resume() { hud.hidePause(); state.mode = 'playing'; },
  restart() { startMission(state.missionIndex); },
  toMenu() {
    state.mode = 'title';
    hud.showTitle();
    hud.buildTitle(state);
    if (flight) flight.state.crashed = false;
  },
  buyUpgrade(u) {
    if (state.upgrades[u.id]) return;
    if (state.coins < u.cost) {
      hud.toast(`Koin kurang — ${u.name} butuh ${u.cost} koin`);
      return;
    }
    state.coins -= u.cost;
    state.upgrades[u.id] = true;
    audio.click();
    hud.setCoins(state.coins);
    hud.buildShop(state);
    hud.toast(`${u.name} dipasang!`);
  },
});

function readInput() {
  input.pitch = (keys.ArrowUp ? 1 : 0) + (keys.ArrowDown ? -1 : 0);
  input.roll = (keys.ArrowRight ? 1 : 0) + (keys.ArrowLeft ? -1 : 0);
  input.throttle = (keys.KeyW ? 1 : 0) + (keys.KeyS ? -1 : 0);
  input.brake = !!keys.Space;
}

function updateCamera(dt) {
  const f = flight.state;
  const fx = Math.cos(f.heading) * Math.cos(f.pitch);
  const fy = Math.sin(f.pitch);
  const fz = Math.sin(f.heading) * Math.cos(f.pitch);
  const rx = -Math.sin(f.heading), rz = Math.cos(f.heading);
  const tx = f.x - fx * camOffset.dist + rx * camOffset.lateral;
  const ty = f.y - fy * camOffset.dist + camOffset.height;
  const tz = f.z - fz * camOffset.dist + rz * camOffset.lateral;
  if (!camSnapped) {
    camera.position.set(tx, ty, tz);
    camSnapped = true;
  } else {
    camera.position.x = damp(camera.position.x, tx, 4.5, dt);
    camera.position.y = damp(camera.position.y, ty, 4.5, dt);
    camera.position.z = damp(camera.position.z, tz, 4.5, dt);
  }
  camera.lookAt(f.x + fx * 22, f.y + fy * 22 + 1.2, f.z + fz * 22);
}

function syncPlaneMesh() {
  const f = flight.state;
  plane.group.position.set(f.x, f.y, f.z);
  // Model faces -Z: yaw = -heading - PI/2, pitch about X, roll about Z (negated).
  plane.group.rotation.order = 'YXZ';
  plane.group.rotation.set(f.pitch, -f.heading - Math.PI / 2, -f.roll);
  plane.spinProp(1 / 60, f.speed);
}

// --- Screenshot staging mode: ?shot=cover|mission|landing|storm&seed=N ---
const shotPreset = getShotPreset();
let shotFramesLeft = 0;
let shotReady = false;

const game = {
  startMission,
  setPlane(p) {
    const f = flight.state;
    Object.assign(f, p);
    f.grounded = false; f.airborne = true; f.crashed = false;
    syncPlaneMesh();
    camSnapped = false;
  },
  setWeather(name) { weather.apply(name); },
  setCamera(c) { camOffset = { ...c }; camSnapped = false; },
  collectRing(i) { if (mission) mission.onRing(i); },
  get mission() { return mission; },
  get flight() { return flight; },
  get state() { return state; },
};

window.__game = game;

if (shotPreset) {
  // Stage a real mission state, freeze the flight sim, render N frames.
  startMission(shotPreset.mission, { quiet: true });
  shotFramesLeft = stageShot(game, shotPreset);
  state.mode = 'playing';
  hud.hideEnd();
  hud.hidePause();
}

let lastT = performance.now();
let elapsed = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = clamp((now - lastT) / 1000, 0.001, 0.05);
  lastT = now;
  elapsed += dt;

  if (state.mode === 'playing') {
    readInput();
    if (!shotPreset) {
      flight.update(input, dt, weather.windNow());
      state.missionTime += dt;
      const f = flight.state;
      // Ring pass.
      const hit = rings.checkPass(f.x, f.y, f.z);
      if (hit >= 0 && mission) mission.onRing(hit);
      // Fly-to point.
      if (mission) mission.onFlyTo(f.x, f.y, f.z);
      // Landing.
      const target = flight.checkLanding();
      if (target && f.grounded && mission) {
        const finished = mission.onLand(target);
        if (finished) { /* mission-complete event handles the end screen */ }
      }
      // Crash.
      if (f.crashed) crashPlane();
      // Mission timer.
      if (mission && mission.tick(dt) === 'timeout') { /* event handles it */ }
      flight.applyCrashWear(dt);
    }
    syncPlaneMesh();
    updateCamera(dt);
    rings.update(dt, elapsed);
    weather.update(dt, elapsed, camera.position);
    world.update(dt, elapsed);
    audio.update(flight.state.throttle, flight.state.speed, flight.state.grounded);
    hud.update(flight.state, mission, mission ? mission.targetPos() : null, dt);
    if (shotPreset && !shotReady) {
      shotFramesLeft--;
      if (shotFramesLeft <= 0) {
        shotReady = true;
        window.__shotReady = true;
      }
    }
  } else if (state.mode === 'title') {
    // Gentle orbit over the home island behind the title screen.
    const t = elapsed * 0.05;
    camera.position.set(-170 + Math.cos(t) * 160, 55 + Math.sin(t * 0.7) * 8, -90 + Math.sin(t) * 160);
    camera.lookAt(-170, 12, -90);
    world.update(dt, elapsed);
    rings.update(dt, elapsed);
    weather.update(dt, elapsed, camera.position);
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state.mode === 'playing') { state.mode = 'paused'; hud.showPause(); }
    else if (state.mode === 'paused') { state.mode = 'playing'; hud.hidePause(); }
  }
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    hud.toast(muted ? 'Suara mati' : 'Suara hidup');
  }
  if (e.code === 'Enter' && state.mode === 'title') startMission(state.missionIndex);
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Boot: title screen (or staged shot).
hud.buildTitle(state);
if (!shotPreset) hud.showTitle();
if (!shotPreset) weather.apply('clear');
requestAnimationFrame(loop);

// Seeded demo for the title backdrop: a parked plane on the home runway.
// (Skipped in shot mode: it would overwrite the staged flight state.)
if (!shotPreset) {
  rebuildPlane();
  flight = createFlight(PLANES[0], {});
  syncPlaneMesh();
}
