import { NextResponse } from "next/server";

export async function GET() {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    "";

  return NextResponse.json({
    configured: Boolean(publicKey),
    publicKey,
  });
}
