#!/usr/bin/env bash
set -euo pipefail

# Run from repo root
ROOT="$(pwd)"
if [[ ! -d "$ROOT/frontend" || ! -d "$ROOT/backend" || ! -d "$ROOT/scripts" ]]; then
  echo "❌ Run this from the repo root (where frontend/, backend/, scripts/ exist)."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP=".backup_sd_736_repo_declutter_round1_${STAMP}"
SCRIPT_BASENAME="$(basename "${BASH_SOURCE[0]}")"
export BACKUP SCRIPT_BASENAME

mkdir -p "$BACKUP"

python3 <<'PY'
from __future__ import annotations

import os
import re
import shutil
from pathlib import Path

ROOT = Path(os.getcwd())
BACKUP = ROOT / os.environ["BACKUP"]
SCRIPT_BASENAME = os.environ.get("SCRIPT_BASENAME", "")

def backup_file(p: Path) -> None:
    if not p.exists() or not p.is_file():
        return
    rel = p.relative_to(ROOT)
    dst = BACKUP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dst)

def backup_dir(d: Path) -> None:
    if not d.exists() or not d.is_dir():
        return
    rel = d.relative_to(ROOT)
    dst = BACKUP / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(d, dst)

def write_text(p: Path, text: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text if text.endswith("\n") else (text + "\n"), encoding="utf-8")

def patch_text_file(p: Path, replacements: dict[str, str]) -> bool:
    if not p.exists() or not p.is_file():
        return False
    txt = p.read_text(encoding="utf-8", errors="ignore")
    orig = txt
    for old, new in replacements.items():
        txt = txt.replace(old, new)
    if txt != orig:
        backup_file(p)
        p.write_text(txt, encoding="utf-8")
        return True
    return False

print(f"== sd_736 repo declutter ==")
print(f"Backup: {BACKUP}")

# ------------------------------------------------------------
# 1) .gitignore: ignore overlay scratch dirs
# ------------------------------------------------------------
gitignore = ROOT / ".gitignore"
if gitignore.exists():
    backup_file(gitignore)
    gi = gitignore.read_text(encoding="utf-8", errors="ignore").splitlines()
    if ".tmp_sd_*" not in gi:
        # insert near backup section if present
        out = []
        inserted = False
        for line in gi:
            out.append(line)
            if line.strip() == ".backup*":
                out.append("")
                out.append("# Temporary overlay scratch dirs (safe to delete)")
                out.append(".tmp_sd_*")
                out.append(".tmp_*")
                inserted = True
        if not inserted:
            out += ["", "# Temporary overlay scratch dirs (safe to delete)", ".tmp_sd_*", ".tmp_*"]
        gitignore.write_text("\n".join(out) + "\n", encoding="utf-8")
        print("✅ Updated .gitignore to ignore .tmp_sd_* / .tmp_*")
    else:
        print("✅ .gitignore already ignores .tmp_sd_*")

# ------------------------------------------------------------
# 2) Relocate any .tmp_sd_* CORS JSON samples into ops/
# ------------------------------------------------------------
cors_dst = ROOT / "ops" / "cloudflare" / "r2_cors_examples"
moved_any = False
for d in sorted(ROOT.glob(".tmp_sd_*")):
    if not d.is_dir():
        continue
    backup_dir(d)
    cors_dst.mkdir(parents=True, exist_ok=True)
    for f in d.iterdir():
        if f.is_file():
            new_name = f"{d.name}_{f.name}"
            shutil.move(str(f), str(cors_dst / new_name))
            moved_any = True
    shutil.rmtree(d, ignore_errors=True)

if moved_any:
    readme = cors_dst / "README.md"
    if not readme.exists():
        write_text(readme, """# R2 CORS example configs

These JSON snippets came from temporary overlay scratch dirs (now ignored via `.gitignore`).

Use them as reference samples when setting up Cloudflare R2 CORS rules.
Files are prefixed with the original scratch dir name for traceability.
""")
    print("✅ Moved .tmp_sd_* JSON samples to ops/cloudflare/r2_cors_examples and removed scratch dirs")
else:
    print("✅ No .tmp_sd_* dirs found (nothing to move)")

# ------------------------------------------------------------
# 3) Delete *.bak and *.bak.* inside frontend/ + backend/ (not inside .backup_*)
# ------------------------------------------------------------
def is_under_backup(path: Path) -> bool:
    try:
        rel = path.relative_to(ROOT)
    except Exception:
        return False
    return rel.parts and (rel.parts[0].startswith(".backup_") or rel.parts[0].startswith(".backup"))

