// Lumen Tide's rules and state, with no drawing and no browser in it: Lumen the firefly,
// drifting glow-orbs to eat, spiky urchins to dodge, power-ups, combos and waves. step()
// advances one fixed step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound. Nothing here allocates after createWorld.
import { COMBO, FIELD, LIVES, ORB, ORBS_TO_WIN, PLAYER, POOL_ORBS, POOL_POWERS, POOL_URCHINS, POWER, URCHIN, WAVE } from './config.js';

export const KIND_ORB = 0;
export const KIND_URCHIN = 1;
export const KIND_POWER = 2;

export const POWER_SHIELD = 0;
export const POWER_MAGNET = 1;
export const POWER_SLOW = 2;

export const EVENT_ORB = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_WIN = 8;
export const EVENT_POWER = 16;
export const EVENT_WAVE = 32;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = { x: FIELD.width / 2, y: FIELD.height / 2, radius: PLAYER.radius, invulnerable: 0, shield: false, magnet: 0, slow: 0, glow: 0 };
  const orbs = [];
  const urchins = [];
  const powers = [];
  for (let i = 0; i < POOL_ORBS; i += 1) orbs.push({ active: false, x: 0, y: 0, r: ORB.radius, speed: 0, phase: 0, sway: 0 });
  for (let i = 0; i < POOL_URCHINS; i += 1) urchins.push({ active: false, x: 0, y: 0, r: 0, speed: 0, phase: 0, sway: 0 });
  for (let i = 0; i < POOL_POWERS; i += 1) powers.push({ active: false, kind: POWER_SHIELD, x: 0, y: 0, r: POWER.radius, speed: 0, phase: 0 });

  const state = {
    player, orbs, urchins, powers,
    score: 0, lives: LIVES, wave: 1, elapsed: 0,
    orbsEaten: 0, combo: 0, comboTimer: 0, multiplier: 1,
    orbTimer: 0, urchinTimer: 0, powerTimer: 0,
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height * 0.62;
    player.invulnerable = 0;
    player.shield = false;
    player.magnet = 0;
    player.slow = 0;
    player.glow = 0;
    for (const item of orbs) item.active = false;
    for (const item of urchins) item.active = false;
    for (const item of powers) item.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.wave = 1;
    state.elapsed = 0;
    state.orbsEaten = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.orbTimer = 0.4;
    state.urchinTimer = 2.2;
    state.powerTimer = POWER.interval;
  }

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function spawnOrb() {
    const item = free(orbs);
    if (item === null) return;
    item.active = true;
    item.x = 20 + random() * (FIELD.width - 40);
    item.y = -item.r;
    item.speed = ORB.minSpeed + random() * (ORB.maxSpeed - ORB.minSpeed);
    item.phase = random() * Math.PI * 2;
    item.sway = ORB.sway * (0.5 + random());
  }

  function spawnUrchin() {
    const item = free(urchins);
    if (item === null) return;
    item.active = true;
    item.r = URCHIN.minRadius + random() * (URCHIN.maxRadius - URCHIN.minRadius);
    item.x = 20 + random() * (FIELD.width - 40);
    item.y = -item.r;
    item.speed = URCHIN.speed + URCHIN.speedPerWave * (state.wave - 1) + random() * 40;
    item.phase = random() * Math.PI * 2;
    item.sway = URCHIN.sway * (0.5 + random());
  }

  function spawnPower() {
    const item = free(powers);
    if (item === null) return;
    item.active = true;
    item.kind = Math.floor(random() * 3);
    item.x = 30 + random() * (FIELD.width - 60);
    item.y = -item.r;
    item.speed = 55;
    item.phase = random() * Math.PI * 2;
  }

  function orbInterval() {
    return Math.max(ORB.minInterval, ORB.interval * ORB.intervalScale ** (state.wave - 1));
  }

  function urchinInterval() {
    return Math.max(URCHIN.minInterval, URCHIN.interval * URCHIN.intervalScale ** (state.wave - 1));
  }

  /**
   * One fixed step. `move` is a steering vector {x, y} (keyboard) or a target point
   * {tx, ty} when `moveTo` is true (pointer). With `harmless` set (the title screen's
   * backdrop) things drift but nothing touches the player and nothing scores.
   */
  function step(dt, move, harmless) {
    let events = 0;
    state.elapsed += dt;
    const wave = Math.min(WAVE.max, 1 + Math.floor(state.elapsed / WAVE.seconds));
    if (wave !== state.wave) {
      state.wave = wave;
      events |= EVENT_WAVE;
    }

    // Player movement.
    let mx = 0;
    let my = 0;
    if (move && move.to) {
      const dx = move.tx - player.x;
      const dy = move.ty - player.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        mx = dx / d;
        my = dy / d;
      }
    } else if (move) {
      mx = move.x;
      my = move.y;
      const len = Math.hypot(mx, my);
      if (len > 1) {
        mx /= len;
        my /= len;
      }
    }
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + mx * PLAYER.speed * dt));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + my * PLAYER.speed * dt));
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.magnet > 0) player.magnet = Math.max(0, player.magnet - dt);
    if (player.slow > 0) player.slow = Math.max(0, player.slow - dt);
    if (player.glow > 0) player.glow = Math.max(0, player.glow - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }

    // Spawning.
    state.orbTimer -= dt;
    if (state.orbTimer <= 0) {
      spawnOrb();
      state.orbTimer += orbInterval();
    }
    state.urchinTimer -= dt;
    if (state.urchinTimer <= 0) {
      spawnUrchin();
      state.urchinTimer += urchinInterval();
    }
    state.powerTimer -= dt;
    if (state.powerTimer <= 0) {
      spawnPower();
      state.powerTimer += POWER.interval + random() * POWER.intervalJitter;
    }

    const slowFactor = player.slow > 0 ? 0.45 : 1;

    // Orbs drift down with a sway; magnet pulls nearby ones in.
    for (let i = 0; i < orbs.length; i += 1) {
      const item = orbs[i];
      if (!item.active) continue;
      item.phase += dt * 2;
      item.y += item.speed * dt;
      item.x += Math.sin(item.phase) * item.sway * dt;
      if (player.magnet > 0) {
        const d2 = dist2(item.x, item.y, player.x, player.y);
        if (d2 < POWER.magnetRadius * POWER.magnetRadius && d2 > 1) {
          const d = Math.sqrt(d2);
          item.x += ((player.x - item.x) / d) * 320 * dt;
          item.y += ((player.y - item.y) / d) * 320 * dt;
        }
      }
      if (item.y - item.r > FIELD.height || item.x < -40 || item.x > FIELD.width + 40) {
        item.active = false;
        continue;
      }
      if (harmless) continue;
      const rr = player.radius + item.r;
      if (dist2(item.x, item.y, player.x, player.y) < rr * rr) {
        item.active = false;
        state.orbsEaten += 1;
        state.combo += 1;
        state.comboTimer = COMBO.window;
        state.multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / COMBO.perLevel));
        state.score += ORB.points * state.multiplier;
        player.glow = 0.25;
        events |= EVENT_ORB;
        if (state.orbsEaten >= ORBS_TO_WIN) {
          events |= EVENT_WIN;
          return events;
        }
      }
    }

    // Urchins drift down faster, swaying side to side.
    for (let i = 0; i < urchins.length; i += 1) {
      const item = urchins[i];
      if (!item.active) continue;
      item.phase += dt * 1.6;
      item.y += item.speed * slowFactor * dt;
      item.x += Math.sin(item.phase) * item.sway * dt;
      if (item.y - item.r > FIELD.height || item.x < -60 || item.x > FIELD.width + 60) {
        item.active = false;
        continue;
      }
      if (harmless || player.invulnerable > 0) continue;
      const rr = player.radius + item.r - 4;
      if (dist2(item.x, item.y, player.x, player.y) < rr * rr) {
        item.active = false;
        if (player.shield) {
          player.shield = false;
          player.invulnerable = PLAYER.invulnerable;
          events |= EVENT_HIT;
          continue;
        }
        state.lives -= 1;
        state.combo = 0;
        state.multiplier = 1;
        state.comboTimer = 0;
        player.invulnerable = PLAYER.invulnerable;
        events |= EVENT_HIT;
        if (state.lives === 0) {
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    // Power-ups drift down slowly.
    for (let i = 0; i < powers.length; i += 1) {
      const item = powers[i];
      if (!item.active) continue;
      item.phase += dt * 2;
      item.y += item.speed * dt;
      item.x += Math.sin(item.phase) * 22 * dt;
      if (item.y - item.r > FIELD.height) {
        item.active = false;
        continue;
      }
      if (harmless) continue;
      const rr = player.radius + item.r;
      if (dist2(item.x, item.y, player.x, player.y) < rr * rr) {
        item.active = false;
        if (item.kind === POWER_SHIELD) player.shield = true;
        else if (item.kind === POWER_MAGNET) player.magnet = POWER.magnetSeconds;
        else player.slow = POWER.slowSeconds;
        events |= EVENT_POWER;
      }
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
