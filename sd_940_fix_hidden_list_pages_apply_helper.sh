#!/usr/bin/env bash
set -euo pipefail

NAME="sd_940_fix_hidden_list_pages"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

FILES=(
  "frontend/src/app/u/[username]/followers/page.tsx"
  "frontend/src/app/u/[username]/following/page.tsx"
)

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "❌ Missing: $f"
    echo "Run this from repo root (the folder containing frontend/)."
    exit 1
  fi
done

TS="$(date +%Y%m%d_%H%M%S)"
BK_DIR=".backup_${NAME}_${TS}"
mkdir -p "$BK_DIR"
for f in "${FILES[@]}"; do
  mkdir -p "$BK_DIR/$(dirname "$f")"
  cp -a "$f" "$BK_DIR/$f"
done
echo "Backup: $BK_DIR"

node - <<'NODE'
const fs = require("fs");

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const v = String(x || "").trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function patchLucideImport(src) {
  const re = /import\s*\{([^}]*)\}\s*from\s*\"lucide-react\";?/m;
  const m = src.match(re);
  if (!m) return { src, changed: false };
  const inside = m[1];
  if (inside.includes("Lock")) return { src, changed: false };
  const parts = inside.split(",").map((s) => s.trim()).filter(Boolean);
  parts.push("Lock");
  const next = `import { ${uniq(parts).join(", ")} } from "lucide-react";`;
  return { src: src.replace(re, next), changed: true };
}

function patchFollowResp(src) {
  if (src.includes("hidden?: boolean")) return { src, changed: false };

  const re = /type\s+FollowResp\s*=\s*\{([\s\S]*?)\n\};/m;
  const m = src.match(re);
  if (!m) return { src, changed: false };

  let body = m[1];
  // Insert after error?: line if present, else after ok:
  if (body.includes("error?:")) {
    body = body.replace(/(\n\s*error\?:[^\n]*\n)/, `$1  hidden?: boolean;\n`);
  } else if (body.includes("ok:")) {
    body = body.replace(/(\n\s*ok:\s*boolean;[^\n]*\n)/, `$1  hidden?: boolean;\n`);
  } else {
    body = `\n  hidden?: boolean;${body}`;
  }

  const next = src.replace(re, `type FollowResp = {${body}\n};`);
  return { src: next, changed: next !== src };
}

function patchHiddenState(src) {
  if (src.includes("const [hidden, setHidden]")) return { src, changed: false };

  // Prefer placing after total state
  const reTotal = /(const\s+\[total,\s*setTotal\]\s*=\s*useState<[^>]*>\([^\)]*\);\s*\n)/m;
  if (reTotal.test(src)) {
    const next = src.replace(reTotal, (m) => m + `const [hidden, setHidden] = useState(false);\n`);
    return { src: next, changed: true };
  }

  // Fallback: after nextCursor state
  const reCursor = /(const\s+\[nextCursor,\s*setNextCursor\]\s*=\s*useState<[^>]*>\([^\)]*\);\s*\n)/m;
  if (reCursor.test(src)) {
    const next = src.replace(reCursor, (m) => m + `const [hidden, setHidden] = useState(false);\n`);
    return { src: next, changed: true };
  }

  return { src, changed: false };
}

function patchSetHiddenFromResp(src) {
  if (src.includes("const isHidden = !!(j as any).hidden")) return { src, changed: false };

  const anchor = "const got = Array.isArray(j.items) ? j.items : [];";
  const idx = src.indexOf(anchor);
  if (idx < 0) return { src, changed: false };

  const insert =
`const isHidden = !!(j as any).hidden;
        setHidden(isHidden);

        `;

  const next = src.slice(0, idx) + insert + src.slice(idx);

  // After nextCursor set, add early return for hidden if possible
  if (!next.includes("if (isHidden) {")) {
    const anchor2 = "setNextCursor(String(j.nextCursor || "").trim() || null);";
    const idx2 = next.indexOf(anchor2);
    if (idx2 >= 0) {
      const afterIdx = idx2 + anchor2.length;
      const block =
`
        if (isHidden) {
          if (!isMore) setItems([]);
          setNextCursor(null);
          return;
        }
`;
      return { src: next.slice(0, afterIdx) + block + next.slice(afterIdx), changed: true };
    }
  }

  return { src: next, changed: true };
}

function patchHiddenRenderBranch(src) {
  if (src.includes("This list is hidden")) return { src, changed: false };

  const marker = ") : items.length ? (";
  const idx = src.indexOf(marker);
  if (idx < 0) return { src, changed: false };

  const hiddenBranch =
`) : hidden ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-black text-gray-900">
              <Lock size={16} className="text-gray-400" /> This list is hidden
            </div>
            <div className="text-xs text-gray-500 mt-1">Only the owner can see the names. Counts may still be visible.</div>
          </div>
        ) : items.length ? (`;

  return { src: src.replace(marker, hiddenBranch), changed: true };
}

function patchHeaderTitleLock(src) {
  // Optional: add lock icon in title if hidden; safe and idempotent.
  if (src.includes("{hidden ? <Lock")) return { src, changed: false };

  // Replace first occurrence of a title div like: <div className="text-lg font-black text-gray-900">Followers</div>
  const re = /<div className=\"text-lg font-black text-gray-900\">([^<]+)<\/div>/m;
  const m = src.match(re);
  if (!m) return { src, changed: false };
  const title = m[1];
  const repl = `<div className="text-lg font-black text-gray-900 flex items-center gap-2">${title} {hidden ? <Lock size={16} className="text-gray-300" /> : null}</div>`;
  return { src: src.replace(re, repl), changed: true };
}

function patchFile(path) {
  let src = fs.readFileSync(path, "utf8");
  const orig = src;

  // Marker
  if (!src.includes("sd_940_fix_hidden_list_pages")) {
    src = src + `

// sd_940_fix_hidden_list_pages
`;
  }

  // Apply patches
  let did = false;
  for (const fn of [patchLucideImport, patchFollowResp, patchHiddenState, patchSetHiddenFromResp, patchHiddenRenderBranch, patchHeaderTitleLock]) {
    const out = fn(src);
    src = out.src;
    did = did || out.changed;
  }

  if (src !== orig) {
    fs.writeFileSync(path, src, "utf8");
    console.log("✅ Patched:", path);
  } else {
    console.log("ℹ️ No changes:", path);
  }
}

patchFile("frontend/src/app/u/[username]/followers/page.tsx");
patchFile("frontend/src/app/u/[username]/following/page.tsx");
NODE

echo ""
echo "✅ ${NAME} applied."
echo ""
echo "Next:"
echo "  cd "$ROOT""
echo "  ./verify_overlays.sh"
echo "  cd frontend && npm run typecheck && npm run build"
echo ""
echo "Then run backend migrate + restart (sd_940 added a migration):"
echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
