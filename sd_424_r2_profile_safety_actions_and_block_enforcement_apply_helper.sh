#!/usr/bin/env bash
set -euo pipefail

NAME="sd_424_r2_profile_safety_actions_and_block_enforcement"

if [[ ! -d "backend" || ! -d "frontend" ]]; then
  echo "ERROR: Run from repo root (must contain backend/ and frontend/)."
  echo "Current: $(pwd)"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required (used for safe in-place edits)."
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BK=".backup_${NAME}_${STAMP}"
mkdir -p "$BK"

backup_file() {
  local p="$1"
  if [[ -e "$p" ]]; then
    mkdir -p "$BK/$(dirname "$p")"
    cp -a "$p" "$BK/$p"
  fi
}

backup_file "backend/siddes_prism/views.py"
backup_file "frontend/src/app/u/[username]/page.tsx"
backup_file "frontend/src/components/ProfileActionsSheet.tsx"

echo "== ${NAME} =="
echo "Backups: ${BK}"
echo ""

node - <<'NODE'
const fs = require("fs");
const path = require("path");

function read(p){ return fs.readFileSync(p, "utf8"); }
function write(p, s){ fs.writeFileSync(p, s.endsWith("\n") ? s : (s + "\n"), "utf8"); }
function exists(p){ return fs.existsSync(p); }
function mkdirp(p){ fs.mkdirSync(p, { recursive: true }); }

function patchPrismBackend() {
  const p = "backend/siddes_prism/views.py";
  let s = read(p);

  // Import is_blocked_pair
  if (!s.includes("from siddes_safety.policy import is_blocked_pair")) {
    const re = /from siddes_backend\.csrf import dev_csrf_exempt\n/;
    if (!re.test(s)) throw new Error("Could not find dev_csrf_exempt import in " + p);
    s = s.replace(re, (m) => m + "from siddes_safety.policy import is_blocked_pair\n");
  }

  // ProfileView block enforcement
  if (!s.includes("sd_424_profile_blocks")) {
    const clsIdx = s.indexOf("class ProfileView(APIView):");
    if (clsIdx < 0) throw new Error("Could not find ProfileView class in " + p);

    const needle = "viewer = _user_from_request(request)";
    const vIdx = s.indexOf(needle, clsIdx);
    if (vIdx < 0) throw new Error("Could not find viewer assignment inside ProfileView in " + p);

    const lineEnd = s.indexOf("\n", vIdx);
    if (lineEnd < 0) throw new Error("Could not find end-of-line after viewer assignment in " + p);

    const insert =
`\n\n        # sd_424_profile_blocks: Blocks hard-stop profile visibility (no view, no Side sheet)
        if viewer and viewer.id != target.id:
            try:
                viewer_tok = viewer_id_for_user(viewer)
                target_tok = "@" + str(getattr(target, "username", "") or "").lower()
                if target_tok and is_blocked_pair(viewer_tok, target_tok):
                    return Response({"ok": False, "error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            except Exception:
                pass
`;

    s = s.slice(0, lineEnd + 1) + insert + s.slice(lineEnd + 1);
  }

  // SideActionView: allow unside even if blocked, but prevent setting a side
  if (!s.includes("sd_424_side_action_blocks")) {
    const clsIdx = s.indexOf("class SideActionView(APIView):");
    if (clsIdx < 0) throw new Error("Could not find SideActionView class in " + p);

    const needle = 'return Response({"ok": False, "error": "cannot_side_self"}, status=status.HTTP_400_BAD_REQUEST)';
    const rIdx = s.indexOf(needle, clsIdx);
    if (rIdx < 0) throw new Error("Could not find cannot_side_self return line in SideActionView in " + p);

    const lineEnd = s.indexOf("\n", rIdx);
    if (lineEnd < 0) throw new Error("Could not find end-of-line after cannot_side_self return line in " + p);

    const insert =
`\n
        # sd_424_side_action_blocks: respect blocks (allow unside; prevent setting a side when blocked)
        try:
            viewer_tok = viewer_id_for_user(viewer)
            target_tok = "@" + str(getattr(target, "username", "") or "").lower()
            if target_tok and side != "public" and is_blocked_pair(viewer_tok, target_tok):
                return Response({"ok": False, "error": "restricted"}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass
`;

    s = s.slice(0, lineEnd + 1) + insert + s.slice(lineEnd + 1);
  }

  write(p, s);
  console.log("OK: patched backend prism block enforcement:", p);
}

