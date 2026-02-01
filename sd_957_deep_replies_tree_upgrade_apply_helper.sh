#!/usr/bin/env bash
set -euo pipefail

SD_ID="sd_957_deep_replies_tree_upgrade"
ROOT="$(pwd)"

echo "== ${SD_ID} (apply-helper) =="
echo "Repo: ${ROOT}"
echo ""

# Preconditions (prevents wrong folder + cd errors)
for d in backend frontend scripts docs; do
  if [[ ! -d "$ROOT/$d" ]]; then
    echo "❌ Run from repo root. Missing ./$d"
    echo "Tip: cd /Users/cn/Downloads/sidesroot"
    exit 1
  fi
done

VIEWS="backend/siddes_post/views.py"
STATE="docs/STATE.md"

if [[ ! -f "$VIEWS" ]]; then
  echo "❌ Missing: $VIEWS"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required for safe patching."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${SD_ID}_${STAMP}"
mkdir -p "$BK/$(dirname "$VIEWS")" "$BK/$(dirname "$STATE")"
cp -a "$VIEWS" "$BK/$VIEWS"
cp -a "$STATE" "$BK/$STATE" 2>/dev/null || true

echo "✅ Backup: $BK"
echo ""

node <<'NODE'
const fs = require("fs");

const VIEWS = "backend/siddes_post/views.py";
const STATE = "docs/STATE.md";
const MARK = "sd_957_tree_replies";

function must(cond, msg) { if (!cond) throw new Error(msg); }

let s = fs.readFileSync(VIEWS, "utf8");
if (s.includes(MARK)) {
  console.log("NOOP:", VIEWS, "(already patched)");
} else {
  const lines = s.split("\n");

  // Find the PostRepliesView return line (flat replies response)
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.includes('return Response({"ok": True') &&
      line.includes('"postId": post_id') &&
      line.includes('"replies": out')
    ) {
      // Make sure we're in replies view (nearby mention)
      const window = lines.slice(Math.max(0, i - 40), i + 1).join("\n");
      if (window.includes("class PostRepliesView") || window.includes("PostRepliesView")) {
        idx = i;
        break;
      }
    }
  }
  // Fallback: search by '"replies": out' plus postId/count
  if (idx < 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('"replies": out') && line.includes('"postId": post_id') && line.includes("len(out)")) {
        idx = i;
        break;
      }
    }
  }

  must(idx >= 0, "sd_957: could not find PostRepliesView flat return Response line to anchor tree upgrade.");

  const indent = (lines[idx].match(/^\s*/) || [""])[0];

  const block = [
    `${indent}# ${MARK}: optional tree format for deep-thread UI (?tree=1 or ?format=tree).`,
    `${indent}qp = getattr(request, "query_params", None)`,
    `${indent}getq = (qp.get if qp is not None else getattr(request, "GET", {}).get)`,
    `${indent}raw = str(getq("tree") or getq("format") or "").strip().lower()`,
    `${indent}want_tree = raw in ("1", "true", "yes", "y", "on", "tree")`,
    `${indent}if want_tree:`,
    `${indent}    by_id = {}`,
    `${indent}    nodes = []`,
    `${indent}    for x in (out or []):`,
    `${indent}        if not isinstance(x, dict):`,
    `${indent}            continue`,
    `${indent}        node = dict(x)`,
    `${indent}        node.setdefault("replies", [])`,
    `${indent}        rid = str(node.get("id") or "").strip()`,
    `${indent}        if rid:`,
    `${indent}            by_id[rid] = node`,
    `${indent}        nodes.append(node)`,
    ``,
    `${indent}    roots = []`,
    `${indent}    for node in nodes:`,
    `${indent}        pid = str(node.get("parentId") or "").strip()`,
    `${indent}        rid = str(node.get("id") or "").strip()`,
    `${indent}        if pid and pid in by_id and pid != rid:`,
    `${indent}            by_id[pid].setdefault("replies", []).append(node)`,
    `${indent}        else:`,
    `${indent}            roots.append(node)`,
    ``,
    `${indent}    def _sort_tree(n):`,
    `${indent}        try:`,
    `${indent}            kids = list(n.get("replies") or [])`,
    `${indent}            kids.sort(key=lambda c: int((c or {}).get("createdAt") or 0))`,
    `${indent}            n["replies"] = kids`,
    `${indent}            for c in kids:`,
    `${indent}                if isinstance(c, dict):`,
    `${indent}                    _sort_tree(c)`,
    `${indent}        except Exception:`,
    `${indent}            return`,
    ``,
    `${indent}    for r0 in roots:`,
    `${indent}        if isinstance(r0, dict):`,
    `${indent}            _sort_tree(r0)`,
    ``,
    `${indent}    return Response({"ok": True, "postId": post_id, "count": len(out), "flatCount": len(out), "format": "tree", "replies": roots, "viewerAuthed": bool(has_viewer)}, status=status.HTTP_200_OK)`,
    ``,
  ];

  lines.splice(idx, 0, ...block);
  s = lines.join("\n");
  fs.writeFileSync(VIEWS, s, "utf8");
  console.log("PATCHED:", VIEWS);
}

// docs/STATE.md best-effort
try {
  if (fs.existsSync(STATE)) {
    const mark = "**sd_957:** Replies API: add optional tree format (`?tree=1`) so PostDetail can render deep threads recursively.";
    let t = fs.readFileSync(STATE, "utf8");
    if (!t.includes(mark)) {
      const line = `- ${mark}\n`;
      if (t.includes("## NEXT overlay")) t = t.replace("## NEXT overlay", "## NEXT overlay\n" + line);
      else t += "\n\n## NEXT overlay\n" + line;
      fs.writeFileSync(STATE, t, "utf8");
      console.log("PATCHED:", STATE);
    }
  }
} catch {}
NODE

echo ""
echo "== Quick sanity =="
git diff --stat || true
echo ""

echo "== Gates =="
./verify_overlays.sh
(
  cd frontend
  npm run typecheck
  npm run build
)
bash scripts/run_tests.sh --smoke

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK}"
