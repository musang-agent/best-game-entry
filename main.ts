// Bloomweave entrypoint (Node 22, standard library only).
//
// This program hands the game in: it copies the static game files and the
// screenshots from this repository into the output directory and writes the
// dossier the judge reads, using the kit's vendored library to build it.
// The grader runs it twice in a fresh container with a writable /output;
// outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output, e.g.
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory holding this file.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn() {
  mkdirSync(outputDir, { recursive: true });

  // The whole game, exactly as it sits in the repository.
  cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

  // The screenshots, when the repository holds any.
  const shotsDir = join(repoRoot, 'screenshots');
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
  }

  // The dossier, built from the copied files with the scorer's own caps:
  // at most 160 KiB of source text, 4 screenshots of 256 KiB each, a game
  // of at most 993 files and 48 MiB, and no game path over 1000 bytes.
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

handIn();