deleted_bak = 0
for base in [ROOT / "frontend", ROOT / "backend"]:
    if not base.exists():
        continue
    for p in base.rglob("*"):
        if not p.is_file():
            continue
        if is_under_backup(p):
            continue
        name = p.name
        if name.endswith(".bak") or ".bak." in name:
            backup_file(p)
            p.unlink(missing_ok=True)
            deleted_bak += 1
if deleted_bak:
    print(f"✅ Deleted {deleted_bak} *.bak / *.bak.* files (backed up)")
else:
    print("✅ No *.bak / *.bak.* files to delete")

# ------------------------------------------------------------
# 4) Move sd_*_apply_helper.sh from repo root into tools/overlays_history/
# ------------------------------------------------------------
hist = ROOT / "tools" / "overlays_history"
hist.mkdir(parents=True, exist_ok=True)

moved = 0
for p in sorted(ROOT.glob("sd_*apply_helper.sh")):
    if not p.is_file():
        continue
    if p.name == SCRIPT_BASENAME:
        continue
    backup_file(p)
    shutil.move(str(p), str(hist / p.name))
    moved += 1

if moved:
    print(f"✅ Moved {moved} root apply_helper scripts → tools/overlays_history/")
else:
    print("✅ No root apply_helper scripts to move")

# ------------------------------------------------------------
# 5) Frontend: centralize cn() into src/lib/cn.ts and remove 75 duplicates
# ------------------------------------------------------------
cn_util = ROOT / "frontend" / "src" / "lib" / "cn.ts"
write_text(cn_util, """// Central className combiner used across Siddes UI.
// Keep this tiny + dependency-free (no clsx/twMerge required for MVP).
export function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}
""")

frontend_src = ROOT / "frontend" / "src"
cn_files = []
if frontend_src.exists():
    for p in frontend_src.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix not in [".ts", ".tsx", ".js", ".jsx"]:
            continue
        txt = p.read_text(encoding="utf-8", errors="ignore")
        if re.search(r"\bfunction\s+cn\s*\(", txt):
            # Only strip the canonical cn: parts.filter(Boolean).join(" ")
            if 'parts.filter(Boolean).join(" ")' not in txt:
                continue
            cn_files.append(p)

def insert_import(lines: list[str], import_line: str) -> list[str]:
    if any(import_line in ln for ln in lines):
        return lines
    i = 0
    if lines and lines[0].strip() in ['"use client";', "'use client';", '"use client"', "'use client'"]:
        i = 1
        if i < len(lines) and lines[i].strip() == "":
            i += 1
    # advance through top import block
    last_import = i - 1
    j = i
    while j < len(lines):
        line = lines[j]
        if line.startswith("import "):
            last_import = j
            j += 1
            continue
        if line.strip() == "" and last_import >= i:
            k = j + 1
            if k < len(lines) and lines[k].startswith("import "):
                j += 1
                continue
        break
    insert_at = last_import + 1
    lines.insert(insert_at, import_line)
    if insert_at + 1 < len(lines) and lines[insert_at + 1].strip() != "":
        lines.insert(insert_at + 1, "")
    return lines

updated_cn = 0
for p in cn_files:
    txt = p.read_text(encoding="utf-8", errors="ignore")
    # remove first cn function block (DOTALL, minimal)
    new_txt = re.sub(r"(?ms)^\s*function\s+cn\s*\([^)]*\)\s*\{.*?\}\s*\n", "", txt, count=1)
    if new_txt == txt:
        continue
    backup_file(p)
    lines = new_txt.splitlines()
    lines = insert_import(lines, 'import { cn } from "@/src/lib/cn";')
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    updated_cn += 1

print(f"✅ Centralized cn(): updated {updated_cn} files, added frontend/src/lib/cn.ts")

# ------------------------------------------------------------
# 6) Frontend: dedupe 9 identical error.tsx files → AppError component + tiny wrappers
# ------------------------------------------------------------
error_files = [
  ROOT/"frontend/src/app/error.tsx",
  ROOT/"frontend/src/app/siddes-inbox/error.tsx",
  ROOT/"frontend/src/app/siddes-inbox/[id]/error.tsx",
  ROOT/"frontend/src/app/siddes-invites/error.tsx",
  ROOT/"frontend/src/app/siddes-feed/error.tsx",
  ROOT/"frontend/src/app/siddes-circles/error.tsx",
  ROOT/"frontend/src/app/siddes-circles/[id]/error.tsx",
  ROOT/"frontend/src/app/invite/[id]/error.tsx",
  ROOT/"frontend/src/app/siddes-post/[id]/error.tsx",
]

