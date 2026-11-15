// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Canvas shapes and glow (shadowBlur), canvas text for the HUD and the panels.
import { FIELD, FONT, LIVES, ORBS_TO_WIN, PALETTE } from './config.js';
import { KIND_ORB, KIND_POWER, KIND_URCHIN, POWER_MAGNET, POWER_SHIELD, POWER_SLOW } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The panel's width; its height grows with its lines. */
const PANEL = { width: 660, top: 140, line: 32, bottom: 72 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const waveLabel = cachedLabel('Wave ');
  const orbsLabel = cachedLabel('Orbs ');
  const comboLabel = cachedLabel('Combo x');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');

  // Fixed background bubbles, placed once so the lagoon never flickers.
  const bubbles = [];
  {
    let seed = 1234567;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 46; i += 1) {
      bubbles.push({ x: rand() * FIELD.width, y: rand() * FIELD.height, r: 2 + rand() * 7, speed: 8 + rand() * 18, phase: rand() * 6.28 });
    }
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function circle(x, y, r, color, glow, glowColor) {
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    if (glow) {
      context.shadowColor = glowColor || color;
      context.shadowBlur = glow;
    }
    context.fillStyle = color;
    context.fill();
    context.shadowBlur = 0;
  }

  function drawLagoon(state) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.lagoonTop);
    gradient.addColorStop(1, PALETTE.lagoonBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // Rising bubbles.
    context.strokeStyle = 'rgba(160, 220, 205, 0.20)';
    context.lineWidth = 1.5;
    for (const bubble of bubbles) {
      const y = ((bubble.y - state.elapsed * bubble.speed) % FIELD.height + FIELD.height) % FIELD.height;
      context.beginPath();
      context.arc(bubble.x + Math.sin(bubble.phase + state.elapsed) * 6, y, bubble.r, 0, Math.PI * 2);
      context.stroke();
    }
    // Sandy floor.
    context.fillStyle = '#14333c';
    context.fillRect(0, FIELD.height - 26, FIELD.width, 26);
    context.fillStyle = '#1d4550';
    for (let x = 0; x < FIELD.width; x += 90) {
      context.beginPath();
      context.arc(x + 40, FIELD.height - 24, 16, Math.PI, 0);
      context.fill();
    }
  }

  function drawUrchin(item) {
    // Spiky ball: 10 spikes around a dark-red core.
    context.strokeStyle = PALETTE.urchinSpike;
    context.lineWidth = 3;
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2 + item.phase * 0.3;
      context.moveTo(item.x + Math.cos(a) * item.r * 0.55, item.y + Math.sin(a) * item.r * 0.55);
      context.lineTo(item.x + Math.cos(a) * (item.r + 7), item.y + Math.sin(a) * (item.r + 7));
    }
    context.stroke();
    circle(item.x, item.y, item.r * 0.8, PALETTE.urchin, 8, PALETTE.urchin);
  }

  function drawPower(item) {
    const color = item.kind === POWER_SHIELD ? PALETTE.shield : item.kind === POWER_MAGNET ? PALETTE.magnet : PALETTE.slow;
    circle(item.x, item.y, item.r + 4, color, 16, color);
    context.fillStyle = '#06222b';
    context.beginPath();
    context.arc(item.x, item.y, item.r - 3, 0, Math.PI * 2);
    context.fill();
    text(item.kind === POWER_SHIELD ? 'S' : item.kind === POWER_MAGNET ? 'M' : 'T', item.x, item.y + 7, 18, color, 'center');
  }

  function drawField(state) {
    drawLagoon(state);
    for (const item of state.orbs) {
      if (!item.active) continue;
      const pulse = 1 + Math.sin(item.phase * 2) * 0.15;
      circle(item.x, item.y, item.r * 1.9 * pulse, PALETTE.orb, 18, PALETTE.orb);
      circle(item.x, item.y, item.r * 0.55, PALETTE.orbCore, 0);
    }
    for (const item of state.urchins) {
      if (!item.active) continue;
      drawUrchin(item);
    }
    for (const item of state.powers) {
      if (!item.active) continue;
      drawPower(item);
    }

    const player = state.player;
    // Blink while invulnerable after a hit: hidden on every other tenth of a second.
    if (player.invulnerable === 0 || Math.floor(player.invulnerable * 10) % 2 === 1) {
      const glow = 26 + (player.glow > 0 ? 22 : 0);
      // Wings.
      const wing = Math.sin(state.elapsed * 28) * 6;
      context.fillStyle = 'rgba(220, 240, 255, 0.75)';
      context.beginPath();
      context.ellipse(player.x - 12, player.y - 12 - wing, 10, 5, -0.6, 0, Math.PI * 2);
      context.ellipse(player.x + 12, player.y - 12 + wing, 10, 5, 0.6, 0, Math.PI * 2);
      context.fill();
      // Shield ring.
      if (player.shield) {
        context.strokeStyle = PALETTE.shield;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
        context.stroke();
      }
      // Magnet ring.
      if (player.magnet > 0) {
        context.strokeStyle = PALETTE.magnet;
        context.lineWidth = 2;
        context.setLineDash([6, 6]);
        context.beginPath();
        context.arc(player.x, player.y, player.radius + 16, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
      }
      circle(player.x, player.y, player.radius + 6, PALETTE.playerGlow, glow, PALETTE.playerGlow);
      circle(player.x, player.y, player.radius, PALETTE.player, 0);
      // Eyes: Lumen looks where it swims.
      context.fillStyle = '#0b2530';
      context.beginPath();
      context.arc(player.x - 5, player.y - 3, 2.6, 0, Math.PI * 2);
      context.arc(player.x + 5, player.y - 3, 2.6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 28, PALETTE.text, 'left');
    text(waveLabel(state.wave), FIELD.width / 2 - 130, 18, 28, PALETTE.text, 'center');
    text(orbsLabel(`${state.orbsEaten}/${ORBS_TO_WIN}`), FIELD.width / 2 + 130, 18, 28, PALETTE.orb, 'center');
    if (state.multiplier > 1) text(comboLabel(state.multiplier), 24, 54, 22, PALETTE.player, 'left');
    // Lives as glowing hearts (circles) top-right.
    const firstLife = FIELD.width - 24 - LIVES * 28 + 8;
    text('Lives', firstLife - 12, 18, 28, PALETTE.text, 'right');
    for (let life = 0; life < LIVES; life += 1) {
      circle(firstLife + life * 28 + 10, 32, 9, life < state.lives ? PALETTE.player : '#23414d', life < state.lives ? 10 : 0, PALETTE.player);
    }
    // Active power-up timers, bottom-left.
    let line = 0;
    if (state.player.shield) {
      text('Shield ready — blocks one hit', 24, FIELD.height - 66, 20, PALETTE.shield, 'left');
      line += 1;
    }
    if (state.player.magnet > 0) {
      text(`Magnet ${Math.ceil(state.player.magnet)}s`, 24, FIELD.height - 66 - line * 26, 20, PALETTE.magnet, 'left');
      line += 1;
    }
    if (state.player.slow > 0) {
      text(`Slow tide ${Math.ceil(state.player.slow)}s`, 24, FIELD.height - 66 - line * 26, 20, PALETTE.slow, 'left');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.orb;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.orb, 'center');
  }

  const TITLE_LINES = [
    'Guide Lumen the firefly through the lagoon.',
    'Eat glowing plankton. Dodge the spiky urchins.',
    'Chain orbs fast for a combo multiplier up to x5.',
    'Grab S (shield), M (magnet) and T (slow tide).',
    'Collect 120 orbs to light the lagoon and win.',
    'Move: WASD / arrows, or steer with the mouse.  P pauses.',
    '',
  ];
  const PAUSED_LINES = ['The tide will wait for you.'];
  const OVER_LINES = ['', '', ''];
  const WIN_LINES = ['', '', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[6] = bestLabel(best);
      drawPanel('Lumen Tide', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = `Orbs eaten ${state.orbsEaten}  ·  Wave ${state.wave}`;
      OVER_LINES[2] = bestLabel(best);
      drawPanel('The light went out', OVER_LINES, 'Press Space or click to play again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = `All ${ORBS_TO_WIN} orbs gathered  ·  Wave ${state.wave}`;
      WIN_LINES[2] = bestLabel(best);
      drawPanel('The lagoon is lit!', WIN_LINES, 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
