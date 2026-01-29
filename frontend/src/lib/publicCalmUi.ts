export type PublicCalmUiState = {
  // When true, engagement counts are always visible.
  // When false, counts are hidden until hover/tap (Visual Calm).
  showCounts: boolean;
};

const KEY = "sd.publicCalmUi.v0";
export const EVT_PUBLIC_CALM_UI_CHANGED = "sd.publicCalmUi.changed";

const DEFAULT_STATE: PublicCalmUiState = { showCounts: true };

export function loadPublicCalmUi(): PublicCalmUiState {
  if (typeof window === "undefined") return DEFAULT_STATE;

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;

    const parsed: any = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_STATE;

    return {
      showCounts: !!parsed.showCounts,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function savePublicCalmUi(state: PublicCalmUiState) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(KEY, JSON.stringify({ showCounts: !!state.showCounts }));
    window.dispatchEvent(new Event(EVT_PUBLIC_CALM_UI_CHANGED));
  } catch {
    // ignore storage errors (private mode / quota)
  }
}