src_error = error_files[0]
app_error = ROOT/"frontend/src/components/AppError.tsx"
if src_error.exists():
    backup_file(src_error)
    write_text(app_error, src_error.read_text(encoding="utf-8", errors="ignore"))
    wrapper = '"use client";\n\nexport { default } from "@/src/components/AppError";\n'
    for ef in error_files:
        if ef.exists():
            backup_file(ef)
            write_text(ef, wrapper)
    print("✅ Dedupe error.tsx: created src/components/AppError.tsx and replaced route error.tsx files with wrappers")
else:
    print("⚠️ Skipped error.tsx dedupe (frontend/src/app/error.tsx missing?)")

# ------------------------------------------------------------
# 7) Backend: consolidate siddes_posts + siddes_reply + siddes_push → backend/siddes_tooling/
# ------------------------------------------------------------
tooling = ROOT / "backend" / "siddes_tooling"
tooling.mkdir(parents=True, exist_ok=True)
write_text(tooling/"__init__.py", """\"\"\"Tooling-only stubs (no Django imports).

Used by:
- scripts/dev/* demos
- standalone selftests
- runtime_store memory fallbacks (dev-only)

Not installed as a Django app.
\"\"\"

__all__ = []
""")

def move_stub(src: Path, dst: Path, replacements: dict[str, str]) -> None:
    if not src.exists():
        return
    backup_file(src)
    txt = src.read_text(encoding="utf-8", errors="ignore")
    for old, new in replacements.items():
        txt = txt.replace(old, new)
    write_text(dst, txt)

posts_dir = ROOT/"backend/siddes_posts"
reply_dir = ROOT/"backend/siddes_reply"
push_dir  = ROOT/"backend/siddes_push"

if posts_dir.exists(): backup_dir(posts_dir)
if reply_dir.exists(): backup_dir(reply_dir)
if push_dir.exists():  backup_dir(push_dir)

# Posts stubs
move_stub(posts_dir/"models_stub.py", tooling/"posts_models_stub.py", {})
move_stub(posts_dir/"store.py", tooling/"posts_store.py", {"from .models_stub import":"from .posts_models_stub import"})
move_stub(posts_dir/"endpoint_stub.py", tooling/"posts_endpoint_stub.py", {
    "from .store import PostStore":"from .posts_store import PostStore",
    "from .models_stub import SideId":"from .posts_models_stub import SideId",
})

# Reply stubs (+ templates kept, but relocated)
move_stub(reply_dir/"models_stub.py", tooling/"replies_models_stub.py", {})
move_stub(reply_dir/"store.py", tooling/"replies_store.py", {"from .models_stub import":"from .replies_models_stub import"})
move_stub(reply_dir/"endpoint_stub.py", tooling/"replies_endpoint_stub.py", {
    "from .store import ReplyStore":"from .replies_store import ReplyStore",
    "from .models_stub import":"from .replies_models_stub import",
})
move_stub(reply_dir/"drf_template.py", tooling/"replies_drf_template.py", {})
move_stub(reply_dir/"django_ninja_template.py", tooling/"replies_django_ninja_template.py", {})

# Push stubs
move_stub(push_dir/"models_stub.py", tooling/"push_models_stub.py", {})
move_stub(push_dir/"payloads.py", tooling/"push_payloads.py", {"from .models_stub import":"from .push_models_stub import"})
move_stub(push_dir/"store.py", tooling/"push_store.py", {"from .models_stub import":"from .push_models_stub import"})
move_stub(push_dir/"api_stub.py", tooling/"push_api_stub.py", {
    "from .payloads import":"from .push_payloads import",
    "from .models_stub import":"from .push_models_stub import",
    "from .store import":"from .push_store import",
})

# Patch runtime_store + mock_db if present
patch_text_file(ROOT/"backend/siddes_post/runtime_store.py", {
    "from siddes_posts.store import PostStore":"from siddes_tooling.posts_store import PostStore",
    "from siddes_reply.store import ReplyStore":"from siddes_tooling.replies_store import ReplyStore",
})
patch_text_file(ROOT/"backend/siddes_feed/mock_db.py", {
    "from siddes_posts.models_stub import PostRecord":"from siddes_tooling.posts_models_stub import PostRecord",
})

