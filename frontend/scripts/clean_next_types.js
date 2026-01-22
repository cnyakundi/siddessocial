// sd_479: robust cleanup for Next.js generated type dirs (macOS ENOTEMPTY-safe)
const fs = require("fs");
const cp = require("child_process");

const DIRS = [".next/types", ".next_build/types"];

function sleep(ms) {
  // Atomics.wait is the simplest synchronous sleep available in Node.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function rmSafe(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function rmWithRetries(p) {
  for (let i = 0; i < 5; i++) {
    if (rmSafe(p)) return;
    sleep(50 * Math.pow(2, i));
  }
  try {
    cp.execSync(`rm -rf ${p}`, { stdio: "ignore" });
  } catch {
    // ignore
  }
}

for (const d of DIRS) rmWithRetries(d);
