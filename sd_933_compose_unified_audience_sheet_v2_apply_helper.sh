#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/app/siddes-compose/ComposeMVP.tsx"

if [[ ! -f "$FILE" ]]; then
  echo "❌ Missing: $FILE"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_sd_933_compose_unified_audience_sheet_v2_${STAMP}"
mkdir -p "$BK"
cp "$FILE" "$BK/ComposeMVP.tsx"
[[ -f "docs/STATE.md" ]] && cp "docs/STATE.md" "$BK/STATE.md" || true

PYBIN="python3"
if ! command -v "$PYBIN" >/dev/null 2>&1; then PYBIN="python"; fi

"$PYBIN" - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/app/siddes-compose/ComposeMVP.tsx")
s = p.read_text(encoding="utf-8")

# Guard: this script expects the original file shape (TopicPickerSheet exists)
if "function TopicPickerSheet" not in s:
    raise SystemExit(
        "ERROR: ComposeMVP.tsx does not look like the baseline file.\n"
        "Restore from your backup first (cp .backup_sd_932.../ComposeMVP.tsx ...), then rerun this script."
    )

def sub_once(pattern, repl, flags=0, label=""):
    nonlocal_s = globals().get("_S")
    globals()["_S"] = nonlocal_s

globals()["_S"] = s

def sub_once(pattern, repl, flags=0, label=""):
    global _S
    new, n = re.subn(pattern, repl, _S, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"ERROR: {label or pattern} (expected 1 match, got {n})")
    _S = new

# 1) Update audienceStore imports (add setters + bus + recent)
sub_once(
    r'import\s+\{\s*getStoredLastPublicTopic,\s*getStoredLastSetForSide\s*\}\s+from\s+"@/src/lib/audienceStore";',
    'import { emitAudienceChanged, getStoredLastPublicTopic, getStoredLastSetForSide, pushStoredRecentSetForSide, setStoredLastPublicTopic, setStoredLastSetForSide } from "@/src/lib/audienceStore";',
    label="audienceStore import"
)

# 2) Remove CirclePickerSheet import (we won't use it anymore)
globals()["_S"] = re.sub(
    r'^\s*import\s+\{\s*CirclePickerSheet\s*\}\s+from\s+"@/src/components/CirclePickerSheet";\s*\n',
    "",
    globals()["_S"],
    flags=re.M
)

