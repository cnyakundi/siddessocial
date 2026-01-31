#!/usr/bin/env bash
set -euo pipefail

NAME="sd_940_fix_hidden_list_pages_v4"

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
  echo "Run this from repo root (folder containing frontend/ and backend/)."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK_DIR=".backup_${NAME}_${TS}"
mkdir -p "$BK_DIR"
for f in "${FILES[@]}"; do
  mkdir -p "$BK_DIR/$(dirname "$f")"
  cp -a "$f" "$BK_DIR/$f"
done

echo "== ${NAME} =="
echo "Backup: $BK_DIR"
echo ""

node - <<'NODE'
const fs = require("fs");

const targets = [
  { path: "frontend/src/app/u/[username]/followers/page.tsx", title: "Followers", trouble: "followers" },
  { path: "frontend/src/app/u/[username]/following/page.tsx", title: "Following", trouble: "following" },
];

function mustInclude(src, needle, why) {
  if (!src.includes(needle)) throw new Error(`Missing anchor (${why}): ${needle}`);
}

function patchLucideImport(src) {
  if (src.includes('{ ChevronLeft, Lock } from "lucide-react"')) return src;
  if (src.includes('import { ChevronLeft } from "lucide-react";')) {
    return src.replace('import { ChevronLeft } from "lucide-react";', 'import { ChevronLeft, Lock } from "lucide-react";');
  }
  // fallback: inject Lock into existing lucide import
  return src.replace(/import\s*\{([^}]*)\}\s*from\s*"lucide-react";/m, (m, inner) => {
    const parts = inner.split(",").map(s => s.trim()).filter(Boolean);
    if (!parts.includes("Lock")) parts.push("Lock");
    return `import { ${parts.join(", ")} } from "lucide-react";`;
  });
}

function patchFollowResp(src) {
  if (src.includes("hidden?: boolean")) return src;

  mustInclude(src, "type FollowResp", "FollowResp type");
  // Insert after error?: line (or after ok:)
  if (src.includes("error?: string;")) {
    return src.replace("error?: string;\n", "error?: string;\n  hidden?: boolean;\n");
  }
  return src.replace("ok: boolean;\n", "ok: boolean;\n  hidden?: boolean;\n");
}

function patchHiddenState(src) {
  if (src.includes("const [hidden, setHidden]")) return src;
  mustInclude(src, "const [total, setTotal]", "total state");
  return src.replace(
    "  const [total, setTotal] = useState<number | null>(null);\n",
    "  const [total, setTotal] = useState<number | null>(null);\n\n  const [hidden, setHidden] = useState(false);\n"
  );
}

function patchLoadResets(src) {
  // Ensure we clear hidden every load (prevents stale hidden UI after changing setting)
  if (src.includes("setHidden(false);")) return src;
  mustInclude(src, "setTrouble(null);", "load() preflight");
  return src.replace(
    "      setTrouble(null);\n",
    "      setTrouble(null);\n      setHidden(false);\n"
  );
}

function patchReadHidden(src) {
  if (src.includes("const isHidden = !!(j as any).hidden")) return src;

  // Insert right before `const got = ...`
  const re = /\n(\s*)const got = Array\.isArray\(j\.items\) \? j\.items : \[\];\n/;
  if (!re.test(src)) throw new Error("Could not find `const got = Array.isArray...` anchor");
  return src.replace(re, (m, indent) => {
    return (
      "\n" +
      `${indent}const isHidden = !!(j as any).hidden;\n` +
      `${indent}setHidden(isHidden);\n\n` +
      `${indent}const got = Array.isArray(j.items) ? j.items : [];\n`
    );
  });
}

function patchEarlyReturnIfHidden(src) {
  if (src.includes("if (isHidden) {")) return src;

  const re = /\n(\s*)setNextCursor\(String\(j\.nextCursor \|\| ""\)\.trim\(\) \|\| null\);\n/;
  if (!re.test(src)) throw new Error("Could not find setNextCursor(String(j.nextCursor || \"\").trim() || null);");
  return src.replace(re, (m, indent) => {
    const inner = indent + "  ";
    return (
      "\n" +
      `${indent}setNextCursor(String(j.nextCursor || "").trim() || null);\n` +
      `${indent}if (isHidden) {\n` +
      `${inner}if (!isMore) setItems([]);\n` +
      `${inner}setNextCursor(null);\n` +
      `${inner}return;\n` +
      `${indent}}\n`
    );
  });
}

function patchHeaderLock(src, title) {
  if (src.includes("{hidden ? <Lock")) return src;
  const needle = `<div className="text-lg font-black text-gray-900">${title}</div>`;
  if (!src.includes(needle)) return src;
  return src.replace(
    needle,
    `<div className="text-lg font-black text-gray-900 flex items-center gap-2">${title} {hidden ? <Lock size={16} className="text-gray-300" /> : null}</div>`
  );
}

function patchRenderHiddenBranch(src) {
  if (src.includes("This list is hidden")) return src;
  const marker = ") : items.length ? (";
  mustInclude(src, marker, "render ternary marker");

  return src.replace(
    marker,
`) : hidden ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-black text-gray-900">
              <Lock size={16} className="text-gray-400" /> This list is hidden
            </div>
            <div className="text-xs text-gray-500 mt-1">Only the owner can see the names. Counts may still be visible.</div>
          </div>
        ) : items.length ? (`
  );
}

for (const t of targets) {
  let s = fs.readFileSync(t.path, "utf8");
  const orig = s;

  s = patchLucideImport(s);
  s = patchFollowResp(s);
  s = patchHiddenState(s);
  s = patchLoadResets(s);
  s = patchReadHidden(s);
  s = patchEarlyReturnIfHidden(s);
  s = patchHeaderLock(s, t.title);
  s = patchRenderHiddenBranch(s);

  if (!s.includes("sd_940_fix_hidden_list_pages_v4")) {
    s += "\n\n// sd_940_fix_hidden_list_pages_v4\n";
  }

  if (s !== orig) {
    fs.writeFileSync(t.path, s, "utf8");
    console.log("✅ Patched:", t.path);
  } else {
    console.log("ℹ️ No changes:", t.path);
  }
}
NODE

echo ""
echo "✅ DONE: ${NAME}"
echo "Backup: ${BK_DIR}"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck && npm run build"
echo "  cd .."
echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
echo "  bash scripts/run_tests.sh --smoke"
