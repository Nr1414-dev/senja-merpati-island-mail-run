// SENJA MERPATI — the world: golden-hour archipelago.
// Terrain heightmap (shared with flight collision), sea, sky dome, sun, clouds,
// runways carved flat into the islands, carrier deck, volcano + smoke, houses.
import * as THREE from 'three';
import { ISLANDS, RUNWAYS, CARRIER, WORLD_SEED } from './config.js';
import { makeNoise2D, mulberry32, clamp, lerp } from './random.js';

const noise = makeNoise2D(WORLD_SEED + 7);

// Gaussian island bump + crater dip for the volcano + sea-floor noise.
function islandHeight(x, z) {
  let h = -6;
  for (const isl of ISLANDS) {
    const dx = x - isl.x, dz = z - isl.z;
    const d2 = dx * dx + dz * dz;
    const r = isl.radius;
    const bump = isl.peak * Math.exp(-(d2 / (r * r)) * 2.4);
    h += bump;
    if (isl.kind === 'volcano') {
      h -= 26 * Math.exp(-(d2 / (22 * 22)) * 2.0); // crater bowl
      h += 10 * Math.exp(-(d2 / (r * r)) * 5.0); // steep cone shoulder
    }
  }
  h += noise(x * 0.012, z * 0.012) * 3.5;
  return h;
}

// Blend the terrain flat where a runway sits, so landings are possible.
function flattenAt(x, z, h) {
  for (const rw of RUNWAYS) {
    const c = Math.cos(rw.heading), s = Math.sin(rw.heading);
    const dx = x - rw.x, dz = z - rw.z;
    const u = dx * c + dz * s; // along runway
    const v = -dx * s + dz * c; // across runway
    const au = Math.abs(u), av = Math.abs(v);
    if (au < rw.length / 2 + 16 && av < rw.width / 2 + 16) {
      const wu = clamp((rw.length / 2 + 16 - au) / 16, 0, 1);
      const wv = clamp((rw.width / 2 + 16 - av) / 16, 0, 1);
      const w = Math.min(wu, wv);
      h = lerp(h, rw.height, w * w * (3 - 2 * w));
    }
  }
  return h;
}

// The one height function everything uses: terrain mesh AND collision.
export function heightAt(x, z) {
  return flattenAt(x, z, islandHeight(x, z));
}

function terrainColor(x, z, h) {
  const isl = ISLANDS[2];
  const dv = Math.hypot(x - isl.x, z - isl.z);
  const slope = Math.abs(heightAt(x + 2, z) - heightAt(x - 2, z)) / 4
    + Math.abs(heightAt(x, z + 2) - heightAt(x, z - 2)) / 4;
  const c = new THREE.Color();
  if (dv < isl.radius * 0.75 && h > 6) {
    // Volcano: dark ash and rock.
    c.setHex(0x3a3230).lerp(new THREE.Color(0x5a463c), clamp(h / 90, 0, 1));
    if (dv < 20) c.setHex(0x241f1c);
  } else if (h < 1.4) {
    c.setHex(0xd9b380); // sand beach
  } else if (slope > 0.55 || h > 20) {
    c.setHex(0x6b5a4a); // rock
  } else {
    c.setHex(0x4d7a3a).lerp(new THREE.Color(0x7d9b4a), clamp(h / 24, 0, 1));
  }
  return c;
}