# 3) Replace TopicPickerSheet with unified AudiencePickerSheet
AUDIENCE_SHEET = r'''
function AudiencePickerSheet({
  open,
  onClose,
  side,
  setSide,
  circles,
  circlesLoaded,
  selectedCircleId,
  onPickCircle,
  publicChannel,
  onPickTopic,
  topicsEnabled,
  onNewCircle,
}: {
  open: boolean;
  onClose: () => void;
  side: SideId;
  setSide: (next: SideId) => void;
  circles: CircleDef[];
  circlesLoaded: boolean;
  selectedCircleId: CircleId | null;
  onPickCircle: (next: CircleId | null) => void;
  publicChannel: PublicChannelId;
  onPickTopic: (next: PublicChannelId) => void;
  topicsEnabled: boolean;
  onNewCircle: () => void;
}) {
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const SIDE_ORDER: SideId[] = ["public", "friends", "close", "work"];
  const filtered = Array.isArray(circles) ? circles.filter((c) => c && c.side === side) : [];

  return (
    <div className="fixed inset-0 z-[125] flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Close audience picker"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onPointerDown={(e) => {
          e.preventDefault();
          onClose();
        }}
        onClick={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200 max-h-[70dvh] md:max-h-[80vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Audience</h3>
            <div className="text-xs text-gray-500 mt-1">Pick a Side, then optionally a Circle.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-5">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2">Side</div>
          <div className="flex gap-2 p-1 rounded-2xl bg-gray-50/80 border border-gray-100">
            {SIDE_ORDER.map((id) => {
              const t = SIDE_THEMES[id];
              const active = side === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSide(id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-extrabold transition-all border",
                    active ? "bg-white border-gray-200 shadow-sm" : "bg-transparent border-transparent text-gray-400 hover:text-gray-700 hover:bg-white/60"
                  )}
                  aria-label={SIDES[id].label}
                  title={SIDES[id].privacyHint}
                >
                  <span className={cn("w-2 h-2 rounded-full", t.primaryBg)} aria-hidden="true" />
                  <span className={cn(active ? t.text : "")}>{SIDES[id].label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {side === "public" ? (
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2">Topic</div>

            {!topicsEnabled ? (
              <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-600">
                Topics are disabled in this build.
              </div>
            ) : (
              <div className="space-y-2">
                {PUBLIC_CHANNELS.map((c) => {
                  const active = publicChannel === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onPickTopic(c.id);
                        onClose();
                      }}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                        active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50"
                      )}
                      title={c.desc}
                    >
                      <div className="min-w-0">
                        <div className={cn("font-bold truncate", active ? "text-white" : "text-gray-900")}>{c.label}</div>
                        <div className={cn("text-[11px] truncate", active ? "text-white/80" : "text-gray-500")}>{c.desc}</div>
                      </div>
                      {active ? <span className="w-2.5 h-2.5 rounded-full bg-white" /> : <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-end justify-between gap-3 mb-2">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Circle</div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewCircle();
                }}
                className="text-[11px] font-extrabold text-gray-700 hover:text-gray-900 hover:underline"
              >
                New circle
              </button>
            </div>

            {!circlesLoaded ? (
              <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-600">Loading circles…</div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    onPickCircle(null);
                    onClose();
                  }}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                    !selectedCircleId ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50"
                  )}
                  title={SIDES[side].privacyHint}
                >
                  <div className="min-w-0">
                    <div className={cn("font-bold truncate", !selectedCircleId ? "text-white" : "text-gray-900")}>All {SIDES[side].label}</div>
                    <div className={cn("text-[11px] truncate", !selectedCircleId ? "text-white/80" : "text-gray-500")}>{SIDES[side].privacyHint}</div>
                  </div>
                  {!selectedCircleId ? <span className="w-2.5 h-2.5 rounded-full bg-white" /> : <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />}
                </button>

                {filtered.map((c) => {
                  const active = selectedCircleId === c.id;
                  const members = (c as any) && Array.isArray((c as any).members) ? (c as any).members.length : 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onPickCircle(c.id);
                        onClose();
                      }}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                        active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50"
                      )}
                      title={c.label}
                    >
                      <div className="min-w-0">
                        <div className={cn("font-bold truncate", active ? "text-white" : "text-gray-900")}>{c.label}</div>
                        <div className={cn("text-[11px] truncate", active ? "text-white/80" : "text-gray-500")}>
                          {members ? `${members} people` : "Circle"}
                        </div>
                      </div>
                      {active ? <span className="w-2.5 h-2.5 rounded-full bg-white" /> : <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />}
                    </button>
                  );
                })}

                {filtered.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-dashed border-gray-200 bg-white text-sm text-gray-500">
                    No circles yet. Create one to target a smaller group.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        <button type="button" onClick={onClose} className="w-full mt-4 py-3 font-semibold text-gray-500 hover:bg-gray-50 rounded-xl">
          Done
        </button>
      </div>
    </div>
  );
}
'''.strip("\n")

sub_once(
    r'function\s+TopicPickerSheet\([\s\S]*?\n\}\n\nexport default function ComposeMVP\(',
    AUDIENCE_SHEET + "\n\nexport default function ComposeMVP(",
    flags=re.S,
    label="replace TopicPickerSheet -> AudiencePickerSheet"
)

# 4) Replace picker-open state with single audiencePickerOpen
sub_once(
    r'\n\s*const\s+\[setPickerOpen,\s*setSetPickerOpen\]\s*=\s*useState\(false\);\s*\n\s*const\s+\[topicPickerOpen,\s*setTopicPickerOpen\]\s*=\s*useState\(false\);\s*\n',
    "\n  const [audiencePickerOpen, setAudiencePickerOpen] = useState(false);\n\n",
    flags=re.M,
    label="replace setPickerOpen/topicPickerOpen"
)

# 5) Make audienceLabel the DETAIL only (All / Circle name / Topic)
sub_once(
    r'const audienceLabel\s*=\s*\n\s*side === "public"\s*\n\s*\?\s*FLAGS\.publicChannels\s*\n\s*\?\s*labelForPublicChannel\(publicChannel\)\s*\n\s*:\s*"Public"\s*\n\s*:\s*selectedSet\s*\n\s*\?\s*selectedSet\.label\s*\n\s*:\s*`All\s*\$\{SIDES\[side\]\.label\}`\s*;',
    'const audienceLabel =\n    side === "public"\n      ? (FLAGS.publicChannels ? labelForPublicChannel(publicChannel) : "All")\n      : selectedSet\n        ? selectedSet.label\n        : "All";',
    flags=re.M,
    label="audienceLabel block"
)