# Patch scripts/dev + scripts/checks + a few docs (avoid touching tools/overlays_history)
repls = {
    "backend/siddes_posts/models_stub.py":"backend/siddes_tooling/posts_models_stub.py",
    "backend/siddes_posts/store.py":"backend/siddes_tooling/posts_store.py",
    "backend/siddes_posts/endpoint_stub.py":"backend/siddes_tooling/posts_endpoint_stub.py",
    "backend/siddes_reply/models_stub.py":"backend/siddes_tooling/replies_models_stub.py",
    "backend/siddes_reply/store.py":"backend/siddes_tooling/replies_store.py",
    "backend/siddes_reply/endpoint_stub.py":"backend/siddes_tooling/replies_endpoint_stub.py",
    "backend/siddes_reply/drf_template.py":"backend/siddes_tooling/replies_drf_template.py",
    "backend/siddes_reply/django_ninja_template.py":"backend/siddes_tooling/replies_django_ninja_template.py",
    "backend/siddes_push/models_stub.py":"backend/siddes_tooling/push_models_stub.py",
    "backend/siddes_push/store.py":"backend/siddes_tooling/push_store.py",
    "backend/siddes_push/payloads.py":"backend/siddes_tooling/push_payloads.py",
    "backend/siddes_push/api_stub.py":"backend/siddes_tooling/push_api_stub.py",
    "from siddes_posts.":"from siddes_tooling.posts_",
    "from siddes_reply.":"from siddes_tooling.replies_",
    "from siddes_push.":"from siddes_tooling.push_",
    "`siddes_push.*`":"`siddes_tooling.push_*`",
}

def patch_tree(base: Path, exts: set[str]) -> int:
    changed = 0
    for p in base.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix not in exts:
            continue
        # skip overlays history
        if "tools/overlays_history" in str(p):
            continue
        txt = p.read_text(encoding="utf-8", errors="ignore")
        orig = txt
        for old, new in repls.items():
            txt = txt.replace(old, new)
        # also patch spider registry directory-path lines
        txt = txt.replace("_Path:_ `backend/siddes_posts/`", "_Path:_ `backend/siddes_tooling/`")
        txt = txt.replace("_Path:_ `backend/siddes_reply/`", "_Path:_ `backend/siddes_tooling/`")
        txt = txt.replace("_Path:_ `backend/siddes_push/`", "_Path:_ `backend/siddes_tooling/`")
        if txt != orig:
            backup_file(p)
            p.write_text(txt, encoding="utf-8")
            changed += 1
    return changed

changed_docs = patch_tree(ROOT/"docs", {".md"})
changed_checks = patch_tree(ROOT/"scripts/checks", {".sh"})
changed_dev = patch_tree(ROOT/"scripts/dev", {".py", ".sh"})

# Remove old stub dirs
for old in [posts_dir, reply_dir, push_dir]:
    if old.exists():
        shutil.rmtree(old, ignore_errors=True)

print(f"✅ Consolidated backend stubs → backend/siddes_tooling/ (docs:{changed_docs}, checks:{changed_checks}, dev:{changed_dev})")

# ------------------------------------------------------------
# 8) Update a few drifted check scripts (DesktopSideDock + lg breakpoints)
# ------------------------------------------------------------
ui_shell = ROOT/"scripts/checks/ui_responsive_shell_switch_check.sh"
if ui_shell.exists():
    backup_file(ui_shell)
    write_text(ui_shell, """#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Check: Responsive Shell Switch (sd_152f) =="

req () { [[ -f "$1" ]] || { echo "❌ Missing: $1"; exit 1; }; }

req "frontend/src/components/AppShell.tsx"
req "frontend/src/components/DesktopSideDock.tsx"
req "frontend/src/components/DesktopTopBar.tsx"
req "frontend/src/components/AppProviders.tsx"

grep -q "AppShell" frontend/src/components/AppProviders.tsx || { echo "❌ AppProviders not using AppShell"; exit 1; }
grep -q "lg:hidden" frontend/src/components/AppShell.tsx || { echo "❌ AppShell missing mobile wrapper (lg:hidden)"; exit 1; }
grep -q "hidden lg:flex" frontend/src/components/AppShell.tsx || { echo "❌ AppShell missing desktop wrapper (hidden lg:flex)"; exit 1; }
grep -q "DesktopSideDock" frontend/src/components/AppShell.tsx || { echo "❌ AppShell not rendering DesktopSideDock"; exit 1; }
grep -q "DesktopTopBar" frontend/src/components/AppShell.tsx || { echo "❌ AppShell not rendering DesktopTopBar"; exit 1; }

echo "✅ Responsive shell switch present"
""")
    os.chmod(ui_shell, 0o755)

