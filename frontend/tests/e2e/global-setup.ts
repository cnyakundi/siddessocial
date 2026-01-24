import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const DEFAULT_SCAN_START = 8000;
const DEFAULT_SCAN_END = 8010;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function probe(origin: string, timeoutMs = 650): Promise<boolean> {
  const url = new URL("/healthz", origin).toString();
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal: ac.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function candidates(): string[] {
  const out: string[] = [];

  const envPortRaw = String(
    process.env.SIDDES_BACKEND_PORT || process.env.SD_BACKEND_PORT || process.env.BACKEND_PORT || ""
  ).trim();
  const envPort = /^\\d+$/.test(envPortRaw) ? Number(envPortRaw) : null;

  const add = (p: number) => {
    out.push(`http://127.0.0.1:${p}`);
    out.push(`http://localhost:${p}`);
    out.push(`http://host.docker.internal:${p}`);
  };

  if (envPort) add(envPort);
  for (let p = DEFAULT_SCAN_START; p <= DEFAULT_SCAN_END; p++) add(p);

  return uniq(out);
}

async function waitForHealthy(timeoutMs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  const cands = candidates();

  while (Date.now() < deadline) {
    const oks = await Promise.all(cands.map((o) => probe(o)));
    for (let i = 0; i < cands.length; i++) {
      if (oks[i]) return cands[i];
    }
    await sleep(500);
  }

  return null;
}

export default async function globalSetup() {
  // Allow opt-out for power users / CI.
  if (process.env.SD_E2E_NO_DOCKER === "1") return;

  // If backend already up somewhere, we're done.
  const first = await waitForHealthy(2_500);
  if (first) return;

  // In CI, do not attempt to start docker automatically.
  if (process.env.CI) {
    throw new Error(
      "Backend not ready for E2E. Start it first (docker compose dev) and ensure /healthz is reachable."
    );
  }

  const frontendRoot = path.resolve(__dirname, "../..");
  const repoRoot = path.resolve(frontendRoot, "..");
  const startScript = path.join(repoRoot, "scripts/dev/start_backend_docker.sh");
  const composeFile = path.join(repoRoot, "ops/docker/docker-compose.dev.yml");

  try {
    if (fs.existsSync(startScript)) {
      execSync(`bash "${startScript}"`, { cwd: repoRoot, stdio: "inherit" });
    } else {
      execSync(`docker compose -f "${composeFile}" up -d db redis backend`, { cwd: repoRoot, stdio: "inherit" });
    }
  } catch (e: any) {
    throw new Error(
      `Could not start backend for E2E. Try from repo root:\\n` +
        `  ./scripts/dev/start_backend_docker.sh\\n` +
        `or:\\n  docker compose -f ops/docker/docker-compose.dev.yml up -d backend\\n\\n` +
        `Original error: ${String(e?.message || e)}`
    );
  }

  const ok = await waitForHealthy(45_000);
  if (!ok) {
    throw new Error(
      "Backend still not responding on /healthz after attempting docker start. " +
        "Check docker logs: docker compose -f ops/docker/docker-compose.dev.yml logs -f backend"
    );
  }
}
