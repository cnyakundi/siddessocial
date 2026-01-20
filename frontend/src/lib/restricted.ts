"use client";

// sd_246: Shared restricted/unauth detection.
//
// Many Siddes APIs return {restricted:true} with 200 to avoid leaking details.
// UI must not treat that as "empty".

export class RestrictedError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RestrictedError";
    this.status = status;
  }
}

export function isRestrictedPayload(res: Response | null, data: any): boolean {
  const status = res ? res.status : 0;
  if (status === 401 || status === 403) return true;

  if (!data) return false;
  if (data.restricted) return true;
  if (data.ok === false && data.error === "restricted") return true;
  if (data.error === "restricted") return true;

  return false;
}

export function isRestrictedError(e: any): boolean {
  if (!e) return false;
  if (e.name === "RestrictedError") return true;
  const msg = String(e.message || "").toLowerCase();
  return msg.includes("restricted") || msg.includes("login") || msg.includes("unauth");
}

export function restrictedMessage(e: any): string {
  if (e && e.name === "RestrictedError") return String(e.message || "Restricted");
  return "Restricted — sign in to continue.";
}
