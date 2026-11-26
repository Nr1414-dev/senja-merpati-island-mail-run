// SENJA MERPATI — Island Mail Run: all tunable game data in one place.
// Planes, missions, upgrades, weather presets, world layout. Numbers here are
// the concrete systems the title and dossier advertise: 5 missions, 12 rings,
// 3 islands, 2 runways, 1 carrier deck, 3 planes, 4 weather events, 9 upgrades.
export const WORLD_SEED = 20261126;
export const SEA_LEVEL = 0;
export const WORLD_HALF = 450;

// --- Islands: centre x/z, radius, peak height, flatten height for runways ---
export const ISLANDS = [
  { name: 'Pulau Merpati', x: -170, z: -90, radius: 150, peak: 26, kind: 'home' },
  { name: 'Pulau Karang', x: 180, z: -130, radius: 112, peak: 20, kind: 'strip' },
  { name: 'Pulau Api', x: 30, z: 230, radius: 135, peak: 88, kind: 'volcano' },
];

// --- Runways: flat strips carved into the terrain (heading in radians, 0 = +X) ---
export const RUNWAYS = [
  { id: 'merpati', island: 0, x: -170, z: -55, heading: 0, length: 140, width: 16, height: 4 },
  { id: 'karang', island: 1, x: 180, z: -130, heading: Math.PI / 2, length: 110, width: 14, height: 3 },
];

// --- Carrier deck floating in the open sea between the islands ---
export const CARRIER = { x: 70, z: 80, heading: 0.6, length: 64, width: 15, deckY: 3.2 };

// --- The 12 golden rings (hand-placed, fixed coordinates for deterministic shots) ---
export const RINGS = [
  { x: -90, y: 34, z: -70 },
  { x: -10, y: 42, z: -95 },
  { x: 70, y: 38, z: -140 },
  { x: 150, y: 30, z: -110 },
  { x: 205, y: 44, z: -40 },
  { x: 120, y: 52, z: 30 },
  { x: 70, y: 26, z: 80 },
  { x: -20, y: 40, z: 120 },
  { x: 30, y: 68, z: 200 },
  { x: -60, y: 46, z: 160 },
  { x: -140, y: 36, z: 40 },
  { x: -190, y: 30, z: -20 },
];

// --- The 3 flyable planes ---
export const PLANES = [
  {
    id: 'merpati',
    name: 'Merpati Bush',
    blurb: 'Slow, sturdy, big tank. Forgiving on short strips.',
    color: 0xffd23e, accent: 0x2e6b34,
    maxSpeed: 52, accel: 9, turn: 0.55, stall: 14, fuel: 100, armor: 1.5, climb: 0.9,
  },
  {
    id: 'kilat',
    name: 'Pos Kilat',
    blurb: 'Fast mail plane. Small tank, sharp turns, big speed.',
    color: 0xe23b2e, accent: 0xf5f0e1,
    maxSpeed: 78, accel: 13, turn: 0.8, stall: 20, fuel: 70, armor: 1.0, climb: 1.25,
  },
  {
    id: 'albatros',
    name: 'Albatros Amfibi',
    blurb: 'Floats: lands on water as well as strips. Steady all-rounder.',
    color: 0x2e86c1, accent: 0xffc233,
    maxSpeed: 60, accel: 10, turn: 0.62, stall: 16, fuel: 85, armor: 1.2, climb: 1.0,
    floats: true,
  },
];

// --- Weather presets: 4 events ---
export const WEATHER = {
  clear:   { name: 'Senja Cerah', fog: [150, 760], sun: 2.3, wind: 2, rain: 0, storm: 0, sky: 0xf7a94e, tint: 1.0 },
  crosswind:{ name: 'Angin Silang', fog: [130, 680], sun: 2.0, wind: 9, rain: 0, storm: 0, sky: 0xef9a52, tint: 0.95 },
  rain:    { name: 'Hujan Senja', fog: [90, 480], sun: 1.3, wind: 6, rain: 1, storm: 0, sky: 0x8a6a72, tint: 0.62 },
  storm:   { name: 'Badai Petir', fog: [60, 320], sun: 0.8, wind: 13, rain: 1, storm: 1, sky: 0x4a3a55, tint: 0.42 },
  fog:     { name: 'Kabut Laut', fog: [40, 260], sun: 1.0, wind: 3, rain: 0, storm: 0, sky: 0xd9a06a, tint: 0.8 },
};

