// Bloomweave board model: a grid of garden tiles. Each tile's openings are a
// bitmask (N=1, E=2, S=4, W=8); turning a tile rotates the mask by 90 degrees.
// Water flows from the spring through matching openings and wakes the blooms.
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

const OPPOSITE = { [N]: S, [E]: W, [S]: N, [W]: E };
const DIRS = [N, E, S, W];
const DX = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
const DY = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };

const BASE_OPENINGS = {
  straight: N | S,
  corner: N | E,
  tee: N | E | S,
  cross: N | E | S | W,
  source: N | E | S | W,
  bloom: N | E | S | W,
  rock: 0,
  empty: 0,
};

export const PIPE_TYPES = ['straight', 'corner', 'tee', 'cross'];
export const ROT_PERIOD = { straight: 2, corner: 4, tee: 4, cross: 1 };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rotate a 4-bit opening mask clockwise by `turns` quarter turns.
export function rotateMask(mask, turns) {
  let m = mask;
  const t = ((turns % 4) + 4) % 4;
  for (let i = 0; i < t; i++) {
    m = ((m << 1) & 0b1111) | ((m >> 3) & 1);
  }
  return m;
}

export function openingsOf(cell) {
  return rotateMask(BASE_OPENINGS[cell.type] || 0, cell.rot);
}

export function isRotatable(cell) {
  return PIPE_TYPES.includes(cell.type);
}

// Level rows are strings. One character per cell:
//   '.' empty grass   '#' rock        'S' spring      'B' bloom
//   '|' straight N-S  '-' straight E-W
//   '1' corner N-E    '2' corner E-S  '3' corner S-W  '4' corner W-N
//   'T' tee N-E-S     'U' tee E-S-W   'V' tee S-W-N   'W' tee W-N-E
//   '+' cross
const CHAR_TILES = {
  '|': ['straight', 0],
  '-': ['straight', 1],
  1: ['corner', 0],
  2: ['corner', 1],
  3: ['corner', 2],
  4: ['corner', 3],
  T: ['tee', 0],
  U: ['tee', 1],
  V: ['tee', 2],
  W: ['tee', 3],
  '+': ['cross', 0],
};

export function parseLevel(def) {
  const rows = def.rows.length;
  const cols = def.rows[0].length;
  const cells = [];
  let source = null;
  const blooms = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = def.rows[y][x];
      let cell;
      if (ch === '.') cell = { type: 'empty', rot: 0 };
      else if (ch === '#') cell = { type: 'rock', rot: 0 };
      else if (ch === 'S') cell = { type: 'source', rot: 0 };
      else if (ch === 'B') cell = { type: 'bloom', rot: 0 };
      else {
        const spec = CHAR_TILES[ch];
        if (!spec) throw new Error(`unknown tile char ${JSON.stringify(ch)} at ${x},${y}`);
        cell = { type: spec[0], rot: spec[1] };
      }
      cell.x = x;
      cell.y = y;
      cell.solRot = cell.rot;
      cell.lit = false;
      cells.push(cell);
      if (cell.type === 'source') source = cell;
      if (cell.type === 'bloom') blooms.push(cell);
    }
  }
  return { name: def.name, par: def.par, cols, rows, cells, source, blooms, endless: !!def.endless };
}

export function cellAt(board, x, y) {
  if (x < 0 || y < 0 || x >= board.cols || y >= board.rows) return null;
  return board.cells[y * board.cols + x];
}

// Flood water from the spring. Pipes pass it on; blooms drink it and stop it.
// Returns how many blooms are lit.
export function computeLit(board) {
  for (const c of board.cells) c.lit = false;
  if (!board.source) return 0;
  const queue = [board.source];
  board.source.lit = true;
  const seen = new Set([board.source]);
  let litBlooms = 0;
  while (queue.length) {
    const cur = queue.shift();
    const open = openingsOf(cur);
    for (const d of DIRS) {
      if (!(open & d)) continue;
      const nb = cellAt(board, cur.x + DX[d], cur.y + DY[d]);
      if (!nb || seen.has(nb)) continue;
      if (!(openingsOf(nb) & OPPOSITE[d])) continue;
      if (nb.type === 'empty' || nb.type === 'rock') continue;
      nb.lit = true;
      seen.add(nb);
      if (nb.type === 'bloom') litBlooms++;
      else queue.push(nb);
    }
  }
  return litBlooms;
}

export function isSolved(board) {
  return board.blooms.length > 0 && board.blooms.every((b) => b.lit);
}

export function rotateTile(board, x, y) {
  const cell = cellAt(board, x, y);
  if (!cell || !isRotatable(cell)) return false;
  cell.rot = (cell.rot + 1) % 4;
  return true;
}

// Fewest quarter-turns that return every tile to its solution angle.
export function rotationsToSolve(board) {
  let total = 0;
  for (const c of board.cells) {
    if (!isRotatable(c)) continue;
    const period = ROT_PERIOD[c.type];
    total += (((c.solRot - c.rot) % period) + period) % period;
  }
  return total;
}

// Shuffle the turnable tiles into a fresh puzzle: far enough from solved to
// be interesting, close enough to be solvable inside the move limit.
export function scrambleBoard(board, rng, par) {
  const rotatables = board.cells.filter(isRotatable);
  for (let attempt = 0; attempt < 400; attempt++) {
    for (const c of rotatables) {
      c.rot = Math.floor(rng() * ROT_PERIOD[c.type]);
    }
    computeLit(board);
    const needed = rotationsToSolve(board);
    if (!isSolved(board) && needed >= 2 && needed <= par - 2) return true;
  }
  return false;
}
