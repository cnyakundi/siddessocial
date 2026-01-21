#!/usr/bin/env node

/*
  Siddes Next build wrapper.
  - On Vercel: build to default .next (Vercel expects this)
  - Locally: keep NEXT_DIST_DIR=.next_build to avoid clobbering dev output
*/

const { spawnSync } = require('child_process');

const env = { ...process.env };

if (env.VERCEL) {
  // Vercel expects the default output directory: .next
  delete env.NEXT_DIST_DIR;
} else {
  // Preserve your local convention
  env.NEXT_DIST_DIR = env.NEXT_DIST_DIR || '.next_build';
}

const res = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  env,
});

process.exit(res.status == null ? 1 : res.status);
