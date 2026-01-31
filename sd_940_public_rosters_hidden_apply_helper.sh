#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

if [ ! -d "$ROOT/backend" ] || [ ! -d "$ROOT/frontend" ]; then
  echo "ERROR: Run from your sidesroot repo root (folder containing backend/ and frontend/)."
  echo "Usage: $0 /path/to/sidesroot"
  exit 1
fi

cd "$ROOT"

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_sd_940_public_rosters_hidden_${TS}"
mkdir -p "$BK"

backup_file() {
  local rel="$1"
  local src="$ROOT/$rel"
  if [ -f "$src" ]; then
    mkdir -p "$BK/$(dirname "$rel")"
    cp -a "$src" "$BK/$rel"
  fi
}

echo "== sd_940: Public roster privacy (hide follower/following lists; counts remain) =="

# Backups
backup_file "backend/siddes_prism/models.py"
backup_file "backend/siddes_prism/views.py"
backup_file "backend/siddes_prism/migrations/0009_public_rosters_hidden.py"
backup_file "frontend/src/components/PrismProfile.tsx"
backup_file "frontend/src/app/siddes-profile/prism/page.tsx"
backup_file "frontend/src/components/ProfileV2Header.tsx"
backup_file "frontend/src/app/u/[username]/followers/page.tsx"
backup_file "frontend/src/app/u/[username]/following/page.tsx"

PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "ERROR: python3 is required for this apply-helper."
  exit 1
fi

# ------------------------------------------------------------
# 1) Backend: add PrismFacet.public_rosters_hidden field
# ------------------------------------------------------------
"$PYTHON_BIN" - <<'PY'
from pathlib import Path
import re

p = Path("backend/siddes_prism/models.py")
t = p.read_text()

if "public_rosters_hidden" in t:
    print("OK: PrismFacet.public_rosters_hidden already present")
else:
    pat = r'(\n\s*avatar_media_key\s*=\s*models\.CharField[^\n]*\n)'
    ins = r'\1\n    # Public-only: hide follower/following lists (counts stay visible)\n    public_rosters_hidden = models.BooleanField(default=False)\n'
    nt, n = re.subn(pat, ins, t, count=1)
    if n == 0:
        raise SystemExit("ERROR: Could not find avatar_media_key field to insert after.")
    p.write_text(nt)
    print("OK: inserted PrismFacet.public_rosters_hidden")
PY

# ------------------------------------------------------------
# 2) Backend: migration 0009_public_rosters_hidden.py
# ------------------------------------------------------------
MIG="$ROOT/backend/siddes_prism/migrations/0009_public_rosters_hidden.py"
if [ ! -f "$MIG" ]; then
  cat > "$MIG" <<'EOF'
from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("siddes_prism", "0008_public_follow"),
    ]

    operations = [
        migrations.AddField(
            model_name="prismfacet",
            name="public_rosters_hidden",
            field=models.BooleanField(default=False),
        ),
    ]
EOF
  echo "OK: wrote backend/siddes_prism/migrations/0009_public_rosters_hidden.py"
else
  echo "OK: migration 0009_public_rosters_hidden.py already exists"
fi

# ------------------------------------------------------------
# 3) Backend: wire setting into facet dict + patch + enforce on public rosters
# ------------------------------------------------------------
"$PYTHON_BIN" - <<'PY'
from pathlib import Path
import re

p = Path("backend/siddes_prism/views.py")
t = p.read_text()

# 3a) Expose in _facet_dict so frontend can read it
if '"publicRostersHidden"' not in t:
    t2, n = re.subn(
        r'("avatarImage": _avatar_url_for_facet\(f\),\n)',
        r'\1        "publicRostersHidden": bool(getattr(f, "public_rosters_hidden", False)),\n',
        t,
        count=1,
    )
    if n == 0:
        print("WARN: Could not insert publicRostersHidden into _facet_dict (anchor not found).")
    else:
        t = t2
        print("OK: added publicRostersHidden to _facet_dict")
else:
    print("OK: _facet_dict already includes publicRostersHidden")