# 6) Remove lockTextSimple (we use privacyHint now)
globals()["_S"] = re.sub(r'^\s*const\s+lockTextSimple\s*=.*?;\s*\n', "", globals()["_S"], flags=re.M)

# 7) openAudience opens unified sheet
sub_once(
    r'const openAudience = \(\) => \{\n\s*if \(mismatch\) return;\n[\s\S]*?\n\s*\};',
    'const openAudience = () => {\n    if (mismatch) return;\n    setAudiencePickerOpen(true);\n  };',
    flags=re.S,
    label="openAudience"
)

# 8) Header center: show title instead of SIDES label
globals()["_S"] = globals()["_S"].replace(
    '<div className={cn("text-sm font-extrabold", theme.text)}>{SIDES[side].label}</div>',
    '<div className="text-sm font-extrabold text-gray-900">{title}</div>'
)

# 9) Audience row: one pill (Side • AudienceLabel) + privacy hint
sub_once(
    r'\{/\*\s*Audience row\s*\*/\}\s*\n\s*<div className="px-6[\s\S]*?\n\s*\{reqBanner\}',
    '''{/* Audience row */}
          <div className="px-6 md:px-8 pt-3 pb-3">
            <button
              type="button"
              onClick={openAudience}
              disabled={mismatch}
              className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-full bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Choose audience"
              title="Choose audience"
            >
              <span className={cn("w-2 h-2 rounded-full", theme.primaryBg)} aria-hidden="true" />
              <span className={cn("text-sm font-extrabold", theme.text)}>{SIDES[side].label}</span>
              <span className="text-gray-300">•</span>
              <span className="text-sm font-bold text-gray-900 truncate max-w-[260px]">{audienceLabel}</span>
              <ChevronDown size={16} className="text-gray-400 shrink-0 ml-auto" />
            </button>

            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400 font-semibold">
              {side === "public" ? <Globe size={12} className="text-gray-300" /> : <Lock size={12} className="text-gray-300" />}
              <span>{SIDES[side].privacyHint}</span>
            </div>
          </div>

          {reqBanner}''',
    flags=re.S,
    label="audience row block"
)

# 10) Toast copy: Set -> Circle
globals()["_S"] = globals()["_S"].replace(" • Set:", " • Circle:")

# 11) Replace Audience sheets (CirclePickerSheet + TopicPickerSheet) with unified AudiencePickerSheet
sub_once(
    r'\{/\*\s*Audience sheets\s*\*/\}\s*\n\s*<CirclePickerSheet[\s\S]*?/\>\s*\n\s*\n\s*<TopicPickerSheet[\s\S]*?/\>\s*',
    '''{/* Audience sheet */}
      <AudiencePickerSheet
        open={audiencePickerOpen}
        onClose={() => setAudiencePickerOpen(false)}
        side={side}
        setSide={setSide}
        circles={sets}
        circlesLoaded={setsLoaded}
        selectedCircleId={selectedCircleId}
        onPickCircle={(next) => {
          setSelectedCircleId(next);
          try { setStoredLastSetForSide(side, next); } catch {}
          try { if (next) pushStoredRecentSetForSide(side, next); } catch {}
          try { emitAudienceChanged({ side, setId: next, topic: null, source: "ComposeMVP" }); } catch {}
        }}
        publicChannel={publicChannel}
        onPickTopic={(next) => {
          setPublicChannel(next);
          try { setStoredLastPublicTopic(next || null); } catch {}
          try { emitAudienceChanged({ side: "public", setId: null, topic: next || null, source: "ComposeMVP" }); } catch {}
        }}
        topicsEnabled={FLAGS.publicChannels}
        onNewCircle={() => router.push("/siddes-circles?create=1")}
      />
''',
    flags=re.S,
    label="replace old sheets"
)

# Final sanity: no old picker state refs remain
for bad in ["CirclePickerSheet", "TopicPickerSheet", "setPickerOpen", "topicPickerOpen", "setSetPickerOpen", "setTopicPickerOpen", "lockTextSimple"]:
    if bad in globals()["_S"]:
        raise SystemExit(f"ERROR: leftover reference found: {bad}")

p.write_text(globals()["_S"], encoding="utf-8")
print("OK: patched", str(p))
PY

echo "✅ sd_933 applied. Backup: $BK"
echo ""
echo "Next:"
echo "  ./verify_overlays.sh"
echo "  cd frontend && npm run typecheck && npm run build"
echo "  cd .. && bash scripts/run_tests.sh --smoke"
