export type SideId = "public" | "friends" | "close" | "work";

export const SIDE_ORDER: SideId[] = ["public", "friends", "close", "work"];

export const SIDES: Record<
  SideId,
  {
    id: SideId;
    label: string;
    desc: string;
    privacyHint: string;
    isPrivate: boolean;
  }
> = {
  public: {
    id: "public",
    label: "Public",
    desc: "Open world",
    privacyHint: "Visible to everyone",
    isPrivate: false,
  },
  friends: {
    id: "friends",
    label: "Friends",
    desc: "People you know",
    privacyHint: "Visible only to Friends",
    isPrivate: true,
  },
  close: {
    id: "close",
    label: "Close",
    desc: "Inner room",
    privacyHint: "Visible only to Close members",
    isPrivate: true,
  },
  work: {
    id: "work",
    label: "Work",
    desc: "Professional mode",
    privacyHint: "Visible to Work connections",
    isPrivate: true,
  },
};

// Tailwind-safe theme tokens (static strings)
export const SIDE_THEMES: Record<
  SideId,
  {
    primaryBg: string;
    text: string;
    ring: string;
    lightBg: string;
    border: string;
    accentBorder: string;
    hoverBg: string;
  }
> = {
  public: {
    primaryBg: "bg-blue-600",
    text: "text-blue-600",
    ring: "ring-blue-600",
    lightBg: "bg-blue-50",
    border: "border-blue-200",
    accentBorder: "border-l-blue-600",
    hoverBg: "hover:bg-blue-50",
  },
  friends: {
    primaryBg: "bg-emerald-600",
    text: "text-emerald-600",
    ring: "ring-emerald-600",
    lightBg: "bg-emerald-50",
    border: "border-emerald-200",
    accentBorder: "border-l-emerald-600",
    hoverBg: "hover:bg-emerald-50",
  },
  close: {
    primaryBg: "bg-rose-600",
    text: "text-rose-600",
    ring: "ring-rose-600",
    lightBg: "bg-rose-50",
    border: "border-rose-200",
    accentBorder: "border-l-rose-600",
    hoverBg: "hover:bg-rose-50",
  },
  work: {
    primaryBg: "bg-slate-700",
    text: "text-slate-700",
    ring: "ring-slate-700",
    lightBg: "bg-slate-100",
    border: "border-slate-300",
    accentBorder: "border-l-slate-700",
    hoverBg: "hover:bg-slate-100",
  },
};

export function isSideId(v: unknown): v is SideId {
  return v === "public" || v === "friends" || v === "close" || v === "work";
}

export function nextSide(current: SideId, dir: 1 | -1 = 1): SideId {
  const idx = SIDE_ORDER.indexOf(current);
  const nextIdx = (idx + dir + SIDE_ORDER.length) % SIDE_ORDER.length;
  return SIDE_ORDER[nextIdx];
}