function makeSkyTexture() {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 256;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#5a3a7a'); // dusk purple, top
  grad.addColorStop(0.35, '#c65a6a'); // pink band
  grad.addColorStop(0.55, '#f07a3e'); // orange
  grad.addColorStop(0.72, '#ffc46b'); // golden horizon
  grad.addColorStop(0.75, '#8a5a3a'); // below horizon
  grad.addColorStop(1.0, '#2a1a22');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRunway(rw) {
  const group = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(rw.length, 0.7, rw.width),
    new THREE.MeshLambertMaterial({ color: 0x2b2f36 }),
  );
  strip.position.y = rw.height - 0.35;
  group.add(strip);
  // Centreline dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f0e1 });
  for (let i = -3; i <= 3; i++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 0.9), dashMat);
    dash.position.set(i * 17, rw.height + 0.08, 0);
    group.add(dash);
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    for (let k = -1; k <= 1; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 3.2), dashMat);
      bar.position.set(end * (rw.length / 2 - 5), rw.height + 0.08, k * 4.4);
      group.add(bar);
    }
  }
  // Amber edge lights, lit so the strip reads at dusk.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc233 });
  for (let i = -5; i <= 5; i++) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lightMat);
      lamp.position.set(i * 12, rw.height + 0.5, side * (rw.width / 2 + 0.8));
      group.add(lamp);
    }
  }
  group.position.set(rw.x, 0, rw.z);
  group.rotation.y = -rw.heading;
  return group;
}

function makeCarrier() {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(CARRIER.length, 5, CARRIER.width),
    new THREE.MeshLambertMaterial({ color: 0x3a4046 }),
  );
  hull.position.y = 0.6;
  group.add(hull);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(CARRIER.length, 0.7, CARRIER.width),
    new THREE.MeshLambertMaterial({ color: 0x24282d }),
  );
  deck.position.y = CARRIER.deckY - 0.35;
  group.add(deck);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f0e1 });
  const line = new THREE.Mesh(new THREE.BoxGeometry(CARRIER.length - 8, 0.1, 0.8), lineMat);
  line.position.y = CARRIER.deckY + 0.08;
  group.add(line);
  const circle = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 5.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc233, side: THREE.DoubleSide }),
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(-CARRIER.length / 2 + 12, CARRIER.deckY + 0.08, 0);
  group.add(circle);
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(7, 7, 4),
    new THREE.MeshLambertMaterial({ color: 0x4a5258 }),
  );
  tower.position.set(6, CARRIER.deckY + 3.5, -CARRIER.width / 2 + 2.6);
  group.add(tower);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0x2b2f36 }),
  );
  mast.position.set(6, CARRIER.deckY + 10, -CARRIER.width / 2 + 2.6);
  group.add(mast);
  group.position.set(CARRIER.x, 0, CARRIER.z);
  group.rotation.y = -CARRIER.heading;
  return group;
}

function scatterProps(scene) {
  const rand = mulberry32(WORLD_SEED + 21);
  const home = ISLANDS[0];
  // Houses near the home runway: white walls, terracotta pyramid roofs.
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xf5efe0 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xb5502e });
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2;
    const r = 34 + rand() * 78;
    const x = home.x + Math.cos(a) * r;
    const z = home.z + Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h < 2.5 || h > 16) continue;
    if (Math.abs(x - RUNWAYS[0].x) < 85 && Math.abs(z - RUNWAYS[0].z) < 22) continue;
    const g = new THREE.Group();
    const w = 5 + rand() * 3;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, 3.4, w), wallMat);
    walls.position.y = 1.7;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 2.6, 4), roofMat);
    roof.position.y = 4.7;
    roof.rotation.y = Math.PI / 4;
    g.add(walls, roof);
    g.position.set(x, h - 0.3, z);
    g.rotation.y = rand() * Math.PI;
    scene.add(g);
  }
  // Palm-ish trees: trunk + cone canopy, on both green islands.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f6b3a });
  for (const isl of [ISLANDS[0], ISLANDS[1]]) {
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const r = 30 + rand() * (isl.radius - 42);
      const x = isl.x + Math.cos(a) * r;
      const z = isl.z + Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h < 2 || h > 15) continue;
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 4.5, 6), trunkMat);
      trunk.position.y = 2.2;
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5, 7), leafMat);
      top.position.y = 6.4;
      g.add(trunk, top);
      g.position.set(x, h - 0.2, z);
      scene.add(g);
    }
  }
  // Lighthouse on Pulau Karang's east point.
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3, 16, 10),
    new THREE.MeshLambertMaterial({ color: 0xf5f0e1 }),
  );
  tower.position.y = 8;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(2.35, 2.35, 2.4, 10),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  band.position.y = 11;
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.y = 17;
  lh.add(tower, band, lamp);
  lh.position.set(ISLANDS[1].x + 78, heightAt(ISLANDS[1].x + 78, ISLANDS[1].z - 30), ISLANDS[1].z - 30);
  scene.add(lh);
}

