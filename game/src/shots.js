// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple autopilot (chase the
// nearest orb, steer away from close urchins), so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { FIELD, PLAYER, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN, KIND_URCHIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 600;

function autopilot(state, skill) {
  const player = state.player;
  let mx = 0;
  let my = 0;
  if (skill === 'doomed') {
    // The end scene's pilot steers straight at the nearest urchin, as a hurried
    // player does, so it is caught out quickly instead of winning by accident.
    let urchin = null;
    let d2min = Infinity;
    for (const item of state.urchins) {
      if (!item.active) continue;
      const dx = item.x - player.x;
      const dy = item.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < d2min) {
        d2min = d2;
        urchin = item;
      }
    }
    if (urchin !== null) {
      const d = Math.sqrt(d2min) || 1;
      mx = (urchin.x - player.x) / d;
      my = (urchin.y - player.y) / d;
    }
    return { x: mx, y: my };
  }
  // Chase the nearest orb.
  let orb = null;
  let orbD = Infinity;
  for (const item of state.orbs) {
    if (!item.active) continue;
    const dx = item.x - player.x;
    const dy = item.y - player.y;
    const d = dx * dx + dy * dy;
    if (d < orbD) {
      orbD = d;
      orb = item;
    }
  }
  if (orb !== null) {
    const d = Math.sqrt(orbD) || 1;
    mx += (orb.x - player.x) / d;
    my += (orb.y - player.y) / d;
  } else {
    my += 0.3;
  }
  // Flee close urchins, harder the better the pilot.
  for (const item of state.urchins) {
    if (!item.active) continue;
    const dx = player.x - item.x;
    const dy = player.y - item.y;
    const d = Math.hypot(dx, dy) || 1;
    const danger = skill === 'good' ? 190 : 110;
    if (d < danger) {
      const push = ((danger - d) / danger) * 2.2;
      mx += (dx / d) * push;
      my += (dy / d) * push;
    }
  }
  const len = Math.hypot(mx, my) || 1;
  return { x: mx / len, y: my / len };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const skill = name === 'end' ? 'doomed' : 'good';
  for (let index = 0; index < limit / STEP; index += 1) {
    const events = world.step(STEP, autopilot(world.state, skill), false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