# 3b) Allow owner to PATCH it via /api/prism (public facet only)
if "f.public_rosters_hidden" not in t:
    pat = r'(\n\s*_set_str\("avatar_media_key",\s*"avatarMediaKey",\s*512\)\n)'
    ins = r"""\1
        # sd_940_public_rosters_hidden: allow owner to hide public follower/following lists
        if side == "public" and "publicRostersHidden" in body:
            want = body.get("publicRostersHidden")
            try:
                f.public_rosters_hidden = bool(want) if isinstance(want, (bool, int)) else _truthy(str(want))
            except Exception:
                f.public_rosters_hidden = False
"""
    t2, n = re.subn(pat, ins, t, count=1)
    if n == 0:
        print("WARN: Could not insert PrismView.patch handler for publicRostersHidden (anchor not found).")
    else:
        t = t2
        print("OK: added PrismView.patch handler for publicRostersHidden")
else:
    print("OK: PrismView.patch already handles public_rosters_hidden")

# 3c) Enforce on public roster endpoints (followers/following)
def patch_roster_block(class_name: str, count_expr: str):
    global t
    start = t.find(f"class {class_name}")
    if start == -1:
        print(f"WARN: {class_name} not found; skipping roster hide patch")
        return
    end = t.find("class ", start + 10)
    if end == -1:
        end = len(t)

    block = t[start:end]
    if "sd_940_public_rosters_hidden_rosters" in block:
        print(f"OK: {class_name} already patched for hidden rosters")
        return

    needle = '\n        lim_raw = str(getattr(request, "query_params", {}).get("limit") or "").strip()\n'
    idx = block.find(needle)
    if idx == -1:
        print(f"WARN: Could not find limit parse in {class_name}; skipping")
        return

    insert = f"""
        # sd_940_public_rosters_hidden_rosters: if target hides rosters, return counts only (owner can still see)
        hidden = False
        try:
            pf = PrismFacet.objects.filter(user=target, side="public").first()
            hidden = bool(getattr(pf, "public_rosters_hidden", False)) if pf else False
        except Exception:
            hidden = False

        if hidden and (not viewer or getattr(viewer, "id", None) != getattr(target, "id", None)):
            total = None
            try:
                total = int({count_expr})
            except Exception:
                total = None
            resp = Response({{"ok": True, "hidden": True, "items": [], "nextCursor": None, "total": total}}, status=status.HTTP_200_OK)
            resp["Cache-Control"] = "private, no-store"
            resp["Vary"] = "Cookie, Authorization"
            return resp
"""

    block = block[:idx] + insert + block[idx:]
    t = t[:start] + block + t[end:]
    print(f"OK: patched {class_name} to respect public_rosters_hidden")

patch_roster_block("PublicFollowersView", "UserFollow.objects.filter(target=target).count()")
patch_roster_block("PublicFollowingView", "UserFollow.objects.filter(follower=target).count()")

p.write_text(t)
print("OK: wrote backend/siddes_prism/views.py")
PY

# ------------------------------------------------------------
# 4) Frontend: types + toggle in PrismFacetEditSheet
# ------------------------------------------------------------
"$PYTHON_BIN" - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/PrismProfile.tsx")
t = p.read_text()

# 4a) Extend PrismFacet type
if "publicRostersHidden" not in t:
    t2, n = re.subn(
        r'(avatarMediaKey\?: string \| null;\n\};)',
        r'avatarMediaKey?: string | null;\n  publicRostersHidden?: boolean | null;\n};',
        t,
        count=1
    )
    if n == 0:
        print("WARN: Could not patch PrismFacet type (anchor not found).")
    else:
        t = t2
        print("OK: added publicRostersHidden to PrismFacet type")

# 4b) Extend PrismFacetEditSheet onSave patch type
if "publicRostersHidden?: boolean;" not in t:
    t2, n = re.subn(
        r'(avatarMediaKey\?: string;\n\s*\}\) => Promise<void>;)',
        r'avatarMediaKey?: string;\n    publicRostersHidden?: boolean;\n  }) => Promise<void>;',
        t,
        count=1
    )
    if n == 0:
        print("WARN: Could not extend PrismFacetEditSheet onSave type (anchor not found).")
    else:
        t = t2
        print("OK: extended PrismFacetEditSheet onSave type")