function ensureProfileActionsComponent() {
  const p = "frontend/src/components/ProfileActionsSheet.tsx";
  if (exists(p)) {
    const cur = read(p);
    if (cur.includes("sd_424_profile_actions_sheet")) {
      console.log("OK: ProfileActionsSheet already exists");
      return;
    }
    console.log("WARN: ProfileActionsSheet.tsx exists without marker; leaving as-is.");
    return;
  }

  mkdirp(path.dirname(p));

  const content =
`"use client";

import React, { useEffect } from "react";
import { Ban, Flag, Link2, VolumeX, X, Copy } from "lucide-react";
import { toast } from "@/src/lib/toast";

async function copyText(text: string): Promise<boolean> {
  const t = String(text || "");
  if (!t) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {}

  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

export function ProfileActionsSheet(props: {
  open: boolean;
  onClose: () => void;
  handle: string;
  displayName?: string;
  href?: string;
}) {
  const { open, onClose, handle, displayName, href } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const who = String(handle || "").trim();
  const name = String(displayName || who || "User").trim();

  const absUrl = (() => {
    if (href) return href;
    if (typeof window === "undefined") return "";
    return window.location.href;
  })();

  const doCopyLink = async () => {
    const ok = await copyText(absUrl);
    toast[ok ? "success" : "error"](ok ? "Link copied." : "Could not copy link.");
    onClose();
  };

  const doCopyHandle = async () => {
    const ok = await copyText(who);
    toast[ok ? "success" : "error"](ok ? "Handle copied." : "Could not copy.");
    onClose();
  };

  const doReport = async () => {
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType: "user", targetId: who, reason: "other" }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 429 ? "Slow down." : "Could not report.";
        throw new Error(msg);
      }
      toast.success("Reported. Thank you.");
      onClose();
    } catch (e) {
      toast.error((e as any)?.message || "Could not report.");
    }
  };

  const doMute = async () => {
    if (!who) return;
    if (typeof window !== "undefined" && !window.confirm("Mute " + name + "? You won't see their posts in your feed.")) return;

    try {
      const res = await fetch("/api/mutes", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: who }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 429 ? "Slow down." : "Could not mute.";
        throw new Error(msg);
      }
      toast.success("Muted " + name + ".");
      onClose();
    } catch (e) {
      toast.error((e as any)?.message || "Could not mute.");
    }
  };

  const doBlock = async () => {
    if (!who) return;
    if (typeof window !== "undefined" && !window.confirm("Block " + name + "? You won't see each other.")) return;

    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: who }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || j.ok !== true) {
        const msg = res.status === 429 ? "Slow down." : "Could not block.";
        throw new Error(msg);
      }
      toast.success("Blocked " + name + ".");
      onClose();
    } catch (e) {
      toast.error((e as any)?.message || "Could not block.");
    }
  };

  return (
    <div className="fixed inset-0 z-[98] flex items-end justify-center md:items-center" data-testid="profile-actions-sheet">
      <button type="button" className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-label="Close" />

      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-5">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-gray-900 truncate">Profile options</div>
            <div className="text-xs text-gray-500 truncate">{name} {who}</div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-2">
          <button type="button" onClick={doCopyLink} className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm"><Link2 size={18} /></div>
            <div>
              <div className="font-bold text-gray-900">Copy link</div>
              <div className="text-xs text-gray-500">Share profile</div>
            </div>
          </button>

          <button type="button" onClick={doCopyHandle} className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm"><Copy size={18} /></div>
            <div>
              <div className="font-bold text-gray-900">Copy handle</div>
              <div className="text-xs text-gray-500">Copy {who}</div>
            </div>
          </button>

          <button type="button" onClick={doReport} className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm"><Flag size={18} /></div>
            <div>
              <div className="font-bold text-gray-900">Report user</div>
              <div className="text-xs text-gray-500">Flag abuse or spam</div>
            </div>
          </button>

          <button type="button" onClick={doMute} className="w-full p-4 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center gap-4 text-left">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm"><VolumeX size={18} /></div>
            <div>
              <div className="font-bold text-gray-900">Mute user</div>
              <div className="text-xs text-gray-500">Hide their posts from your feed</div>
            </div>
          </button>

          <button type="button" onClick={doBlock} className="w-full p-4 rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center gap-4 text-left border border-rose-200">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-rose-700 shadow-sm border border-rose-200"><Ban size={18} /></div>
            <div>
              <div className="font-bold text-rose-700">Block user</div>
              <div className="text-xs text-rose-700/80">Hard stop: no view, no messages</div>
            </div>
          </button>
        </div>

        <div className="mt-4 text-[11px] text-gray-500">sd_424_profile_actions_sheet</div>
      </div>
    </div>
  );
}
`;

  write(p, content);
  console.log("OK: created", p);
}