p0 = ROOT/"scripts/checks/ui_cleanroom_p0_threshold_nav_safety_check.sh"
if p0.exists():
    patch_text_file(p0, {
        'DESKTOP_RAIL="frontend/src/components/DesktopSideRail.tsx"':'DESKTOP_DOCK="frontend/src/components/DesktopSideDock.tsx"',
        'require_file "$DESKTOP_RAIL"':'require_file "$DESKTOP_DOCK"',
        'require_grep "{ href: \\"/siddes-circles\\", label: \\"Circles\\", icon: Layers }" "$DESKTOP_RAIL" "DesktopSideRail Circles uses Layers icon"':
        'require_grep "href: \\"/siddes-circles\\"" "$DESKTOP_DOCK" "DesktopSideDock contains Circles nav"\nrequire_grep "icon: Layers" "$DESKTOP_DOCK" "DesktopSideDock Circles uses Layers icon"',
    })

p1 = ROOT/"scripts/checks/ui_cleanroom_p1_side_activity_engine_check.sh"
if p1.exists():
    backup_file(p1)
    # keep original checks but update the FILES list to current chrome
    txt = p1.read_text(encoding="utf-8", errors="ignore")
    txt = re.sub(
        r'FILES=\(\s*.*?\)\s*',
        'FILES=(\n  "frontend/src/components/AppTopBar.tsx"\n  "frontend/src/components/DesktopTopBar.tsx"\n  "frontend/src/components/DesktopSideDock.tsx"\n  "frontend/src/components/BottomNav.tsx"\n  "frontend/src/components/NotificationsDrawer.tsx"\n)\n',
        txt,
        flags=re.S
    )
    txt = txt.replace('  "frontend/src/components/SideChrome.tsx"\n', "")
    txt = txt.replace('  "frontend/src/components/DesktopSideRail.tsx"\n', "")
    p1.write_text(txt, encoding="utf-8")

print("✅ Updated key UI check scripts (responsive shell + cleanroom p0/p1)")

# ------------------------------------------------------------
# 9) Add scripts/dev/clean_repo_clutter.sh
# ------------------------------------------------------------
clean = ROOT/"scripts/dev/clean_repo_clutter.sh"
write_text(clean, """#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "== Siddes: clean repo clutter =="
echo "Root: ${ROOT}"
echo ""

INCLUDE_BACKUPS=0
if [[ "${1:-}" == "--including-backups" ]]; then
  INCLUDE_BACKUPS=1
fi

rm -rf .tmp_sd_* .tmp_* 2>/dev/null || true
rm -rf frontend/.next frontend/.next_build frontend/out frontend/.turbo frontend/.vercel .vercel 2>/dev/null || true
rm -f frontend/tsconfig.tsbuildinfo 2>/dev/null || true

find backend -type d -name "__pycache__" -prune -exec rm -rf {} + 2>/dev/null || true
find backend -type f -name "*.pyc" -delete 2>/dev/null || true

find frontend backend -type f -name "*.bak" -delete 2>/dev/null || true
find frontend backend -type f -name "*.bak.*" -delete 2>/dev/null || true

rm -rf audit_runs .sd_batch_logs patches 2>/dev/null || true

if [[ "${INCLUDE_BACKUPS}" -eq 1 ]]; then
  echo "-> Removing .backup_* directories (you asked for it)"
  rm -rf .backup_* .backup* 2>/dev/null || true
else
  echo "-> Keeping .backup_* directories (run with --including-backups to remove)"
fi

echo ""
echo "✅ Done."
""")
os.chmod(clean, 0o755)
print("✅ Added scripts/dev/clean_repo_clutter.sh")
print("== Done ==")
PY

echo ""
echo "✅ Declutter applied."
echo "Backup saved at: $BACKUP"
echo ""
echo "Next quick checks:"
echo "  ./verify_overlays.sh"
echo "  bash scripts/checks/ui_responsive_shell_switch_check.sh"
echo "  python3 -m compileall backend >/dev/null"
echo ""
echo "Optional cleanup (build artifacts, scratch, etc):"
echo "  bash scripts/dev/clean_repo_clutter.sh"
echo "  # OR include backups too:"
echo "  bash scripts/dev/clean_repo_clutter.sh --including-backups"