# 4c) Add state + init for publicRostersHidden
if "const [publicRostersHidden" not in t:
    t2, n = re.subn(
        r'(const \[pulseText, setPulseText\] = useState\(""\);\n)',
        r'\1  const [publicRostersHidden, setPublicRostersHidden] = useState(false);\n',
        t,
        count=1
    )
    if n == 0:
        print("WARN: Could not add publicRostersHidden state (anchor not found).")
    else:
        t = t2
        print("OK: added publicRostersHidden state")

if "setPublicRostersHidden" not in t:
    # Initialize in the existing useEffect([open, facet])
    t2, n = re.subn(
        r'(setPulseText\(String\(facet\?\.pulse\?\.\text \|\| ""\)\);\n)',
        r'\1    setPublicRostersHidden(bool((facet as any)?.publicRostersHidden));\n',
        t,
        count=1
    )
    if n == 0:
        print("WARN: Could not init publicRostersHidden from facet (anchor not found).")
    else:
        t = t2
        print("OK: initialized publicRostersHidden from facet")

# 4d) Include field in saveNow payload for public side
if "publicRostersHidden:" not in t:
    t2, n = re.subn(
        r'(pulse: \{ label: pulseLabel\.trim\(\), text: pulseText\.trim\(\) \},\n\s*\}\);)',
        r'pulse: { label: pulseLabel.trim(), text: pulseText.trim() },\n        ...(side === "public" ? { publicRostersHidden: !!publicRostersHidden } : {}),\n      });',
        t,
        count=1
    )
    if n == 0:
        print("WARN: Could not include publicRostersHidden in save payload (anchor not found).")
    else:
        t = t2
        print("OK: included publicRostersHidden in save payload")

# 4e) UI toggle block (only when editing Public identity)
if "Hide follower/following lists" not in t:
    marker = '<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">\n            <div>\n              <div className="text-sm font-bold text-gray-900 mb-1">Location</div>'
    idx = t.find(marker)
    if idx == -1:
        print("WARN: Could not find insert location for toggle UI; skipping UI block.")
    else:
        toggle = """
          {side === "public" ? (
            <div className="p-4 rounded-2xl border border-gray-200 bg-white flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900">Hide follower/following lists</div>
                <div className="text-[11px] text-gray-500 mt-1">Counts stay visible. Names are hidden to everyone else.</div>
              </div>
              <button
                type="button"
                onClick={() => setPublicRostersHidden((v) => !v)}
                className={cn(
                  "w-12 h-7 rounded-full p-1 transition-colors flex items-center",
                  publicRostersHidden ? "bg-gray-900" : "bg-gray-300"
                )}
                aria-label={publicRostersHidden ? "Lists hidden" : "Lists visible"}
              >
                <span
                  className={cn(
                    "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                    publicRostersHidden ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          ) : null}

"""
        t = t[:idx] + toggle + t[idx:]
        print("OK: inserted toggle UI in PrismFacetEditSheet")

p.write_text(t)
print("OK: wrote frontend/src/components/PrismProfile.tsx")
PY

# ------------------------------------------------------------
# 5) Frontend: widen saveFacet patch type (so TS accepts publicRostersHidden)
# ------------------------------------------------------------
"$PYTHON_BIN" - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/app/siddes-profile/prism/page.tsx")
t = p.read_text()

if "publicRostersHidden?: boolean;" not in t:
    t2, n = re.subn(
        r'(avatarMediaKey\?: string;\n\s*\}\) => \{)',
        r'avatarMediaKey?: string;\n    publicRostersHidden?: boolean;\n  }) => {',
        t,
        count=1
    )
    if n == 0:
        print("WARN: Could not patch saveFacet type in prism page (anchor not found).")
    else:
        t = t2
        print("OK: extended saveFacet patch type")
else:
    print("OK: prism saveFacet patch type already includes publicRostersHidden")

p.write_text(t)
print("OK: wrote frontend/src/app/siddes-profile/prism/page.tsx")
PY

