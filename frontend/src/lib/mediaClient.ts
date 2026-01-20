"use client";

export type MediaKind = "image" | "video";

export type SignedUpload = {
  ok: boolean;
  restricted?: boolean;
  error?: string;
  media?: { id: string; r2Key: string; kind: MediaKind; contentType: string; status?: string };
  upload?: { method: "PUT" | string; url: string; headers?: Record<string, string>; expiresIn?: number };
  serve?: { url: string };
};

export async function signUpload(file: File, kind: MediaKind = "image"): Promise<SignedUpload> {
  const contentType = String(file.type || "application/octet-stream").toLowerCase();
  const ext = (() => {
    const name = String((file as any).name || "");
    const m = name.match(/\.([a-z0-9]{1,8})$/i);
    return m ? m[1].toLowerCase() : "";
  })();

  const res = await fetch("/api/media/sign-upload", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ kind, contentType, bytes: (file as any).size || undefined, ext }),
  });

  const data = (await res.json().catch(() => null)) as SignedUpload | null;
  return data || { ok: false, error: `sign_failed_${res.status}` };
}

export async function uploadToSignedUrl(url: string, file: File, headers?: Record<string, string>): Promise<boolean> {
  const h = new Headers(headers || {});
  if (!h.has("content-type") && file.type) h.set("content-type", file.type);
  const res = await fetch(url, { method: "PUT", headers: h, body: file });
  return res.ok;
}
