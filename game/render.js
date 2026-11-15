// Bloomweave renderer: everything on one canvas — board, flowers, HUD,
// title and end screens. All art is drawn shapes; no image assets.
import { N, E, S, W, openingsOf, isRotatable } from './board.js';
import { SCREEN } from './state.js';
import { LEVELS } from './levels.js';

export const CANVAS_W = 960;
export const CANVAS_H = 640;

const CREAM = '#f2e6c9';
const CREAM_EDGE = '#d9c69a';
const PIPE_DRY = '#8aa573';
const PIPE_WET = '#f4a900';
const LEAF = '#2f6b3a';
const INK = '#f7f3e3';

export function layoutFor(board) {
  const cell = Math.min(64, Math.floor(430 / board.cols), Math.floor(470 / board.rows));
  return { cell, x0: 36, y0: 104, w: board.cols * cell, h: board.rows * cell };
}

export function pixelToCell(layout, px, py) {
  const x = Math.floor((px - layout.x0) / layout.cell);
  const y = Math.floor((py - layout.y0) / layout.cell);
  return { x, y };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawPipe(ctx, cx, cy, size, open, lit, time) {
  const half = size / 2;
  const reach = half - 2;
  const width = Math.max(10, size * 0.22);
  ctx.lineCap = 'round';
  ctx.strokeStyle = lit ? PIPE_WET : PIPE_DRY;
  ctx.lineWidth = width;
  if (lit) {
    ctx.shadowColor = '#ffb703';
    ctx.shadowBlur = 10 + 6 * Math.sin(time * 4);
  }
  for (const d of [N, E, S, W]) {
    if (!(open & d)) continue;
    const dx = d === E ? reach : d === W ? -reach : 0;
    const dy = d === S ? reach : d === N ? -reach : 0;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx, cy + dy);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // A lit joint glows at the middle.
  if (lit) {
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(cx, cy, width * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBloom(ctx, cx, cy, cell, lit, size, time) {
  const r = size * 0.30;
  if (!lit) {
    // A sleeping bud: a closed green ball with two leaves.
    ctx.fillStyle = '#5d7a5e';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#46603f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#7fae72';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.55, cy + r * 0.45, r * 0.4, r * 0.2, -0.6, 0, Math.PI * 2);
    ctx.ellipse(cx + r * 0.55, cy + r * 0.45, r * 0.4, r * 0.2, 0.6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // An open flower, gently breathing.
  const pulse = 1 + 0.07 * Math.sin(time * 3 + cell.x + cell.y);
  const pr = r * pulse;
  ctx.shadowColor = '#ff6b9d';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ff6b9d';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * pr * 0.62, cy + Math.sin(a) * pr * 0.62, pr * 0.52, pr * 0.34, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(cx, cy, pr * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b3541e';
  ctx.beginPath();
  ctx.arc(cx, cy, pr * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSource(ctx, cx, cy, cell, size, time) {
  const r = size * 0.30;
  const ripple = (time * 0.9 + cell.x * 0.3) % 1;
  ctx.strokeStyle = `rgba(46,196,182,${0.7 * (1 - ripple)})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r * (0.5 + ripple * 0.8), 0, Math.PI * 2);
  ctx.stroke();
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
  grad.addColorStop(0, '#a8e6e0');
  grad.addColorStop(1, '#2ec4b6');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0e2a1d';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.12, r * 0.22, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.2, cy + r * 0.16, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

function drawRock(ctx, cx, cy, size) {
  const r = size * 0.30;
  ctx.fillStyle = '#5b6470';
  roundRect(ctx, cx - r, cy - r * 0.8, r * 2, r * 1.6, 8);
  ctx.fill();
  ctx.fillStyle = '#7d8896';
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.25, r * 0.28, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.35, cy + r * 0.2, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoard(ctx, game) {
  const board = game.board;
  const lay = layoutFor(board);
  const { cell, x0, y0 } = lay;

  // Soil bed behind the tiles.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, x0 - 10, y0 - 10, lay.w + 20, lay.h + 20, 16);
  ctx.fill();

  for (const tile of board.cells) {
    const px = x0 + tile.x * cell;
    const py = y0 + tile.y * cell;
    const cx = px + cell / 2;
    const cy = py + cell / 2;

    if (tile.type === 'empty') {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (tile.type === 'rock') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      roundRect(ctx, px + 3, py + 3, cell - 6, cell - 6, 10);
      ctx.fill();
      drawRock(ctx, cx, cy, cell);
      continue;
    }

    // Tile slab.
    ctx.fillStyle = tile.lit ? '#fbf3d5' : CREAM;
    ctx.strokeStyle = CREAM_EDGE;
    ctx.lineWidth = 1.5;
    roundRect(ctx, px + 3, py + 3, cell - 6, cell - 6, 10);
    ctx.fill();
    ctx.stroke();

    if (tile.type === 'source') drawSource(ctx, cx, cy, tile, cell, game.time);
    else if (tile.type === 'bloom') drawBloom(ctx, cx, cy, tile, tile.lit, cell, game.time);
    else drawPipe(ctx, cx, cy, cell, openingsOf(tile), tile.lit, game.time);
  }

  // Hover + keyboard cursor.
  const focus = game.hover || (game.cursor.visible ? game.cursor : null);
  if (focus && game.state === SCREEN.PLAY) {
    const tile = board.cells.find((c) => c.x === focus.x && c.y === focus.y);
    if (tile && isRotatable(tile)) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      roundRect(ctx, x0 + focus.x * cell + 2, y0 + focus.y * cell + 2, cell - 4, cell - 4, 12);
      ctx.stroke();
    }
  }

  // Petal particles, in tile coordinates.
  for (const p of game.particles) {
    const alpha = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x0 + p.x * cell, y0 + p.y * cell, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return lay;
}

function button(ctx, game, label, x, y, w, h, action, active = true) {
  ctx.fillStyle = active ? '#ffd166' : '#5b6470';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.fillStyle = '#1d2b1f';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  game.uiButtons.push({ label, x, y, w, h, action });
}

function drawSidebar(ctx, game) {
  const x = 500;
  const w = 424;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(ctx, x, 104, w, 470, 16);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const board = game.board;
  const total = board ? board.blooms.length : 0;
  const lit = game.litCount();
  let y = 142;
  ctx.fillStyle = INK;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(board ? board.name : '', x + 24, y);
  y += 28;
  ctx.fillStyle = '#bcd6b0';
  ctx.font = '16px system-ui, sans-serif';
  const levelLabel = game.endlessNum > 0 ? `Bloom Rush ${game.endlessNum}` : `Level ${game.levelIndex + 1} of ${LEVELS.length}`;
  ctx.fillText(levelLabel, x + 24, y);

  y += 44;
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(`${game.movesLeft}`, x + 24, y);
  ctx.fillStyle = INK;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('moves left', x + 96, y);

  y += 42;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = lit === total && total > 0 ? '#ff8fb5' : INK;
  ctx.fillText(`✿  Blooms  ${lit} / ${total}`, x + 24, y);

  y += 40;
  ctx.fillStyle = INK;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`Score  ${game.score}`, x + 24, y);
  ctx.fillStyle = '#bcd6b0';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`Best  ${game.best}`, x + 24, y + 22);

  y += 56;
  ctx.fillStyle = '#bcd6b0';
  ctx.font = '15px system-ui, sans-serif';
  const rules = [
    'Click a pipe tile to turn it.',
    'Water flows from the spring',
    'through joined pipes.',
    'Wake every bloom before',
    'your moves run out.',
  ];
  for (const line of rules) {
    ctx.fillText(line, x + 24, y);
    y += 20;
  }

  button(ctx, game, '↻  Restart  (R)', x + 24, 476, 180, 40, 'restart');
  button(ctx, game, 'Menu  (Esc)', x + 220, 476, 156, 40, 'menu');
  const snd = game.sound.muted ? 'Sound: off (M)' : 'Sound: on (M)';
  button(ctx, game, snd, x + 24, 524, 180, 40, 'sound');
}

function drawHeader(ctx, game) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('✿ Bloomweave', 36, 52);
  ctx.fillStyle = '#bcd6b0';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Turn the pipes · wake every bloom', 300, 50);
  if (game.message && game.time < game.messageUntil) {
    ctx.fillStyle = '#ffe08a';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.message, CANVAS_W / 2, 84);
    ctx.textAlign = 'left';
  }
}

function dimOverlay(ctx) {
  ctx.fillStyle = 'rgba(6,20,12,0.72)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = '#f7f3e3';
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawTitle(ctx, game) {
  // A decorative garden strip across the middle.
  const colors = ['#ff6b9d', '#ffd166', '#2ec4b6', '#f9f871', '#ff9f5a'];
  for (let i = 0; i < 9; i++) {
    const cx = 120 + i * 90;
    const cy = 300 + Math.sin(i * 1.3) * 14;
    ctx.fillStyle = colors[i % colors.length];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16, 13, 8, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#b3541e';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText('✿ Bloomweave', CANVAS_W / 2, 180);
  ctx.fillStyle = INK;
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText('a garden path puzzle', CANVAS_W / 2, 228);

  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#d7e8cb';
  ctx.fillText('Turn the pipe tiles to carry spring water to every bloom.', CANVAS_W / 2, 400);
  ctx.fillText('Each turn costs a move — wake them all before the moves run out.', CANVAS_W / 2, 428);
  ctx.fillText('8 hand-built gardens, then endless Bloom Rush.', CANVAS_W / 2, 456);

  const pulse = 0.75 + 0.25 * Math.sin(game.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('Click or press Enter to play', CANVAS_W / 2, 520);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#bcd6b0';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`Best score: ${game.best}    ·    Mouse + keyboard    ·    M toggles sound`, CANVAS_W / 2, 580);
  ctx.textAlign = 'left';
}

function drawClear(ctx, game) {
  dimOverlay(ctx);
  panel(ctx, 230, 150, 500, 320);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2f6b3a';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('🌸 Level Clear!', 480, 220);
  ctx.fillStyle = '#3a3a2a';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`${game.board.name} — all ${game.board.blooms.length} blooms awake`, 480, 262);
  ctx.fillText(`Moves left: ${game.movesLeft}  ×  25  =  +${game.clearBonus}`, 480, 296);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`Score: ${game.score}`, 480, 340);
  button(ctx, game, 'Next garden  (N)', 330, 380, 300, 48, 'next');
  ctx.fillStyle = '#6b7a5e';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('or press R to replay this garden', 480, 452);
  ctx.textAlign = 'left';
}

function drawOver(ctx, game) {
  dimOverlay(ctx);
  panel(ctx, 230, 150, 500, 320);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8a4b2a';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('The garden faded…', 480, 220);
  ctx.fillStyle = '#3a3a2a';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`Out of moves with ${game.board.blooms.length - game.litCount()} bloom(s) still asleep.`, 480, 262);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`Score: ${game.score}`, 480, 320);
  button(ctx, game, 'Try again  (R)', 330, 370, 300, 48, 'restart');
  ctx.fillStyle = '#6b7a5e';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Tip: a tee can feed two blooms at once.', 480, 448);
  ctx.textAlign = 'left';
}

function drawWin(ctx, game) {
  dimOverlay(ctx);
  panel(ctx, 180, 110, 600, 420);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2f6b3a';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('🌻 Garden Complete!', 480, 190);
  ctx.fillStyle = '#3a3a2a';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('All 8 gardens are in full bloom. You did it!', 480, 232);
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(`Final score: ${game.score}`, 480, 282);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#6b7a5e';
  ctx.fillText(`Best: ${game.best}`, 480, 314);
  button(ctx, game, 'Endless Bloom Rush  (E)', 300, 350, 360, 48, 'endless');
  button(ctx, game, 'Play again  (R)', 300, 412, 360, 48, 'again');
  ctx.textAlign = 'left';
}

export function draw(ctx, game) {
  game.uiButtons = [];
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#123524');
  grad.addColorStop(1, '#0a2015');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (game.state === SCREEN.TITLE) {
    drawTitle(ctx, game);
    return;
  }
  drawHeader(ctx, game);
  drawBoard(ctx, game);
  drawSidebar(ctx, game);
  if (game.state === SCREEN.CLEAR) drawClear(ctx, game);
  else if (game.state === SCREEN.OVER) drawOver(ctx, game);
  else if (game.state === SCREEN.WIN) drawWin(ctx, game);
}
