// SENJA MERPATI — arcade flight model: throttle + pitch + bank, coordinated
// turns, stall sink, fuel burn, damage, terrain/water collision and landings.
// Units: metres, seconds, radians. Heading 0 = +X, forward = (cos h, 0, sin h).
import { RUNWAYS, CARRIER, SEA_LEVEL, CRASH_DAMAGE_RATE } from './config.js';
import { heightAt } from './world.js';
import { clamp, angleDiff } from './random.js';

export function createFlight(planeSpec, upgrades) {
  const st = {
    x: RUNWAYS[0].x, y: RUNWAYS[0].height + 1.2, z: RUNWAYS[0].z,
    heading: RUNWAYS[0].heading, pitch: 0, roll: 0,
    speed: 0, throttle: 0, vspeed: 0,
    fuel: planeSpec.fuel, damage: 0,
    grounded: true, landed: false, crashed: false,
    airborne: false, groundSpeed: 0,
  };
  const eff = {
    maxSpeed: planeSpec.maxSpeed * (upgrades.maxSpeed || 1),
    accel: planeSpec.accel * (upgrades.accel || 1),
    turn: planeSpec.turn * (upgrades.turn || 1),
    stall: planeSpec.stall,
    fuelCap: planeSpec.fuel * (upgrades.fuel || 1),
    armor: planeSpec.armor * (upgrades.armor || 1),
    climb: planeSpec.climb * (upgrades.climb || 1),
    floats: planeSpec.floats || upgrades.floats || false,
  };
  st.fuel = eff.fuelCap;

  let windGust = 0;

  function setWind(gust) { windGust = gust; }

  // input: {pitch: -1..1 (up positive), roll: -1..1 (right positive),
  //         throttle: -1..1, brake: bool}, dt seconds, weather wind m/s.
  function update(input, dt, wind) {
    if (st.crashed) return st;

    // Throttle: W/S keys move it; empty tank forces idle.
    st.throttle = clamp(st.throttle + input.throttle * dt * 0.9, 0, 1);
    if (st.fuel <= 0) st.throttle = 0;

    // Speed chases the throttle target; brake bleeds it fast on the ground.
    const target = st.throttle * eff.maxSpeed;
    const rate = st.grounded ? eff.accel * 1.4 : eff.accel * 0.55;
    st.speed += clamp(target - st.speed, -rate * dt * 1.6, rate * dt);
    if (input.brake) st.speed = Math.max(0, st.speed - 26 * dt);
    st.speed = clamp(st.speed, 0, eff.maxSpeed * 1.15);

    // Pitch: nose up only earns climb above stall speed; below it we sink.
    const pitchRate = 0.85 * eff.climb;
    st.pitch = clamp(st.pitch + input.pitch * pitchRate * dt, -0.55, 0.55);
    if (st.grounded && st.speed < eff.stall * 1.05) st.pitch = Math.min(st.pitch, 0.06);

    // Roll: bank in, ease back to level hands-off (stable bush handling).
    const rollRate = 1.5 * eff.turn;
    st.roll = clamp(st.roll + input.roll * rollRate * dt, -1.15, 1.15);
    if (input.roll === 0) st.roll *= Math.exp(-1.1 * dt);
    if (Math.abs(st.roll) < 0.01) st.roll = 0;

    // Coordinated turn: bank turns the heading, faster at speed.
    const turnRate = -Math.sin(st.roll) * (st.speed / eff.maxSpeed) * 0.85 * eff.turn;
    st.heading += turnRate * dt;

    // Crosswind pushes the nose sideways and rolls the wing a little.
    const windPush = (wind + windGust) * dt;
    const wx = Math.sin(st.heading + Math.PI / 2) * windPush * 0.35;
    const wz = -Math.cos(st.heading + Math.PI / 2) * windPush * 0.35;

    // Vertical speed: pitch converts speed to climb; under stall we sink.
    const lift = Math.sin(st.pitch) * st.speed;
    const sink = st.speed < eff.stall ? (eff.stall - st.speed) * 0.55 : 0;
    st.vspeed = lift - sink;

    const fx = Math.cos(st.heading) * Math.cos(st.pitch);
    const fz = Math.sin(st.heading) * Math.cos(st.pitch);
    st.x += (fx * st.speed + wx) * dt;
    st.z += (fz * st.speed + wz) * dt;
    st.y += st.vspeed * dt;
    st.groundSpeed = Math.hypot(fx * st.speed + wx, fz * st.speed + wz);

    // Fuel burn scales with throttle.
    st.fuel = Math.max(0, st.fuel - st.throttle * dt * 0.55);

    // Ground / water contact.
    const ground = heightAt(st.x, st.z);
    const clearance = st.y - ground;
    if (st.grounded) {
      st.y = Math.max(st.y, ground + 1.2);
      if (st.speed > eff.stall * 1.05 && st.pitch > 0.1) {
        st.grounded = false; st.airborne = true; st.landed = false;
      }
    } else {
      // Terrain strike.
      if (clearance < 1.0) {
        if (st.speed > 26 || st.vspeed < -9) {
          st.damage = 100; st.crashed = true;
        } else {
          // Gentle touchdown: heavy damage on rough ground, none on a
          // smooth strip or deck (a good runway landing must not hurt).
          if (!onSmoothSurface()) st.damage = Math.min(100, st.damage + 30);
          st.y = ground + 1.2;
          st.speed *= 0.4;
          st.grounded = true;
          if (st.damage >= 100) st.crashed = true;
        }
      }
      // Water.
      if (st.y <= SEA_LEVEL + 0.4 && ground < SEA_LEVEL) {
        if (eff.floats && st.vspeed > -6 && st.speed < 34) {
          st.y = SEA_LEVEL + 0.4;
          st.speed *= 0.85;
          st.grounded = true; st.landed = true;
        } else {
          st.damage = 100; st.crashed = true;
        }
      }
    }

    // World edge: turn the plane gently back toward the archipelago.
    const r = Math.hypot(st.x, st.z);
    if (r > 470) {
      const want = Math.atan2(-st.z, -st.x);
      st.heading += angleDiff(st.heading, want) * dt * 0.8;
    }
    return st;
  }

  // Landing test for a runway or the carrier deck. Returns the target or null.
  function checkLanding() {
    if (st.crashed || st.grounded === false) {
      // Only count a landing while actually touching down slowly.
      if (st.crashed) return null;
    }
    if (st.speed > 42 || st.vspeed < -7) return null;
    for (const rw of RUNWAYS) {
      const c = Math.cos(rw.heading), s = Math.sin(rw.heading);
      const dx = st.x - rw.x, dz = st.z - rw.z;
      const u = dx * c + dz * s, v = -dx * s + dz * c;
      if (Math.abs(u) < rw.length / 2 && Math.abs(v) < rw.width / 2 + 2
        && Math.abs(st.y - rw.height) < 3.5) {
        return { type: 'runway', id: rw.id };
      }
    }
    const c = Math.cos(CARRIER.heading), s = Math.sin(CARRIER.heading);
    const dx = st.x - CARRIER.x, dz = st.z - CARRIER.z;
    const u = dx * c + dz * s, v = -dx * s + dz * c;
    if (Math.abs(u) < CARRIER.length / 2 && Math.abs(v) < CARRIER.width / 2 + 2
      && Math.abs(st.y - CARRIER.deckY) < 3.5) {
      return { type: 'carrier', id: 'carrier' };
    }
    return null;
  }

  function refuel() {
    st.fuel = eff.fuelCap;
    st.damage = Math.max(0, st.damage - 25);
  }

  // Smooth surfaces (asphalt strips, carrier deck) do not scrape the airframe.
  function onSmoothSurface() {
    for (const rw of RUNWAYS) {
      const c = Math.cos(rw.heading), s = Math.sin(rw.heading);
      const dx = st.x - rw.x, dz = st.z - rw.z;
      const u = dx * c + dz * s, v = -dx * s + dz * c;
      if (Math.abs(u) < rw.length / 2 + 4 && Math.abs(v) < rw.width / 2 + 4
        && Math.abs(st.y - rw.height) < 4) return true;
    }
    const c = Math.cos(CARRIER.heading), s = Math.sin(CARRIER.heading);
    const dx = st.x - CARRIER.x, dz = st.z - CARRIER.z;
    const u = dx * c + dz * s, v = -dx * s + dz * c;
    if (Math.abs(u) < CARRIER.length / 2 + 4 && Math.abs(v) < CARRIER.width / 2 + 4
      && Math.abs(st.y - CARRIER.deckY) < 4) return true;
    return false;
  }

  function applyCrashWear(dt) {
    // Scrapes while sliding on rough ground wear the airframe down.
    if (!st.grounded || st.speed < 4) return;
    if (onSmoothSurface()) return;
    st.damage = Math.min(100, st.damage + CRASH_DAMAGE_RATE * 0.02 * dt);
    if (st.damage >= 100) st.crashed = true;
  }

  return { state: st, eff, update, checkLanding, refuel, applyCrashWear, setWind };
}
