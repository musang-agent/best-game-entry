// Bloomweave game state: screens, turns, moves, score, particles, input.
import {
  parseLevel,
  computeLit,
  isSolved,
  isRotatable,
  rotateTile,
  cellAt,
  scrambleBoard,
  mulberry32,
} from './board.js';
import { LEVELS, generateEndlessLevel } from './levels.js';
import { SoundBank } from './audio.js';

export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  CLEAR: 'clear',
  OVER: 'over',
  WIN: 'win',
};

export class Game {
  constructor() {
    this.sound = new SoundBank();
    this.state = SCREEN.TITLE;
    this.levelIndex = 0;
    this.board = null;
    this.movesLeft = 0;
    this.score = 0;
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem('bloomweave-best') || 0) || 0;
    } catch (e) {
      this.best = 0;
    }
    this.particles = [];
    this.cursor = { x: 0, y: 0, visible: false };
    this.hover = null;
    this.endlessNum = 0;
    this.endlessScore = 0;
    this.clearBonus = 0;
    this.message = '';
    this.messageUntil = 0;
    this.time = 0;
    this.uiButtons = [];
    this.turnsTaken = 0;
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        window.localStorage.setItem('bloomweave-best', String(this.best));
      } catch (e) {
        /* storage unavailable; best score just lives for this session */
      }
    }
  }

  startLevel(index) {
    this.levelIndex = index;
    this.endlessNum = 0;
    const def = LEVELS[index];
    this.board = parseLevel(def);
    scrambleBoard(this.board, mulberry32((Date.now() ^ (index * 97 + 13)) >>> 0), def.par);
    computeLit(this.board);
    this.movesLeft = def.par;
    this.turnsTaken = 0;
    this.state = SCREEN.PLAY;
    this.message = '';
  }

  startEndless(n) {
    this.endlessNum = n;
    const def = generateEndlessLevel(n);
    this.board = parseLevel(def);
    scrambleBoard(this.board, mulberry32((Date.now() ^ (n * 7919 + 7)) >>> 0), def.par);
    computeLit(this.board);
    this.movesLeft = def.par;
    this.turnsTaken = 0;
    this.state = SCREEN.PLAY;
    this.message = '';
  }

  toTitle() {
    this.state = SCREEN.TITLE;
    this.saveBest();
  }

  restart() {
    if (this.endlessNum > 0) this.startEndless(this.endlessNum);
    else this.startLevel(this.levelIndex);
    this.sound.click();
  }

  litCount() {
    return this.board ? this.board.blooms.filter((b) => b.lit).length : 0;
  }

  // One turn: turn a tile, spend a move, see what wakes up.
  rotateAt(x, y) {
    if (this.state !== SCREEN.PLAY || !this.board) return;
    if (this.movesLeft <= 0) return;
    const cell = cellAt(this.board, x, y);
    if (!cell || !isRotatable(cell)) return;
    const before = this.litCount();
    rotateTile(this.board, x, y);
    this.movesLeft--;
    this.turnsTaken++;
    this.sound.rotate();
    const after = computeLit(this.board);
    const fresh = after - before;
    if (fresh > 0) {
      this.score += fresh * 100 + (fresh - 1) * 50;
      for (const b of this.board.blooms) {
        if (b.lit) this.burst(b.x, b.y);
      }
      this.sound.bloom(fresh);
      this.flash(fresh > 1 ? `${fresh} blooms at once! +${fresh * 100 + (fresh - 1) * 50}` : 'A bloom wakes! +100');
    }
    if (isSolved(this.board)) {
      this.clearBonus = this.movesLeft * 25;
      this.score += this.clearBonus;
      this.saveBest();
      this.state = SCREEN.CLEAR;
      this.sound.clear();
      return;
    }
    if (this.movesLeft <= 0) {
      this.state = SCREEN.OVER;
      this.saveBest();
      this.sound.lose();
    }
  }

  nextLevel() {
    if (this.state !== SCREEN.CLEAR) return;
    this.sound.click();
    if (this.endlessNum > 0) {
      this.startEndless(this.endlessNum + 1);
      return;
    }
    if (this.levelIndex + 1 < LEVELS.length) this.startLevel(this.levelIndex + 1);
    else this.state = SCREEN.WIN;
  }

  playEndless() {
    this.endlessScore = this.score;
    this.startEndless(1);
  }

  playAgain() {
    this.score = 0;
    this.startLevel(0);
  }

  burst(x, y) {
    const colors = ['#ff6b9d', '#ffd166', '#f9f871', '#ff9f5a'];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 1.3;
      this.particles.push({
        x: x + 0.5,
        y: y + 0.5,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.5,
        life: 0.7 + Math.random() * 0.5,
        age: 0,
        color: colors[i % colors.length],
        size: 2 + Math.random() * 3,
      });
    }
  }

  flash(text) {
    this.message = text;
    this.messageUntil = this.time + 1.6;
  }

  update(dt) {
    this.time += dt;
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 2.4 * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }
}
