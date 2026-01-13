import { NextResponse } from "next/server";
import { appendMessage, getThread, ensureThread } from "@/src/lib/server/inboxStore";
import { normalizeViewer, roleForViewer, viewerAllowed } from "@/src/lib/server/inboxVisibility";
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

  // Only allow simulate if caller is "me"
  if (role !== "me") {
    return NextResponse.json({ ok: true, restricted: true, role }, { status: 200 });
  }

  const body = await req.json().catch(() => ({} as any));
  const id = String(body?.threadId || "");
  const text = String(body?.text || "Incoming message").trim();

  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_threadId" }, { status: 400 });
  }

  const thread = getThread(id) || ensureThread(id, { title: "Thread", lockedSide: "friends" });

  if (!viewerAllowed(viewer, thread.lockedSide)) {
    return NextResponse.json({ ok: true, restricted: true, role, threadId: id }, { status: 200 });
  }

  const msg = appendMessage(id, { from: "them", text, side: thread.lockedSide, viewerRole: role as any });

  return NextResponse.json({ ok: true, restricted: false, role, threadId: id, messageId: msg.id });
}