# ------------------------------------------------------------
# 6) Frontend: ProfileV2Header — lock icon + link to lists when not hidden
# ------------------------------------------------------------
"$PYTHON_BIN" - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/components/ProfileV2Header.tsx")
t = p.read_text()

# 6a) Upgrade Stat() to support href + locked icon
if "locked?: boolean" not in t:
    t2, n = re.subn(
        r'function Stat\(props: \{ label: string; value: React\.ReactNode; subtle\?: boolean \}\) \{\n  const \{ label, value, subtle \} = props;\n  return \(\n    <div className=\{cn\("flex flex-col", subtle \? "opacity-80" : ""\)\}>\n      <span className="text-lg font-black text-gray-900 leading-none tabular-nums">\{value\}</span>\n      <span className="text-\[10px\] font-extrabold text-gray-400 uppercase tracking-widest mt-1">\{label\}</span>\n    </div>\n  \);\n\}\n',
        """function Stat(props: { label: string; value: React.ReactNode; subtle?: boolean; href?: string; locked?: boolean }) {
  const { label, value, subtle, href, locked } = props;

  const Wrapper: any = href && !locked ? "a" : "div";
  const wrapperProps: any = href && !locked ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "flex flex-col",
        subtle ? "opacity-80" : "",
        href && !locked ? "hover:opacity-90 active:opacity-80 transition-opacity" : "",
        locked ? "opacity-80 cursor-default" : ""
      )}
    >
      <span className="text-lg font-black text-gray-900 leading-none tabular-nums">{value}</span>
      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-1 inline-flex items-center gap-1">
        {label}
        {locked ? <Lock size={11} className="text-gray-300" /> : null}
      </span>
    </Wrapper>
  );
}
""",
        t,
        count=1,
    )
    if n == 0:
        print("WARN: Could not upgrade Stat() (anchor not found).")
    else:
        t = t2
        print("OK: upgraded Stat() to support href + locked")
else:
    print("OK: Stat already supports locked/href")

# 6b) Use facet.publicRostersHidden when displaySide is public, and wire links
if "publicRostersHidden" not in t:
    # add computed flags near shownFollowers/shownFollowing
    t2, n = re.subn(
        r'(const shownFollowers = typeof publicFollowers === "number" \? publicFollowers : undefined;\n  const shownFollowing = typeof publicFollowing === "number" \? publicFollowing : undefined;\n)',
        r'\1  const publicRostersHidden = displaySide === "public" ? !!((facet as any)?.publicRostersHidden) : false;\n  const uSlug = (safeHandle || "").replace(/^@/, "").trim();\n  const followersHref = uSlug ? `/u/${encodeURIComponent(uSlug)}/followers` : undefined;\n  const followingHref = uSlug ? `/u/${encodeURIComponent(uSlug)}/following` : undefined;\n',
        t,
        count=1
    )
    if n == 0:
        print("WARN: Could not insert publicRostersHidden flags (anchor not found).")
    else:
        t = t2
        print("OK: inserted publicRostersHidden flags")

# Now patch stats row usage (Public)
t2, n = re.subn(
    r'<Stat label="Followers" value=\{typeof shownFollowers === "undefined" \? "—" : shownFollowers\} subtle />\n\s*<Stat label="Following" value=\{typeof shownFollowing === "undefined" \? "—" : shownFollowing\} subtle />',
    '<Stat label="Followers" value={typeof shownFollowers === "undefined" ? "—" : shownFollowers} subtle href={followersHref} locked={publicRostersHidden} />\n            <Stat label="Following" value={typeof shownFollowing === "undefined" ? "—" : shownFollowing} subtle href={followingHref} locked={publicRostersHidden} />',
    t,
    count=1
)
if n == 0:
    print("WARN: Could not patch stats row Stat usage (anchor not found).")
else:
    t = t2
    print("OK: wired follower/following stats to links + lock")

p.write_text(t)
print("OK: wrote frontend/src/components/ProfileV2Header.tsx")
PY

# ------------------------------------------------------------
# 7) Frontend: followers/following pages handle hidden=true
# ------------------------------------------------------------
"$PYTHON_BIN" - <<'PY'
from pathlib import Path
import re

