// SENJA MERPATI — HUD and menus: lit instruments (ALT/SPD/HDG), fuel + damage
// bars, compass tape, waypoint arrow, mission panel, title / pause / end screens.
import { PLANES, MISSIONS, UPGRADES } from './config.js';
import { clamp } from './random.js';

const $ = (id) => document.getElementById(id);

function compassLetter(deg) {
  const dirs = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

export function createHud(callbacks) {
  const hud = $('hud');
  const els = {
    alt: $('hud-alt'), spd: $('hud-spd'), hdg: $('hud-hdg'), tape: $('hud-tape'),
    fuel: $('hud-fuel-fill'), fuelText: $('hud-fuel-text'),
    dmg: $('hud-dmg-fill'), thr: $('hud-thr-fill'),
    mission: $('hud-mission'), objective: $('hud-objective'),
    wpArrow: $('hud-wp-arrow'), wpDist: $('hud-wp-dist'),
    score: $('hud-score'), coins: $('hud-coins'), timer: $('hud-timer'),
    toast: $('hud-toast'), msg: $('hud-center-msg'),
  };
  let toastTimer = 0;

  function show() { hud.style.display = 'block'; }
  function hide() { hud.style.display = 'none'; }

  function toast(text, ms = 2600) {
    els.toast.textContent = text;
    els.toast.style.opacity = '1';
    toastTimer = ms;
  }

  function centerMsg(text) {
    els.msg.textContent = text;
    els.msg.style.opacity = '1';
    setTimeout(() => { els.msg.style.opacity = '0'; }, 1800);
  }

  function update(f, mission, target, dt) {
    if (toastTimer > 0) {
      toastTimer -= dt * 1000;
      if (toastTimer <= 0) els.toast.style.opacity = '0';
    }
    els.alt.textContent = `${Math.max(0, Math.round(f.y))} m`;
    els.spd.textContent = `${Math.round(f.speed * 3.6)} km/h`;
    const deg = ((f.heading * 180 / Math.PI) % 360 + 360) % 360;
    els.hdg.textContent = `${String(Math.round(deg)).padStart(3, '0')}° ${compassLetter(deg)}`;
    // Compass tape: ticks slide with heading.
    let ticks = '';
    for (let d = -60; d <= 60; d += 15) {
      const hd = Math.round((deg + d) / 15) * 15;
      const norm = ((hd % 360) + 360) % 360;
      const label = norm % 90 === 0 ? ['U', 'T', 'S', 'B'][norm / 90] : String(norm);
      ticks += `<span style="left:${50 + d * 0.9}%">${label}</span>`;
    }
    els.tape.innerHTML = ticks;
    const fuelPct = clamp(f.fuel, 0, 100);
    els.fuel.style.width = `${fuelPct}%`;
    els.fuelText.textContent = `BBM ${Math.round(fuelPct)}%`;
    els.fuel.style.background = fuelPct < 25 ? '#e23b2e' : '#ffc233';
    els.dmg.style.width = `${clamp(f.damage, 0, 100)}%`;
    els.thr.style.width = `${Math.round(f.throttle * 100)}%`;
    els.score.textContent = `Skor ${mission ? mission.score : 0}`;
    els.timer.textContent = mission && mission.timeLeft > 0
      ? `⏱ ${Math.ceil(mission.timeLeft)} dtk` : '';
    if (mission) {
      els.objective.textContent = mission.stepLabel;
      els.mission.textContent = `${mission.currentStep ? '' : ''}${$('hud-mission').dataset.name || ''}`;
    }
    if (target) {
      const dx = target.x - f.x, dz = target.z - f.z;
      const dist = Math.hypot(dx, dz);
      const bearing = Math.atan2(dz, dx);
      const rel = ((bearing - f.heading) * 180 / Math.PI + 540) % 360 - 180;
      els.wpArrow.textContent = rel > 25 ? '➤' : rel < -25 ? '⬅' : '⬆';
      els.wpArrow.style.transform = `rotate(${clamp(rel, -90, 90)}deg)`;
      els.wpDist.textContent = dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`;
    } else {
      els.wpArrow.textContent = '';
      els.wpDist.textContent = '';
    }
  }

  function setMissionName(name) {
    $('hud-mission').dataset.name = name;
    $('hud-mission').textContent = name;
  }
  function setCoins(n) { els.coins.textContent = `✉ ${n}`; }

  // --- Title screen: plane select + mission select + controls ---
  function buildTitle(state) {
    const planesEl = $('plane-list');
    planesEl.innerHTML = '';
    PLANES.forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'card' + (state.planeIndex === i ? ' selected' : '');
      b.innerHTML = `<b>${p.name}</b><span>${p.blurb}</span><span>Max ${Math.round(p.maxSpeed * 3.6)} km/h · BBM ${p.fuel}</span>`;
      b.onclick = () => { state.planeIndex = i; callbacks.selectPlane(i); buildTitle(state); };
      planesEl.appendChild(b);
    });
    const missionsEl = $('mission-list');
    missionsEl.innerHTML = '';
    MISSIONS.forEach((m, i) => {
      const b = document.createElement('button');
      b.className = 'card' + (state.missionIndex === i ? ' selected' : '');
      b.innerHTML = `<b>${i + 1}. ${m.name}</b><span>${m.brief}</span><span>Hadiah ${m.reward} koin · Par ${m.par} dtk</span>`;
      b.onclick = () => { state.missionIndex = i; callbacks.selectMission(i); buildTitle(state); };
      missionsEl.appendChild(b);
    });
    $('coins-title').textContent = `Koin pos: ${state.coins}`;
    buildShop(state);
  }

  function buildShop(state) {
    const shopEl = $('shop-list');
    shopEl.innerHTML = '';
    UPGRADES.forEach((u) => {
      const owned = state.upgrades[u.id];
      const b = document.createElement('button');
      b.className = 'shop-item' + (owned ? ' owned' : '');
      b.innerHTML = `<b>${u.name}</b><span>${u.desc}</span><span>${owned ? 'DIPASANG ✓' : `${u.cost} koin`}</span>`;
      b.onclick = () => callbacks.buyUpgrade(u);
      shopEl.appendChild(b);
    });
  }

  function showTitle() {
    $('screen-title').style.display = 'flex';
    $('screen-pause').style.display = 'none';
    $('screen-end').style.display = 'none';
    hide();
  }
  function showPause() { $('screen-pause').style.display = 'flex'; }
  function hidePause() { $('screen-pause').style.display = 'none'; }
  function showEnd({ title, lines, win }) {
    $('end-title').textContent = title;
    $('end-title').style.color = win ? '#ffc233' : '#ff6a5e';
    $('end-lines').innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
    $('screen-end').style.display = 'flex';
    hide();
  }
  function hideEnd() { $('screen-end').style.display = 'none'; }

  $('btn-start').onclick = () => callbacks.start();
  $('btn-resume').onclick = () => callbacks.resume();
  $('btn-restart').onclick = () => callbacks.restart();
  $('btn-menu').onclick = () => callbacks.toMenu();
  $('btn-again').onclick = () => callbacks.restart();
  $('btn-end-menu').onclick = () => callbacks.toMenu();

  return {
    show, hide, toast, centerMsg, update, setMissionName, setCoins,
    buildTitle, buildShop, showTitle, showPause, hidePause, showEnd, hideEnd,
  };
}