function patchUserProfilePage() {
  const p = "frontend/src/app/u/[username]/page.tsx";
  let s = read(p);

  // lucide import
  if (!s.includes("MoreHorizontal")) {
    const anchor = 'import { useParams } from "next/navigation";\n';
    if (!s.includes(anchor)) throw new Error("Could not find useParams import in " + p);
    s = s.replace(anchor, anchor + '\nimport { MoreHorizontal } from "lucide-react";\n');
  }

  // component import
  if (!s.includes("ProfileActionsSheet")) {
    const prismImportEnd = 'from "@/src/components/PrismProfile";\n';
    if (!s.includes(prismImportEnd)) throw new Error("Could not find PrismProfile import end in " + p);
    s = s.replace(prismImportEnd, prismImportEnd + '\nimport { ProfileActionsSheet } from "@/src/components/ProfileActionsSheet";\n');
  }

  // state
  if (!s.includes("actionsOpen") && s.includes("const [busy, setBusy]")) {
    s = s.replace(/const \[busy, setBusy\] = useState\(false\);\n/, (m) => m + "\n  const [actionsOpen, setActionsOpen] = useState(false); // sd_424_profile_actions\n");
  }

  // button next to CopyLinkButton
  if (!s.includes("setActionsOpen(true)") && s.includes("<CopyLinkButton href={href} />")) {
    const btn = `
                  <button
                    type="button"
                    onClick={() => setActionsOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-extrabold text-sm hover:bg-gray-200 transition-all flex items-center gap-2"
                    aria-label="More actions"
                  >
                    <MoreHorizontal size={18} />
                  </button>`;
    s = s.replace("<CopyLinkButton href={href} />", "<CopyLinkButton href={href} />" + btn);
  }

  // sheet render after SideWithSheet (self-closing)
  if (!s.includes("<ProfileActionsSheet") && s.includes("<SideWithSheet")) {
    const start = s.indexOf("            <SideWithSheet");
    if (start < 0) throw new Error("Could not locate SideWithSheet render block in " + p);
    const end = s.indexOf("/>", start);
    if (end < 0) throw new Error("Could not find end of SideWithSheet component in " + p);

    const insert = `

            <ProfileActionsSheet
              open={actionsOpen}
              onClose={() => setActionsOpen(false)}
              handle={user.handle}
              displayName={facet.displayName || user.handle}
              href={href}
            />
            `;
    s = s.slice(0, end + 2) + insert + s.slice(end + 2);
  }

  write(p, s);
  console.log("OK: patched", p);
}

function main() {
  patchPrismBackend();
  ensureProfileActionsComponent();
  patchUserProfilePage();
}

main();
NODE

echo ""
echo "OK: ${NAME} applied."
echo "Backups: ${BK}"
echo ""
echo "Next (VS Code terminal):"
echo "  docker compose -f ops/docker/docker-compose.dev.yml exec backend python manage.py migrate"
echo "  cd frontend && npm run typecheck"
echo "  cd frontend && npm run build"
echo ""
echo "Quick verify:"
echo "  1) /u/<someone>: click More -> Report/Mute/Block works."
echo "  2) Block someone -> /u/<them> becomes not_found."
echo "  3) Side: you can't Side someone you're blocked with (unside still works)."
