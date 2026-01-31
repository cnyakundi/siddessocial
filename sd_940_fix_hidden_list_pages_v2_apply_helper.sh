#!/usr/bin/env bash
set -euo pipefail

# sd_940_fix_hidden_list_pages_v2
# Fix: public followers/following pages must handle { hidden:true } payloads
# so the UI shows a clear "list hidden" message instead of an empty state.

SD_ID="sd_940_fix_hidden_list_pages_v2"

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
  echo "ERROR: Could not find repo root (expected folders: frontend/ and backend/)."
  echo "Run inside the repo, or pass repo path:"
  echo "  ./${SD_ID}_apply_helper.sh /path/to/sidesroot"
  exit 1
fi

cd "$ROOT"

FILES=(
  "frontend/src/app/u/[username]/followers/page.tsx"
  "frontend/src/app/u/[username]/following/page.tsx"
)

missing=0
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "❌ Missing: $f"
    missing=1
  fi
done
if [[ "$missing" -ne 0 ]]; then
  echo ""
  echo "This script must run from your repo root (folder that contains frontend/ and backend/)."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK_DIR=".backup_${SD_ID}_${TS}"
mkdir -p "$BK_DIR"
for f in "${FILES[@]}"; do
  mkdir -p "$BK_DIR/$(dirname "$f")"
  cp -a "$f" "$BK_DIR/$f"
done

echo "== ${SD_ID} =="
echo "Root: $ROOT"
echo "Backup: $BK_DIR"
echo ""

node - <<'NODE'
const fs = require("fs");

const FILES = [
  "frontend/src/app/u/[username]/followers/page.tsx",
  "frontend/src/app/u/[username]/following/page.tsx",
];

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

function indentOfLineAt(src, idx) {
  const lineStart = src.lastIndexOf("\n", idx);
  const start = lineStart >= 0 ? lineStart + 1 : 0;
  const chunk = src.slice(start, idx);
  const m = chunk.match(/^\s*/);
  return m ? m[0] : "";
}

function patchLucideImport(src) {
  const re = /import\s*\{([^}]*)\}\s*from\s*"lucide-react";?/m;
  const m = src.match(re);
  if (!m) return { src, changed: false };
  const inside = m[1];
  if (inside.includes("Lock")) return { src, changed: false };
  const parts = inside.split(",").map((s) => s.trim()).filter(Boolean);
  parts.push("Lock");
  const next = `import { ${uniq(parts).join(", ")} } from "lucide-react";`;
  return { src: src.replace(re, next), changed: true };
}

function patchFollowRespHidden(src) {
  if (src.includes("hidden?: boolean")) return { src, changed: false };

  const re = /type\s+FollowResp\s*=\s*\{([\s\S]*?)\n\};/m;
  const m = src.match(re);
  if (!m) return { src, changed: false };

  let body = m[1];
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

function insertAfterFirstLineMatch(src, lineRegex, lineToInsert) {
  const m = src.match(lineRegex);
  if (!m) return { src, changed: false };
  const idx = src.indexOf(m[0]);
  if (idx < 0) return { src, changed: false };
  const indent = indentOfLineAt(src, idx);
  const insert = indent + lineToInsert + "\n";
  const endIdx = idx + m[0].length;
  const next = src.slice(0, endIdx) + "\n" + insert + src.slice(endIdx + 1); // keep one newline
  return { src: next, changed: true };
}

function patchHiddenState(src) {
  if (src.includes("const [hidden, setHidden]")) return { src, changed: false };

  // Try after total state
  let out = insertAfterFirstLineMatch(
    src,
    /^\s*const\s+\[total,\s*setTotal\]\s*=\s*useState<[^>]*>\([^\)]*\);\s*$/m,
    "const [hidden, setHidden] = useState(false);"
  );
  if (out.changed) return out;

  // Try after nextCursor state
  out = insertAfterFirstLineMatch(
    src,
    /^\s*const\s+\[nextCursor,\s*setNextCursor\]\s*=\s*useState<[^>]*>\([^\)]*\);\s*$/m,
    "const [hidden, setHidden] = useState(false);"
  );
  if (out.changed) return out;

  // Try after items state
  out = insertAfterFirstLineMatch(
    src,
    /^\s*const\s+\[items,\s*setItems\]\s*=\s*useState<[^>]*>\([^\)]*\);\s*$/m,
    "const [hidden, setHidden] = useState(false);"
  );
  return out;
}

