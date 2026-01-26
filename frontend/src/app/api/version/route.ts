import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// sd_748_pwa_force_update: /api/version (no-store)
// Returns the SERVER build id (preferred: .next/BUILD_ID).
// Client compares this to window.__NEXT_DATA__.buildId to decide if it is behind.

export const dynamic = "force-dynamic";

function readNextBuildId(): string | null {
  try {
    const p = path.join(process.cwd(), ".next", "BUILD_ID");
    const s = fs.readFileSync(p, "utf8").trim();
    return s || null;
  } catch {
    return null;
  }
}

export async function GET() {
  const buildId =
    readNextBuildId() ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    "unknown";

  const gitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA || null;

  return NextResponse.json(
    {
      ok: true,
      buildId,
      gitSha,
      serverTime: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
