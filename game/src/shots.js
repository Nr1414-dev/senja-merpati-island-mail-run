// SENJA MERPATI — deterministic screenshot staging.
// ?shot=cover|mission|landing|storm&seed=N stages a real game state, renders a
// fixed number of frames, then sets window.__shotReady. No mockups: every shot
// is a live render of the game's own code, with the same seeded world.
import { RINGS } from './config.js';

const PRESETS = {
  // Cover: chase view, plane mid-flight toward rings 1-3, home runway behind,
  // Pulau Karang ahead. Every criterion-1 element in one frame. Ring 1 is
  // collected through the real handler so the HUD shows live progress
  // (Skor 100, RING 1/3) instead of a standing-zero score.
  cover: {
    mission: 0, weather: 'clear',
    collectRings: [0],
    plane: { x: -118, y: 40, z: -66, heading: 0.42, pitch: 0.02, roll: -0.08, speed: 42, throttle: 0.72 },
    cam: { dist: 15, height: 5.5, lateral: 2.5 },
    // 90 frames: the staging toast (2.6 s) is long gone by capture, and the
    // slow software renderer still finishes well inside the shot timeout.
    settleFrames: 90,
  },
  // Mission: banking through a ring over Pulau Karang, volcano behind.
  mission: {
    mission: 1, weather: 'crosswind',
    plane: { x: 150, y: 42, z: -70, heading: 1.0, pitch: -0.04, roll: 0.35, speed: 55, throttle: 0.85 },
    cam: { dist: 17, height: 6, lateral: 0 },
    settleFrames: 90,
  },
  // Landing: final approach to Pulau Karang's strip, low over the threshold.
  landing: {
    mission: 0, weather: 'clear', skipRings: true,
    plane: { x: 180, y: 13, z: -218, heading: Math.PI / 2, pitch: -0.06, roll: 0, speed: 30, throttle: 0.34 },
    cam: { dist: 16, height: 4, lateral: 5 },
    settleFrames: 90,
  },
  // Storm: in the thunderstorm, rain + lightning, ring glowing ahead.
  storm: {
    mission: 4, weather: 'storm',
    plane: { x: -40, y: 55, z: 20, heading: 0.5, pitch: -0.03, roll: 0.2, speed: 46, throttle: 0.8 },
    cam: { dist: 15, height: 5, lateral: 0 },
    settleFrames: 90,
  },
};

export function getShotPreset() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  if (!name || !PRESETS[name]) return null;
  const seed = parseInt(params.get('seed') || '1', 10);
  return { name, seed, ...PRESETS[name] };
}

// Stage the preset on a live game instance. Returns frames to settle.
export function stageShot(game, preset) {
  game.startMission(preset.mission, { quiet: true });
  if (preset.skipRings) {
    // Collect the mission's rings through the real handler to reach the
    // landing step, exactly as a player would.
    const rings = game.mission.currentStep().rings || [];
    for (const i of rings.slice()) game.collectRing(i);
  }
  if (preset.collectRings) {
    // Collect listed rings through the real handler to stage mid-mission
    // progress (score + ring counter alive), exactly as a player would.
    for (const i of preset.collectRings) game.collectRing(i);
  }
  game.setPlane(preset.plane);
  game.setWeather(preset.weather);
  game.setCamera(preset.cam);
  return preset.settleFrames;
}

export function ringTarget(i) { return RINGS[i]; }
