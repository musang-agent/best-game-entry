// Lumen Tide — tuning numbers and colours in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  speed: 430,
  invulnerable: 1.5,
};

export const LIVES = 3;

/** Collect this many glow-orbs to light the lagoon and win. */
export const ORBS_TO_WIN = 120;

export const ORB = {
  radius: 10,
  minSpeed: 42,
  maxSpeed: 78,
  sway: 34,
  interval: 0.85,
  intervalScale: 0.94,
  minInterval: 0.38,
  points: 10,
};

/** Combo: each orb within COMBO_WINDOW of the last adds one; every 5 combo raises the multiplier. */
export const COMBO = { window: 3, perLevel: 5, maxMultiplier: 5 };

export const URCHIN = {
  minRadius: 15,
  maxRadius: 23,
  speed: 118,
  speedPerWave: 20,
  sway: 55,
  interval: 1.5,
  intervalScale: 0.9,
  minInterval: 0.55,
};

/** Power-ups: shield (one free hit), magnet (orbs fly to you), slow tide (urchins crawl). */
export const POWER = {
  interval: 13,
  intervalJitter: 5,
  radius: 13,
  magnetSeconds: 8,
  slowSeconds: 6,
  magnetRadius: 280,
};

/** Seconds of play per wave; difficulty stops growing at the last wave. */
export const WAVE = { seconds: 20, max: 8 };

/** Entity pools, allocated once at boot. */
export const POOL_ORBS = 48;
export const POOL_URCHINS = 40;
export const POOL_POWERS = 6;

export const PALETTE = {
  backdrop: '#04141a',
  lagoonTop: '#0a2e3a',
  lagoonBottom: '#03161d',
  player: '#ffe066',
  playerGlow: '#ffdf5e',
  orb: '#7ef0c1',
  orbCore: '#eafff5',
  urchin: '#c94f6d',
  urchinSpike: '#e87a95',
  shield: '#6fd3ff',
  magnet: '#c792ff',
  slow: '#8affd1',
  panel: '#0b2530',
  text: '#eef7f5',
  muted: '#9db8b2',
  danger: '#ff6b6b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen-tide.best';
