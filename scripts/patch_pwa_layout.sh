\
#!/usr/bin/env bash
set -euo pipefail

echo "== Siddes PWA layout patch =="
ROOT="$(pwd)"
echo "Root: ${ROOT}"

candidates=(
  "frontend/src/app/layout.tsx"
  "frontend/app/layout.tsx"
  "src/app/layout.tsx"
  "app/layout.tsx"
)

TARGET=""
for c in "${candidates[@]}"; do
  if [[ -f "${c}" ]]; then
    TARGET="${c}"
    break
  fi
done

if [[ -z "${TARGET}" ]]; then
  echo "❌ Could not find a Next.js App Router layout.tsx in common locations."
  echo "Searched:"
  printf " - %s\n" "${candidates[@]}"
  echo ""
  echo "Fix:"
  echo "  1) Find your layout.tsx, then manually add:"
  echo '     import Script from "next/script";'
  echo '     <Script src="/pwa-client.js" strategy="afterInteractive" />  (before </body>)'
  exit 1
fi

python3 - <<'PY'
import re, sys, pathlib, datetime

target = pathlib.Path(sys.argv[1])
text = target.read_text(encoding="utf-8")
orig = text

stamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
backup = target.with_suffix(target.suffix + f".bak.{stamp}")
backup.write_text(text, encoding="utf-8")

# 1) Ensure import Script from "next/script"
if 'from "next/script"' not in text and "from 'next/script'" not in text:
    # Try to insert after the initial import block.
    # Capture optional directives ('use client';) then imports.
    m = re.match(r"(?s)^(?P<prefix>(?:\\s*['\\\"]use client['\\\"];\\s*\\n)?)"
                 r"(?P<imports>(?:\\s*import[^\\n]*\\n)+)", text)
    insert = 'import Script from "next/script";\\n'
    if m:
        prefix = m.group("prefix") or ""
        imports = m.group("imports") or ""
        if insert not in imports:
            text = prefix + imports + insert + text[m.end():]
    else:
        # Fallback: prepend import
        text = insert + text

# 2) Inject Script tag before </body>
if "pwa-client.js" not in text:
    # Attempt to insert before </body>
    new_text, n = re.subn(r"</body>", '  <Script src="/pwa-client.js" strategy="afterInteractive" />\\n</body>', text, count=1)
    if n == 0:
        # Fallback: insert before </html>
        new_text, n2 = re.subn(r"</html>", '  <Script src="/pwa-client.js" strategy="afterInteractive" />\\n</html>', text, count=1)
        text = new_text
    else:
        text = new_text

# 3) Write back if changed
if text != orig:
    target.write_text(text, encoding="utf-8")
    print(f"✅ Patched: {target}")
    print(f"✅ Backup:  {backup}")
else:
    print(f"ℹ️  No changes needed: {target}")
    print(f"✅ Backup:  {backup}  (created)")
PY "${TARGET}"

echo "Done."
