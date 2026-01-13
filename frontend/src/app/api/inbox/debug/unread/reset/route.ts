import { NextResponse } from "next/server";
import { listThreads, setThreadUnread } from "@/src/lib/server/inboxStore";
import { normalizeViewer, roleForViewer } from "@/src/lib/server/inboxVisibility";
import { resolveStubViewer } from "@/src/lib/server/inboxViewer";

export async function POST(req: Request) {
  // Dev-only: do not expose stub debug actions in production builds.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const { viewerId } = resolveStubViewer(req);
  if (!viewerId) {
    return NextResponse.json({ ok: true, restricted: true, role: "anon" }, { status: 200 });
  }

  const viewer = normalizeViewer(viewerId);
  const role = roleForViewer(viewer);

  // Only allow reset if caller is "me" (debug safety)
  if (role !== "me") {
    return NextResponse.json({ ok: true, restricted: true, role }, { status: 200 });
  }

  const body = await req.json().catch(() => ({} as any));
  const threadId = String(body?.threadId || "");

  const threads = listThreads();

  if (threadId) {
    for (const r of ["friends", "close", "work", "me"] as const) {
      setThreadUnread(threadId, r, 0);
    }
  } else {
    for (const t of threads) {
      for (const r of ["friends", "close", "work", "me"] as const) {
        setThreadUnread(t.id, r, 0);
      }
    }
  }

  return NextResponse.json({ ok: true, restricted: false, role, threadId: threadId || null });
}
