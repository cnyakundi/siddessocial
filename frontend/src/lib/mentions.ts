// sd_181o: DB-backed mentions (type only). No mock datasets.

export type MentionCandidate = {
  name: string;
  handle: string; // always starts with '@'
};

export function normalizeHandle(raw: string): string {
  const t = String(raw || "").trim();
  if (!t) return "";
  if (t.startsWith("@")) return t;
  return `@${t.replace(/^@+/, "")}`;
}
