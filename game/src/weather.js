// SENJA MERPATI — weather: 4 events that change light, fog, wind and rain.
// Clear, crosswind, rain and thunderstorm (with lightning) + sea fog.
import * as THREE from 'three';
import { WEATHER } from './config.js';
import { mulberry32, clamp } from './random.js';

export function createWeather(scene, sunLight, hemi, skyMat) {
  let current = WEATHER.clear;
  let rain = null;
  let flashTimer = 0;
  let flash = 0;
  let windGust = 0;
  let gustTimer = 0;
  // Seeded randomness: the same weather sequence every run, so staged
  // screenshots reproduce instead of depending on Math.random.
  const wrand = mulberry32(777);

  // Rain: vertical streaks (LineSegments) around the camera, recycled as they fall.
  // Points read as snow; short lines read as rain.
  function buildRain() {
    const count = 260;
    const pos = new Float32Array(count * 2 * 3);
    const rand = mulberry32(4242);
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * 170;
      const y = rand() * 90;
      const z = (rand() - 0.5) * 170;
      pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x; pos[i * 6 + 4] = y - 2.2; pos[i * 6 + 5] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xaac4d8, transparent: true, opacity: 0.5,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.visible = false;
    lines.frustumCulled = false;
    scene.add(lines);
    return lines;
  }
  rain = buildRain();

  function apply(name) {
    current = WEATHER[name] || WEATHER.clear;
    scene.fog.near = current.fog[0];
    scene.fog.far = current.fog[1];
    scene.fog.color.setHex(current.sky);
    sunLight.intensity = current.sun;
    if (skyMat) skyMat.color.setScalar(current.tint);
    rain.visible = current.rain > 0;
    flash = 0;
    flashTimer = 1.5;
  }

  function update(dt, elapsed, camPos) {
    // Gusts: wind breathes in and out so crosswind landings stay interesting.
    gustTimer -= dt;
    if (gustTimer <= 0) {
      gustTimer = 2.5 + wrand() * 2.5;
      windGust = (wrand() - 0.5) * 2 * current.wind * 0.6;
    }
    // Rain streaks fall and recycle around the camera (pairs of vertices).
    if (rain.visible && camPos) {
      rain.position.set(camPos.x, 0, camPos.z);
      const pos = rain.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 2) {
        let y = pos.getY(i) - dt * 55;
        if (y < 0) y = 85 + wrand() * 5;
        pos.setY(i, y);
        pos.setY(i + 1, y - 2.2);
      }
      pos.needsUpdate = true;
    }
    // Lightning: random flashes that spike the sun light and fog colour.
    if (current.storm) {
      flashTimer -= dt;
      if (flashTimer <= 0) {
        flash = 1;
        flashTimer = 3 + wrand() * 6;
      }
      if (flash > 0) {
        flash = Math.max(0, flash - dt * 3.2);
        sunLight.intensity = current.sun + flash * 5;
        scene.fog.color.setHex(0xcfd8ff).lerp(new THREE.Color(current.sky), 1 - flash);
      }
    }
    // Hemisphere fill follows the storm dimming.
    hemi.intensity = 0.95 * clamp(current.sun / 2.3, 0.35, 1);
  }

  function windNow() { return current.wind + windGust; }

  return { apply, update, windNow, get name() { return current.name; } };
}
