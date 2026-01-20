import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hasCookie(req: Request, name: string): boolean {
  const c = req.headers.get("cookie") || "";
  const n = String(name || "").trim();
  if (!n) return false;
  const re = new RegExp("(?:^|;\s*)" + n.replace(/[.*+?^${}()|[\]\\]/g, "\$&") + "=");
  return re.test(c);
}

function newToken(): string {
  // 32 hex chars; Django accepts this as a csrf cookie token.
  return crypto.randomBytes(16).toString("hex");
}

// GET /api/auth/csrf -> sets csrftoken cookie on the Next domain if missing.
export async function GET(req: Request) {
  const resp = NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } });

  if (!hasCookie(req, "csrftoken")) {
    resp.cookies.set("csrftoken", newToken(), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return resp;
}
