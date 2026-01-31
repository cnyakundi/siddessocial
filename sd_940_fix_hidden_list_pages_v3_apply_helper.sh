#!/usr/bin/env bash
set -euo pipefail

NAME="sd_940_fix_hidden_list_pages_v3"

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
  echo "Run this from your repo root (folder containing frontend/ and backend/)."
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
  "frontend/src/app/u/[username]/followers/page.tsx",
  "frontend/src/app/u/[username]/following/page.tsx",
];

function patchOne(path) {
  let s = fs.readFileSync(path, "utf8");
  const orig = s;

  // 1) Import Lock icon
  if (s.includes('import { ChevronLeft } from "lucide-react";')) {
    s = s.replace('import { ChevronLeft } from "lucide-react";', 'import { ChevronLeft, Lock } from "lucide-react";');
  } else if (s.includes('from "lucide-react";') && !s.includes("Lock")) {
    // If import shape changed, try to inject Lock into existing lucide import
    s = s.replace(/import\s*\{([^}]*)\}\s*from\s*"lucide-react";/m, (m, inner) => {
      const parts = inner.split(",").map(x => x.trim()).filter(Boolean);
      if (!parts.includes("Lock")) parts.push("Lock");
      return `import { ${parts.join(", ")} } from "lucide-react";`;
    });
  }

  // 2) FollowResp: add hidden?: boolean;
  if (!s.includes("hidden?: boolean")) {
    s = s.replace(/type\s+FollowResp\s*=\s*\{\n([\s\S]*?)\n\};/m, (m, body) => {
      if (body.includes("hidden?: boolean")) return m;
      if (body.includes("error?:")) {
        body = body.replace(/(\n\s*error\?:[^\n]*\n)/, `$1  hidden?: boolean;\n`);
      } else {
        body = body.replace(/(\n\s*ok:\s*boolean;[^\n]*\n)/, `$1  hidden?: boolean;\n`);
      }
      return `type FollowResp = {\n${body}\n};`;
    });
  }

  // 3) Add hidden state after total
  if (!s.includes("const [hidden, setHidden]")) {
    s = s.replace(
      /const\s+\[total,\s*setTotal\]\s*=\s*useState<number\s*\|\s*null>\(null\);\n/,
      (m) => m + "  const [hidden, setHidden] = useState(false);\n"
    );
  }

  // 4) Clear stale hidden before each load
  if (!s.includes("setHidden(false);")) {
    s = s.replace(/setTrouble\(null\);\n/, (m) => m + "      setHidden(false);\n");
  }

  // 5) Read hidden from API response (insert before `const got = ...`)
  if (!s.includes("const isHidden = !!(j as any).hidden")) {
    s = s.replace(
      /const got = Array\.isArray\(j\.items\) \? j\.items : \[\];\n/,
      (m) =>
        `        const isHidden = !!(j as any).hidden;\n` +
        `        setHidden(isHidden);\n\n` +
        m
    );
  }

  // 6) If hidden, stop before merging items (insert after setNextCursor line)
  if (!s.includes("if (isHidden) {")) {
    const cursorLine = `        setNextCursor(String(j.nextCursor || "").trim() || null);\n`;
    if (s.includes(cursorLine)) {
      s = s.replace(cursorLine, cursorLine +
`        if (isHidden) {
          setItems([]);
          setNextCursor(null);
          return;
        }
`);
    }
  }

  // 7) Header title lock icon
  if (!s.includes("{hidden ? <Lock")) {
    s = s.replace(
      /<div className="text-lg font-black text-gray-900">(Followers|Following)<\/div>/,
      `<div className="text-lg font-black text-gray-900 flex items-center gap-2">$1 {hidden ? <Lock size={16} className="text-gray-300" /> : null}</div>`
    );
  }

  // 8) Render hidden branch in main content
  if (!s.includes("This list is hidden")) {
    const marker = ") : items.length ? (";
    if (s.includes(marker)) {
      s = s.replace(
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
  }

  // Marker
  if (!s.includes("sd_940_fix_hidden_list_pages_v3")) {
    s += "\n\n// sd_940_fix_hidden_list_pages_v3\n";
  }

  if (s !== orig) {
    fs.writeFileSync(path, s, "utf8");
    console.log("✅ Patched:", path);
  } else {
    console.log("ℹ️ No changes:", path);
  }
}

for (const p of targets) patchOne(p);
NODE

echo ""
echo "✅ DONE: ${NAME}"
echo "Backup: ${BK_DIR}"
echo ""
echo "Next:"
echo "  cd frontend && npm run typecheck && npm run build"
echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "  docker compose -f ops/docker/docker-compose.dev.yml restart backend"
echo ""