// --- The 5 missions (sorties), each with different goals ---
export const MISSIONS = [
  {
    id: 'surat-pagi', name: 'Surat Pagi', weather: 'clear',
    brief: 'Antar surat Pulau Merpati ke Pulau Karang. Lewati 3 ring, lalu mendarat di landasan Karang.',
    steps: [
      { type: 'rings', rings: [0, 1, 2], label: 'Lewati ring 1-3 menuju Pulau Karang' },
      { type: 'land', target: 'karang', label: 'Mendarat di landasan Pulau Karang' },
    ],
    par: 150, reward: 120,
  },
  {
    id: 'paket-kilat', name: 'Paket Kilat', weather: 'crosswind',
    brief: 'Balapan waktu melawan angin silang: 4 ring, lalu kembali mendarat di Merpati.',
    steps: [
      { type: 'rings', rings: [3, 4, 5, 6], label: 'Lewati ring 4-7 secepat mungkin', time: 120 },
      { type: 'land', target: 'merpati', label: 'Mendarat kembali di Merpati' },
    ],
    par: 120, reward: 160,
  },
  {
    id: 'evakuasi', name: 'Evakuasi Api', weather: 'fog',
    brief: 'Pendaki terjebak di lereng Pulau Api. Terbang rendah melewati titik jemput, lalu evakuasi ke kapal induk.',
    steps: [
      { type: 'flyto', at: { x: 30, y: 46, z: 170 }, radius: 14, label: 'Terbang rendah ke titik jemput di Pulau Api' },
      { type: 'land', target: 'carrier', label: 'Mendarat di dek kapal induk' },
    ],
    par: 180, reward: 200,
  },
  {
    id: 'foto-udara', name: 'Foto Udara', weather: 'clear',
    brief: 'Foto udara kepulauan: lewati 3 gerbang foto pada ketinggian yang tepat.',
    steps: [
      { type: 'rings', rings: [7, 8, 9], label: 'Lewati gerbang foto 8-10 (jaga ketinggian)' },
      { type: 'land', target: 'merpati', label: 'Pulang dan mendarat di Merpati' },
    ],
    par: 170, reward: 150,
  },
  {
    id: 'badai-senja', name: 'Badai Senja', weather: 'storm',
    brief: 'Badai petir di atas laut. 5 ring dalam badai, lalu mendarat di kapal induk.',
    steps: [
      { type: 'rings', rings: [10, 11, 0, 1, 6], label: 'Lewati 5 ring di tengah badai' },
      { type: 'land', target: 'carrier', label: 'Mendarat di dek kapal induk' },
    ],
    par: 200, reward: 260,
  },
];

// --- 9 upgrades, bought with mail-coins earned from missions ---
export const UPGRADES = [
  { id: 'engine', name: 'Mesin Turbo', cost: 80, desc: '+18% kecepatan maks', apply: { maxSpeed: 1.18 } },
  { id: 'tank', name: 'Tangki Besar', cost: 60, desc: '+30% bahan bakar', apply: { fuel: 1.30 } },
  { id: 'wings', name: 'Sayap Lentur', cost: 70, desc: '+20% kelincahan belok', apply: { turn: 1.20 } },
  { id: 'prop', name: 'Baling-Baling Karbon', cost: 50, desc: '+20% akselerasi', apply: { accel: 1.20 } },
  { id: 'lights', name: 'Lampu Pendarat', cost: 40, desc: 'Landasan terlihat dari jauh', apply: { lights: true } },
  { id: 'radio', name: 'Radio Navigasi', cost: 45, desc: 'Panah waypoint selalu aktif', apply: { radio: true } },
  { id: 'armor', name: 'Pelat Baja', cost: 90, desc: '+40% ketahanan benturan', apply: { armor: 1.40 } },
  { id: 'climb', name: 'Sayap Angkat', cost: 65, desc: '+25% daya angkat', apply: { climb: 1.25 } },
  { id: 'floats', name: 'Pelampung Cadangan', cost: 75, desc: 'Semua pesawat bisa mendarat di air', apply: { floats: true } },
];

export const RING_SCORE = 100;
export const LAND_SCORE = 250;
export const MISSION_SCORE = 500;
export const CRASH_DAMAGE_RATE = 55;
