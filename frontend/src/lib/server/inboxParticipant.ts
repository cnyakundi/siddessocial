export type Participant = {
  displayName: string;
  initials: string;
  avatarSeed: string;
};

function hashSeed(s: string): number {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
  return x >>> 0;
}

function initialsFromName(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "??";
  const a = parts[0][0] || "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return (a + b).toUpperCase();
}

export function participantForThread(args: { threadId: string; title: string }): Participant {
  const title = String(args.title || "").trim();
  const displayName = title || `Thread ${args.threadId}`;
  const initials = initialsFromName(displayName);

  const seedNum = hashSeed(`${args.threadId}|${displayName}`);
  const avatarSeed = `seed_${seedNum.toString(16)}`;

  return { displayName, initials, avatarSeed };
}
