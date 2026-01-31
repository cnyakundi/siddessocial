#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_932_compose_unified_audience_sheet"

find_repo_root() {
  local d="${1:-$PWD}"
  if [[ -n "${1:-}" ]]; then
    if [[ -d "$1/frontend" && -d "$1/backend" ]]; then
      (cd "$1" && pwd)
      return 0
    fi
  fi
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/frontend" && -d "$d/backend" ]]; then
      (cd "$d" && pwd)
      return 0
    fi
    d="$(cd "$d/.." && pwd)"
  done
  return 1
}

ROOT="$(find_repo_root "${1:-}" || true)"
if [[ -z "${ROOT:-}" ]]; then
  echo "ERROR: Could not find repo root. Run inside the repo, or pass repo path:"
  echo "  ./${SD_ID}_apply_helper.sh /path/to/siddessocial"
  exit 1
fi

PYBIN="python3"
if ! command -v "$PYBIN" >/dev/null 2>&1; then
  PYBIN="python"
fi
if ! command -v "$PYBIN" >/dev/null 2>&1; then
  echo "ERROR: python3 (or python) is required."
  exit 1
fi

FILE="$ROOT/frontend/src/app/siddes-compose/ComposeMVP.tsx"
STATE="$ROOT/docs/STATE.md"

if [[ ! -f "$FILE" ]]; then
  echo "ERROR: Missing $FILE"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_${SD_ID}_${TS}"
mkdir -p "$BK"
cp "$FILE" "$BK/ComposeMVP.tsx"
[[ -f "$STATE" ]] && cp "$STATE" "$BK/STATE.md" || true

"$PYBIN" - "$FILE" <<'PY'
import pathlib, re, sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")
orig = s

if "function AudiencePickerSheet" in s and "audiencePickerOpen" in s:
    print("SKIP: ComposeMVP already patched for sd_932.")
    raise SystemExit(0)

def sub_once(pattern, repl, flags=0, label=""):
    global s
    new, n = re.subn(pattern, repl, s, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"ERROR: {label or pattern} (expected 1 match, got {n})")
    s = new

# 1) Import SIDE_ORDER
if "SIDE_ORDER" not in s:
    s = re.sub(
        r'import\s+\{\s*SIDES,\s*SIDE_THEMES,\s*isSideId,\s*type SideId\s*\}\s+from\s+"@/src/lib/sides";',
        'import { SIDE_ORDER, SIDES, SIDE_THEMES, isSideId, type SideId } from "@/src/lib/sides";',
        s,
        count=1
    )

# 2) Expand audienceStore import (store + bus)
s = re.sub(
    r'import\s+\{\s*getStoredLastPublicTopic,\s*getStoredLastSetForSide\s*\}\s+from\s+"@/src/lib/audienceStore";',
    'import { emitAudienceChanged, getStoredLastPublicTopic, getStoredLastSetForSide, pushStoredRecentSetForSide, setStoredLastPublicTopic, setStoredLastSetForSide } from "@/src/lib/audienceStore";',
    s,
    count=1
)

# 3) Remove CirclePickerSheet import (we’ll use one Audience sheet)
s = re.sub(
    r'^\s*import\s+\{\s*CirclePickerSheet\s*\}\s+from\s+"@/src/components/CirclePickerSheet";\s*\n',
    "",
    s,
    flags=re.M
)

# 4) Replace TopicPickerSheet() with AudiencePickerSheet()
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

  const filtered = Array.isArray(circles) ? circles.filter((c) => c && c.side === side) : [];

  const pickCircle = (next: CircleId | null) => {
    onPickCircle(next);
    onClose();
  };

  const pickTopic = (next: PublicChannelId) => {
    onPickTopic(next);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[125] flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Close audience picker"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200 max-h-[80dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Audience</h3>
            <div className="text-xs text-gray-500 mt-1">Pick a Side, then optionally pick a Circle.</div>
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

            {!FLAGS.publicChannels ? (
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
                      onClick={() => pickTopic(c.id)}
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
                  onClick={() => pickCircle(null)}
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
                  const members = Array.isArray((c as any).members) ? (c as any).members.length : 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickCircle(c.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                        active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50"
                      )}
                      title={c.label}
                    >
                      <div className="min-w-0">
                        <div className={cn("font-bold truncate", active ? "text-white" : "text-gray-900")}>{c.label}</div>
                        <div className={cn("text-[11px] truncate", active ? "text-white/80" : "text-gray-500")}>
                          {members ? f"{members} people" : "Circle"}
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

# 5) Replace picker-open state with single audiencePickerOpen
sub_once(
    r'\n\s*const\s+\[setPickerOpen,\s*setSetPickerOpen\]\s*=\s*useState\(false\);\s*\n\s*const\s+\[topicPickerOpen,\s*setTopicPickerOpen\]\s*=\s*useState\(false\);\s*\n',
    "\n\n  const [audiencePickerOpen, setAudiencePickerOpen] = useState(false);\n\n",
    flags=re.M,
    label="replace setPickerOpen/topicPickerOpen state"
)

# 6) openAudience opens the single sheet
sub_once(
    r'const\s+openAudience\s*=\s*\(\)\s*=>\s*\{[\s\S]*?setSetPickerOpen\(true\);\s*\n\s*\};',
    '  const openAudience = () => {\n    if (mismatch) return;\n    setAudiencePickerOpen(true);\n  };',
    flags=re.S,
    label="openAudience -> setAudiencePickerOpen"
)

# 7) Header center: use title (New Post/New Update)
s = re.sub(
    r'<div className=\{cn\("text-sm font-extrabold", theme\.text\)\}>\{SIDES\[side\]\.label\}</div>',
    '<div className="text-sm font-extrabold text-gray-900">{title}</div>',
    s,
    count=1
)

# 8) Toast copy: Set -> Circle
s = s.replace(" • Set:", " • Circle:")

# 9) Replace bottom sheets with the unified sheet
s = re.sub(
    r'\{/\*\s*Audience sheets\s*\*/\}[\s\S]*?$',
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
          try { setStoredLastPublicTopic(next); } catch {}
          try { emitAudienceChanged({ side: "public", setId: null, topic: next, source: "ComposeMVP" }); } catch {}
        }}
        onNewCircle={() => {
          try { setAudiencePickerOpen(false); } catch {}
          router.push("/siddes-circles?create=1");
        }}
      />
''',
    s,
    flags=re.S
)

p.write_text(s, encoding="utf-8")
print("OK: patched", str(p))
PY

echo ""
echo "== DONE: ${SD_ID} =="
echo "Backup: $BK"
