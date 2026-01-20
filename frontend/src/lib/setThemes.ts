export type SetColor = "orange" | "purple" | "blue" | "emerald" | "rose" | "slate";

export const SET_THEMES: Record<
  SetColor,
  { bg: string; text: string; border: string }
> = {
  orange: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100" },
  purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100" },
  // NOTE: Blue is reserved for the Public Side. Sets never render blue; stored "blue" is mapped to slate.
  blue: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
  rose: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" },
  slate: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
};

export function getSetTheme(color: SetColor) {
  return SET_THEMES[color] ?? SET_THEMES.orange;
}
