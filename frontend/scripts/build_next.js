#!/usr/bin/env node

/*
  Siddes Next build wrapper.
  - On Vercel: build to default .next (Vercel expects this)
  - Locally: keep NEXT_DIST_DIR=.next_build to avoid clobbering dev output

  sd_900: Auto-bump Service Worker VERSION per build (prevents cache drift).
*/

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function resolveSwVersion() {
  const env = process.env || {};
  const fromEnv = String(
    env.SD_SW_VERSION ||
    env.NEXT_PUBLIC_SD_SW_VERSION ||
    env.VERCEL_GIT_COMMIT_SHA ||
    env.GITHUB_SHA ||
    env.COMMIT_SHA ||
    ""
  ).trim();

  if (fromEnv) return fromEnv.slice(0, 12);

  try {
    const r = spawnSync("git", ["rev-parse", "--short=12", "HEAD"], { stdio: ["ignore", "pipe", "ignore"] });
    if (r && r.status === 0) {
      const v = String(r.stdout || "").trim();
      if (v) return v;
    }
  } catch {}

  return String(Date.now());
}

function patchSwJs(version) {
  try {
    const swPath = path.join(__dirname, "..", "public", "sw.js");
    if (!fs.existsSync(swPath)) return;

    let s = fs.readFileSync(swPath, "utf8");
    const re = /const VERSION = "([^"]*)";/;
    if (!re.test(s)) return;

    const next = s.replace(re, `const VERSION = "${version}";`);
    if (next !== s) {
      fs.writeFileSync(swPath, next, "utf8");
      console.log(`[build_next] sw.js VERSION -> ${version}`);
    }
  } catch (e) {
    // don't fail build because of SW patching
    console.warn("[build_next] WARN: could not patch sw.js VERSION:", e && e.message ? e.message : String(e));
  }
}

const env = { ...process.env };

// sd_900: patch SW version before build (so SW cache names rotate cleanly)
patchSwJs(resolveSwVersion());

if (env.VERCEL) {
  // Vercel expects the default output directory: .next
  delete env.NEXT_DIST_DIR;
} else {
  // Preserve your local convention
  env.NEXT_DIST_DIR = env.NEXT_DIST_DIR || ".next_build";
}

const res = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  env,
});

process.exit(res.status == null ? 1 : res.status);
