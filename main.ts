// SENJA MERPATI — Island Mail Run (Node 22, standard library only).
// The hand-in program: it copies this repository's game/ and screenshots/
// beside it into /output and writes /output/dossier.json, the summary the
// judge reads, using the vendored make.fun library. Outside the grader's
// container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program is deterministic: same files in, same bytes out, every run.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

function fail(message) {
  throw new Error(`senja-merpati main.ts: ${message}`);
}

// Guard the platform caps early so a bad local tree fails loudly here,
// exactly where the developer can see it, instead of at the sealed gate.
function checkTree() {
  if (!existsSync(gameDir)) fail('game/ is missing from the repository');
  if (!statSync(join(gameDir, 'index.html')).isFile()) fail('game/index.html is missing');
  let entries = 0;
  let bytes = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const s = statSync(p);
      entries += 1;
      if (s.isDirectory()) walk(p);
      else bytes += s.size;
      if (name.length > 1000) fail(`path too long under game/: ${name}`);
    }
  };
  walk(gameDir);
  if (entries > 993) fail(`game/ holds ${entries} entries, over the 993 cap`);
  if (bytes > 48 * 1024 * 1024) fail(`game/ is ${bytes} bytes, over the 48 MiB cap`);
  if (!existsSync(shotsDir)) fail('screenshots/ is missing from the repository');
  const shots = readdirSync(shotsDir).filter((n) => !n.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) {
    fail(`screenshots/ holds ${shots.length} images, need 3 or 4`);
  }
  for (const n of shots) {
    const s = statSync(join(shotsDir, n));
    if (!s.isFile() || s.size > 256 * 1024) fail(`screenshot ${n} is not a file under 256 KiB`);
  }
}

checkTree();

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
