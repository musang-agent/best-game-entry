// Bloomweave levels. Each level is a solved garden written as rows of tile
// characters (see board.js); the game scrambles the turnable tiles at load,
// so the solution is always reachable inside the move limit (par).
export const LEVELS = [
  {
    name: 'First Sprout',
    par: 6,
    rows: [
      'S--3.',
      '...1B',
      '.....',
      '.....',
      '.....',
    ],
  },
  {
    name: 'Two Blooms',
    par: 9,
    rows: [
      'S--3..',
      '...|..',
      '...TB.',
      '...|..',
      '...B..',
    ],
  },
  {
    name: 'Crossroads',
    par: 12,
    rows: [
      'S-3...',
      '..|.|.',
      '..T-B.',
      '..|..1',
      '..B...',
      '......',
    ],
  },
  {
    name: 'The Loop',
    par: 13,
    rows: [
      'S-+-3..',
      '....|..',
      '..B-V..',
      '....|..',
      '....B..',
      '.......',
    ],
  },
  {
    name: 'Twin Gardens',
    par: 16,
    rows: [
      '|..B.1.',
      '...|...',
      '...|...',
      'S--W--B',
      '.......',
      '.-...T.',
      '......2',
    ],
  },
  {
    name: 'The Spiral',
    par: 20,
    rows: [
      'S----3.',
      '.....|.',
      '.2-B.TB',
      '.|...|.',
      '.1---4.',
      '.......',
      '.......',
    ],
  },
  {
    name: 'Crossroads II',
    par: 20,
    rows: [
      '1..B..|',
      '.T.|...',
      '...|...',
      'B--+--B',
      '...|...',
      '...|.|.',
      '-..S..2',
    ],
  },
  {
    name: 'The Grand Bloom',
    par: 26,
    rows: [
      '...B...',
      '1..|..2',
      '...|...',
      'B--+--B',
      '...|..B',
      '.-.|..|',
      'S--W--4',
    ],
  },
];

// ---- Endless Bloom Rush: grow a fresh garden by random walk ---------------

import { N, E, S, W, mulberry32 } from './board.js';

const OPP = { [N]: S, [E]: W, [S]: N, [W]: E };
const STEP = { [N]: [0, -1], [E]: [1, 0], [S]: [0, 1], [W]: [-1, 0] };

function cornerChar(a, b) {
  const pair = [a, b].sort((x, y) => x - y).join(',');
  if (pair === '1,2') return '1';
  if (pair === '2,4') return '2';
  if (pair === '4,8') return '3';
  return '4'; // W,N
}

function teeChar(missing) {
  if (missing === W) return 'T';
  if (missing === N) return 'U';
  if (missing === E) return 'V';
  return 'W';
}

function straightChar(dir) {
  return dir === N || dir === S ? '|' : '-';
}

export function generateEndlessLevel(n) {
  const rng = mulberry32((Date.now() ^ (n * 2654435761)) >>> 0);
  const cols = 7;
  const rows = 7;
  const grid = Array.from({ length: rows }, () => Array(cols).fill('.'));

  // Random walk for the main waterway, never stepping back on itself.
  const startX = Math.floor(rng() * 5);
  const startY = rng() < 0.5 ? 0 : rows - 1;
  const path = [{ x: startX, y: startY }];
  const used = new Set([`${startX},${startY}`]);
  const walkLen = 12 + Math.min(n, 8);
  const dirs = [N, E, S, W];
  while (path.length < walkLen) {
    const cur = path[path.length - 1];
    const options = dirs.filter((d) => {
      const nx = cur.x + STEP[d][0];
      const ny = cur.y + STEP[d][1];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return false;
      if (used.has(`${nx},${ny}`)) return false;
      if (path.length > 1) {
        const prev = path[path.length - 2];
        if (nx === prev.x && ny === prev.y) return false;
      }
      return true;
    });
    if (!options.length) break;
    const d = options[Math.floor(rng() * options.length)];
    const nx = cur.x + STEP[d][0];
    const ny = cur.y + STEP[d][1];
    path.push({ x: nx, y: ny, from: OPP[d], to: d });
    used.add(`${nx},${ny}`);
  }
  if (path.length < 6) return generateEndlessLevel(n + 1);

  // Turn the walk into tiles: corners where it bends, straights where it runs.
  const tileAt = new Map();
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const cur = path[i];
    const next = path[i + 1];
    const inDir = cur.x - prev.x === 1 ? W : cur.x - prev.x === -1 ? E : cur.y - prev.y === 1 ? N : S;
    const outDir = next.x - cur.x === 1 ? E : next.x - cur.x === -1 ? W : next.y - cur.y === 1 ? S : N;
    tileAt.set(
      `${cur.x},${cur.y}`,
      inDir === OPP[outDir] ? straightChar(inDir) : cornerChar(inDir, outDir),
    );
  }

  const blooms = [];
  const end = path[path.length - 1];
  blooms.push(end);

  // One or two short spurs off the main way, each ending in a bloom.
  const spurCount = n >= 3 ? 2 : 1;
  const spurBases = new Set();
  for (let s = 0; s < spurCount; s++) {
    const idx = 2 + Math.floor(rng() * Math.max(1, path.length - 5));
    const base = path[idx];
    const key = `${base.x},${base.y}`;
    if (!tileAt.has(key) || spurBases.has(key)) continue;
    if (blooms.some((b) => b.x === base.x && b.y === base.y)) continue;
    const free = dirs.filter((d) => {
      const nx = base.x + STEP[d][0];
      const ny = base.y + STEP[d][1];
      return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !used.has(`${nx},${ny}`);
    });
    if (!free.length) continue;
    const d = free[Math.floor(rng() * free.length)];
    const bx = base.x + STEP[d][0];
    const by = base.y + STEP[d][1];
    const curChar = tileAt.get(key);
    // Only a straight or a corner can grow a spur; a tee already feeds three ways.
    const inOut = charDirs(curChar);
    if (inOut.length !== 2) continue;
    // The base tile becomes a tee reaching down the spur.
    const missing = [N, E, S, W].find((q) => !inOut.includes(q) && q !== d);
    if (missing === undefined) continue;
    tileAt.set(key, teeChar(missing));
    spurBases.add(key);
    grid[by][bx] = 'B';
    used.add(`${bx},${by}`);
    blooms.push({ x: bx, y: by });
  }

  grid[path[0].y][path[0].x] = 'S';
  grid[end.y][end.x] = 'B';
  for (const [key, ch] of tileAt) {
    const [x, y] = key.split(',').map(Number);
    if (grid[y][x] === '.') grid[y][x] = ch;
  }

  // Scatter decoy tiles and stones over the empty grass.
  const decoys = ['|', '-', '1', '2', '3', '4', 'T', 'U', 'V', 'W', '+'];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] !== '.') continue;
      const r = rng();
      if (r < 0.18) grid[y][x] = decoys[Math.floor(rng() * decoys.length)];
      else if (r < 0.24) grid[y][x] = '#';
    }
  }

  return {
    name: `Bloom Rush ${n}`,
    par: Math.min(30, 14 + 2 * n),
    rows: grid.map((r) => r.join('')),
    endless: true,
  };
}

// The two directions a solution tile character opens to (for spur building).
function charDirs(ch) {
  switch (ch) {
    case '|':
      return [N, S];
    case '-':
      return [E, W];
    case '1':
      return [N, E];
    case '2':
      return [E, S];
    case '3':
      return [S, W];
    case '4':
      return [W, N];
    case '+':
      return [N, E, S, W];
    default:
      return [];
  }
}