function patchSetHiddenFromResp(src) {
  // If already patched, skip.
  if (src.includes("const isHidden = !!(j as any).hidden")) return { src, changed: false };

  // Anchor on: const got = Array.isArray(j.items) ? j.items : [];
  const reGot = /^\s*const\s+got\s*=\s*Array\.isArray\(j\.items\)\s*\?\s*j\.items\s*:\s*\[\];\s*$/m;
  const m = src.match(reGot);
  if (!m) return { src, changed: false };

  const gotLine = m[0];
  const idx = src.indexOf(gotLine);
  if (idx < 0) return { src, changed: false };
  const indent = indentOfLineAt(src, idx);

  const insert =
`${indent}const isHidden = !!(j as any).hidden;
${indent}setHidden(isHidden);

`;

  let next = src.slice(0, idx) + insert + src.slice(idx);

  // Ensure load() starts by clearing hidden (prevents stale hidden if a later fetch errors).
  if (!next.includes("setHidden(false);")) {
    const reSetLoading = /(\n\s*setLoading\(true\);\s*\n)/m;
    next = next.replace(reSetLoading, (mm) => mm + `${indent}setHidden(false);\n`);
  }

  // Insert an early return after the first setNextCursor(...) that occurs AFTER gotLine
  // (so total/nextCursor are still updated).
  if (!next.includes("if (isHidden) {")) {
    const from = next.indexOf(gotLine);
    const idxNextCursor = next.indexOf("setNextCursor(", from >= 0 ? from : 0);
    if (idxNextCursor >= 0) {
      const semi = next.indexOf(";", idxNextCursor);
      if (semi >= 0) {
        const afterSemi = semi + 1;
        const inner = indent + "  ";
        const block =
`\n${indent}if (isHidden) {\n${inner}setItems([]);\n${inner}setNextCursor(null);\n${inner}return;\n${indent}}\n`;
        next = next.slice(0, afterSemi) + block + next.slice(afterSemi);
      }
    }
  }

  return { src: next, changed: next !== src };
}

function patchHiddenRenderBranch(src) {
  if (src.includes("This list is hidden")) return { src, changed: false };

  // Most pages use a ternary chain with this exact marker.
  const marker = ") : items.length ? (";
  const idx = src.indexOf(marker);
  if (idx < 0) {
    // Fallback: no safe marker to patch.
    return { src, changed: false };
  }

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
  if (src.includes("{hidden ? <Lock")) return { src, changed: false };

  const re = /<div className="text-lg font-black text-gray-900">([^<]+)<\/div>/m;
  const m = src.match(re);
  if (!m) return { src, changed: false };
  const title = m[1];
  const repl = `<div className="text-lg font-black text-gray-900 flex items-center gap-2">${title} {hidden ? <Lock size={16} className="text-gray-300" /> : null}</div>`;
  return { src: src.replace(re, repl), changed: true };
}

function ensureMarker(src) {
  if (src.includes("sd_940_fix_hidden_list_pages_v2")) return src;
  return src + `\n\n// sd_940_fix_hidden_list_pages_v2\n`;
}

function patchOne(path) {
  let src = fs.readFileSync(path, "utf8");
  const orig = src;

  src = ensureMarker(src);

  for (const fn of [
    patchLucideImport,
    patchFollowRespHidden,
    patchHiddenState,
    patchSetHiddenFromResp,
    patchHiddenRenderBranch,
    patchHeaderTitleLock,
  ]) {
    const out = fn(src);
    src = out.src;
  }

  if (src !== orig) {
    fs.writeFileSync(path, src, "utf8");
    console.log("✅ Patched:", path);
  } else {
    console.log("ℹ️ No changes:", path);
  }
}

for (const p of FILES) patchOne(p);
NODE

echo ""
echo "✅ DONE: ${SD_ID}"
echo "Backup: ${BK_DIR}"
echo ""
echo "Next (VS Code terminal):"
echo "  cd \"${ROOT}\""
echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
echo "  npm run typecheck"
echo "  npm run build"
echo ""
echo "Smoke test:"
echo "  - Visit /u/<someone>/followers and /u/<someone>/following"
echo "  - If lists are hidden: you should see 'This list is hidden' (not an empty state)"
