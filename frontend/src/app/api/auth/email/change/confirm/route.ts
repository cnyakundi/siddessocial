import { NextResponse } from "next/server";
import { proxyJson } from "../../../_proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function applySetCookies(resp: NextResponse, setCookies: string[]) {
  for (const sc of setCookies || []) {
    if (!sc) continue;
    resp.headers.append("set-cookie", sc);
  }
}

function dropCookieByName(setCookies: string[], name: string): string[] {
  const n = String(name || "").toLowerCase();
  if (!n) return setCookies || [];
  return (setCookies || []).filter((c) => !String(c || "").toLowerCase().trim().startsWith(n + "="));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const out = await proxyJson(req, "/api/auth/email/change/confirm", "POST", body);
  if (out instanceof NextResponse) return out;

  const { res, data, setCookies } = out;
  const resp = NextResponse.json(data, {
    status: res.status,
    headers: { "cache-control": "no-store" },
  });

  const session = data?.session;
  const sessName = String(session?.name || "sessionid");

  applySetCookies(resp, dropCookieByName(setCookies || [], sessName));

  if (session?.name && session?.value) {
    resp.cookies.set(String(session.name), String(session.value), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return resp;
}