export function buildWorld(scene) {
  const rng = mulberry32(WORLD_SEED + 99);

  // Sky dome: vertical gradient texture on an inverted sphere.
  const skyMat = new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(950, 28, 18),
    skyMat,
  );
  scene.add(sky);

  // Low golden sun disc + halo.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(30, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
  );
  sun.position.set(-680, 95, -320);
  sun.lookAt(0, 20, 0);
  scene.add(sun);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(58, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.35, fog: false }),
  );
  halo.position.set(-682, 95, -322);
  halo.lookAt(0, 20, 0);
  scene.add(halo);

  // Terrain: displaced plane with vertex colours.
  const size = 1000, seg = 110;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const c = terrainColor(x, z, h);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  scene.add(terrain);

  // Sea.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1900, 1900),
    new THREE.MeshLambertMaterial({ color: 0x1d5a73 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0.15;
  scene.add(sea);

  // Volcano crater glow.
  const crater = new THREE.Mesh(
    new THREE.CircleGeometry(13, 24),
    new THREE.MeshBasicMaterial({ color: 0xff5a1e }),
  );
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(ISLANDS[2].x, heightAt(ISLANDS[2].x, ISLANDS[2].z) + 0.6, ISLANDS[2].z);
  scene.add(crater);

  // Runways + carrier.
  for (const rw of RUNWAYS) scene.add(makeRunway(rw));
  scene.add(makeCarrier());
  scatterProps(scene);

  // Clouds: flattened white blobs, drifting.
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffe8d8, transparent: true, opacity: 0.88, emissive: 0xcc8866, emissiveIntensity: 0.25,
  });
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(9 + rng() * 10, 10, 8), cloudMat);
      s.position.set((rng() - 0.5) * 26, (rng() - 0.5) * 3, (rng() - 0.5) * 10);
      s.scale.y = 0.38;
      g.add(s);
    }
    g.position.set((rng() - 0.5) * 900, 95 + rng() * 70, (rng() - 0.5) * 900);
    g.userData.speed = 1.2 + rng() * 1.6;
    clouds.push(g);
    scene.add(g);
  }

  // Volcano smoke: grey puffs rising from the crater, looping.
  const smoke = [];
  const smokeMat = new THREE.MeshLambertMaterial({
    color: 0x8a8580, transparent: true, opacity: 0.5,
  });
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(4 + rng() * 4, 8, 6), smokeMat);
    s.userData.phase = rng();
    s.scale.y = 0.6;
    smoke.push(s);
    scene.add(s);
  }

  // Lights: warm low sun + soft hemisphere fill.
  const sunLight = new THREE.DirectionalLight(0xffd9a0, 2.3);
  sunLight.position.set(-320, 170, -140);
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x2a3a55, 0.95);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xf2a65a, 150, 760);

  function update(dt, elapsed) {
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 480) c.position.x = -480;
    }
    for (const s of smoke) {
      const p = (s.userData.phase + elapsed * 0.03) % 1;
      s.position.set(
        ISLANDS[2].x + Math.sin(p * 9) * 4,
        heightAt(ISLANDS[2].x, ISLANDS[2].z) + 6 + p * 55,
        ISLANDS[2].z + Math.cos(p * 7) * 4,
      );
      const sc = 0.7 + p * 1.6;
      s.scale.set(sc, sc * 0.6, sc);
      s.material.opacity = 0.55 * (1 - p);
    }
  }

  return { update, sunLight, hemi, skyMat };
}
