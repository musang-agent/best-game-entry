// Bloomweave bootstrap: canvas setup, game loop, mouse + keyboard input,
// and a small staging hook the screenshot script uses to pose each screen.
import { Game, SCREEN } from './state.js';
import { draw, CANVAS_W, CANVAS_H, layoutFor, pixelToCell } from './render.js';
import { cellAt, computeLit, isSolved } from './board.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const game = new Game();

function buttonAt(px, py) {
  for (const b of game.uiButtons) {
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b;
  }
  return null;
}

function doAction(action) {
  if (action === 'restart') game.restart();
  else if (action === 'menu') game.toTitle();
  else if (action === 'sound') game.sound.muted = !game.sound.muted;
  else if (action === 'next') game.nextLevel();
  else if (action === 'endless') game.playEndless();
  else if (action === 'again') game.playAgain();
}

canvas.addEventListener('click', (ev) => {
  game.sound.ensure();
  const rect = canvas.getBoundingClientRect();
  const px = ((ev.clientX - rect.left) / rect.width) * CANVAS_W;
  const py = ((ev.clientY - rect.top) / rect.height) * CANVAS_H;
  if (game.state === SCREEN.TITLE) {
    game.startLevel(0);
    return;
  }
  const btn = buttonAt(px, py);
  if (btn) {
    doAction(btn.action);
    return;
  }
  if (game.state === SCREEN.PLAY && game.board) {
    const lay = layoutFor(game.board);
    const { x, y } = pixelToCell(lay, px, py);
    game.cursor = { x, y, visible: true };
    game.rotateAt(x, y);
  } else if (game.state === SCREEN.CLEAR) {
    game.nextLevel();
  }
});

canvas.addEventListener('mousemove', (ev) => {
  const rect = canvas.getBoundingClientRect();
  const px = ((ev.clientX - rect.left) / rect.width) * CANVAS_W;
  const py = ((ev.clientY - rect.top) / rect.height) * CANVAS_H;
  if (game.state === SCREEN.PLAY && game.board) {
    const lay = layoutFor(game.board);
    const { x, y } = pixelToCell(lay, px, py);
    const cell = cellAt(game.board, x, y);
    game.hover = cell ? { x, y } : null;
  } else {
    game.hover = null;
  }
});

window.addEventListener('keydown', (ev) => {
  if (ev.key === 'm' || ev.key === 'M') {
    game.sound.muted = !game.sound.muted;
    return;
  }
  if (game.state === SCREEN.TITLE) {
    if (ev.key === 'Enter' || ev.key === ' ') game.startLevel(0);
    return;
  }
  if (ev.key === 'Escape') {
    game.toTitle();
    return;
  }
  if (ev.key === 'r' || ev.key === 'R') {
    if (game.state === SCREEN.WIN) game.playAgain();
    else game.restart();
    return;
  }
  if (game.state === SCREEN.CLEAR && (ev.key === 'n' || ev.key === 'N' || ev.key === 'Enter')) {
    game.nextLevel();
    return;
  }
  if (game.state === SCREEN.WIN && (ev.key === 'e' || ev.key === 'E')) {
    game.playEndless();
    return;
  }
  if (game.state !== SCREEN.PLAY || !game.board) return;
  const cur = game.cursor;
  if (ev.key.startsWith('Arrow')) {
    ev.preventDefault();
    cur.visible = true;
    if (ev.key === 'ArrowLeft') cur.x = Math.max(0, cur.x - 1);
    if (ev.key === 'ArrowRight') cur.x = Math.min(game.board.cols - 1, cur.x + 1);
    if (ev.key === 'ArrowUp') cur.y = Math.max(0, cur.y - 1);
    if (ev.key === 'ArrowDown') cur.y = Math.min(game.board.rows - 1, cur.y + 1);
  } else if (ev.key === ' ' || ev.key === 'Enter') {
    ev.preventDefault();
    game.sound.ensure();
    game.rotateAt(cur.x, cur.y);
  }
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  draw(ctx, game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Staging hook for screenshots: pose a screen without playing through it.
window.__bw = {
  game,
  stage(name) {
    if (name === 'title') {
      game.toTitle();
      return;
    }
    if (name === 'play') {
      // Level 2, half solved: one bloom awake, one still asleep.
      game.startLevel(1);
      const set = (x, y, rot) => {
        const c = cellAt(game.board, x, y);
        if (c) c.rot = rot;
      };
      set(1, 0, 1);
      set(2, 0, 1);
      set(3, 0, 2);
      set(3, 1, 0);
      set(3, 2, 0);
      set(3, 3, 1); // south branch still broken: the lower bloom sleeps
      game.movesLeft = game.board.par - 3;
      game.score = 100;
      computeLit(game.board);
      game.state = SCREEN.PLAY;
      return;
    }
    if (name === 'clear') {
      game.startLevel(0);
      for (const c of game.board.cells) c.rot = c.solRot;
      computeLit(game.board);
      game.movesLeft = 2;
      game.clearBonus = 50;
      game.score = 250;
      game.state = SCREEN.CLEAR;
      return;
    }
    if (name === 'win') {
      game.score = 2450;
      game.best = 2450;
      game.state = SCREEN.WIN;
      return;
    }
    if (name === 'over') {
      game.startLevel(0);
      game.movesLeft = 0;
      game.state = SCREEN.OVER;
    }
  },
};