def patch_list_page(path: str, title: str):
    p = Path(path)
    t = p.read_text()

    # import Lock
    if 'import { ChevronLeft' in t and "Lock" not in t:
        t = t.replace('import { ChevronLeft } from "lucide-react";', 'import { ChevronLeft, Lock } from "lucide-react";')

    # extend FollowResp
    if "hidden?: boolean" not in t:
        t = re.sub(r'(type FollowResp = \{\n  ok: boolean;\n  error\?: string;\n  items\?: FollowItem\[];\n  nextCursor\?: string \| null;\n  total\?: number \| null;\n\};)',
                  r'type FollowResp = {\n  ok: boolean;\n  error?: string;\n  hidden?: boolean;\n  items?: FollowItem[];\n  nextCursor?: string | null;\n  total?: number | null;\n};',
                  t, count=1)

    # add hidden state
    if "const [hidden, setHidden]" not in t:
        t = re.sub(r'(const \[total, setTotal\] = useState<number \| null>\(null\);\n)',
                   r'\1\n  const [hidden, setHidden] = useState(false);\n',
                   t, count=1)

    # when request fails, reset hidden
    if "setHidden(false);" not in t:
        t = re.sub(r'(setTrouble\(j\?\.\error \|\| \(res\.status === 404 \? "not_found" : "request_failed"\)\);\n)',
                   r'\1          setHidden(false);\n',
                   t, count=1)

    # setHidden from response, and if hidden then clear items and stop
    if "const isHidden = !!(j as any).hidden" not in t:
        t = re.sub(
            r'(const got = Array\.isArray\(j\.items\) \? j\.items : \[\];\n\s*setTotal\(typeof j\.total === "number" \? j\.total : null\);\n\s*setNextCursor\(String\(j\.nextCursor \|\| ""\)\.trim\(\) \|\| null\);\n)',
            r'const isHidden = !!(j as any).hidden;\n        setHidden(isHidden);\n\n        const got = Array.isArray(j.items) ? j.items : [];\n        setTotal(typeof j.total === "number" ? j.total : null);\n        setNextCursor(String(j.nextCursor || "").trim() || null);\n\n        if (isHidden) {\n          if (!isMore) setItems([]);\n          setNextCursor(null);\n          return;\n        }\n',
            t,
            count=1,
        )

    # render: add hidden branch
    if "This list is hidden" not in t:
        t = t.replace(
            ') : items.length ? (',
            ') : hidden ? (\n          <div className="rounded-2xl border border-gray-200 bg-white p-4">\n            <div className="flex items-center gap-2 text-sm font-black text-gray-900">\n              <Lock size={16} className="text-gray-400" /> This list is hidden\n            </div>\n            <div className="text-xs text-gray-500 mt-1">Only the owner can see the names. Counts may still be visible.</div>\n          </div>\n        ) : items.length ? (',
            1
        )

    # header title lock icon
    t = t.replace(
        f'<div className="text-lg font-black text-gray-900">{title}</div>',
        f'<div className="text-lg font-black text-gray-900 flex items-center gap-2">{title} {{hidden ? <Lock size={{16}} className="text-gray-300" /> : null}}</div>',
        1
    )

    p.write_text(t)
    print("OK:", path)

patch_list_page("frontend/src/app/u/[username]/followers/page.tsx", "Followers")
patch_list_page("frontend/src/app/u/[username]/following/page.tsx", "Following")
PY

echo ""
echo "DONE: sd_940 applied."
echo ""
echo "NEXT STEPS (VS Code terminal):"
echo "1) Run backend migrations:"
echo "   docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "2) Restart backend:"
echo "   docker compose -f ops/docker/docker-compose.dev.yml restart backend"
echo "3) Frontend typecheck/build:"
echo "   cd frontend && npm run typecheck && npm run build"
echo ""
echo "SMOKE TEST:"
echo "A) As owner: open /siddes-profile/prism → edit Public identity → toggle 'Hide follower/following lists' → Save"
echo "B) As another user: open /u/<you>/followers and /u/<you>/following → should show 'This list is hidden'"
echo "C) Toggle OFF → lists should show again"
echo ""
echo "Backup saved to: $BK"
