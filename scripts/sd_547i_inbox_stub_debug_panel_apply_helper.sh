#!/usr/bin/env bash
set -euo pipefail

# sd_547i (fixed): Inbox backend_stub debug panel + viewer/side params (header-based)
# Unblocks: scripts/checks/inbox_backend_stub_debug_panel_check.sh

REQ=(
  "frontend/src/lib/inboxProvider.ts"
  "frontend/src/lib/inboxProviders/backendStub.ts"
  "frontend/src/app/siddes-inbox/page.tsx"
  "frontend/src/app/siddes-inbox/[id]/page.tsx"
)

missing=0
for f in "${REQ[@]}"; do
  [[ -f "$f" ]] || { echo "ERROR: Missing $f"; missing=1; }
done
[[ "$missing" -eq 0 ]] || { echo "Run this from repo root (sidesroot)."; exit 1; }

COMP_DIR="frontend/src/components"
COMP_FILE="$COMP_DIR/InboxStubDebugPanel.tsx"

TS="$(date +%Y%m%d_%H%M%S)"
BK=".backup_sd_547i_inbox_stub_debug_panel_${TS}"
mkdir -p "$BK"
cp -p "frontend/src/lib/inboxProvider.ts" "$BK/inboxProvider.ts"
cp -p "frontend/src/lib/inboxProviders/backendStub.ts" "$BK/backendStub.ts"
cp -p "frontend/src/app/siddes-inbox/page.tsx" "$BK/inbox_page.tsx"
cp -p "frontend/src/app/siddes-inbox/[id]/page.tsx" "$BK/thread_page.tsx"
[[ -f "$COMP_FILE" ]] && cp -p "$COMP_FILE" "$BK/InboxStubDebugPanel.tsx" || true

mkdir -p "$COMP_DIR"

# 1) Create InboxStubDebugPanel component (if missing)
if [[ ! -f "$COMP_FILE" ]]; then
  cat > "$COMP_FILE" <<'TSX'
"use client";

import React, { useEffect, useState } from "react";

const LS_KEY = "sd_inbox_stub_viewer";

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function useInboxStubViewer(): [string, (v: string) => void] {
  const [viewer, setViewer] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw != null) setViewer(String(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, viewer);
    } catch {}
  }, [viewer]);

  return [viewer, setViewer];
}

export function InboxStubDebugPanel(props: { viewer: string; onViewer: (v: string) => void }) {
  const { viewer, onViewer } = props;
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      className={cn(
        "fixed bottom-3 right-3 z-[999] w-[260px] rounded-2xl border border-gray-200 bg-white shadow-lg p-3"
      )}
      aria-label="Inbox debug panel"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-black text-gray-700">DEV • Inbox Stub</div>
        <button
          type="button"
          className="text-[11px] font-bold text-gray-500 hover:text-gray-700"
          onClick={() => onViewer("")}
          aria-label="Clear viewer"
          title="Clear"
        >
          Clear
        </button>
      </div>

      <div className="mt-2">
        <label className="block text-[11px] font-bold text-gray-500">x-sd-viewer</label>
        <input
          value={viewer}
          onChange={(e) => onViewer(e.target.value)}
          placeholder="me | @handle | anon"
          className="mt-1 w-full px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-black text-gray-700 hover:bg-gray-50"
            onClick={() => onViewer("me")}
          >
            me
          </button>
          <button
            type="button"
            className="px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-black text-gray-700 hover:bg-gray-50"
            onClick={() => onViewer("anon")}
          >
            anon
          </button>
        </div>
        <div className="mt-2 text-[10px] text-gray-400">
          Viewer is forwarded via request header (never as a URL param).
        </div>
      </div>
    </div>
  );
}
TSX
fi

# 2) inboxProvider types: add viewer?: string
PROV="frontend/src/lib/inboxProvider.ts"
if ! grep -qF "viewer?:" "$PROV"; then
  perl -0777 -i -pe '
    my $s = $_;
    $s =~ s~(export type InboxProviderListOpts\s*=\s*\{\n)~$1  viewer?: string;\n~s
      if $s =~ /export type InboxProviderListOpts/ && $s !~ /export type InboxProviderListOpts[\s\S]*?viewer\?:/;
    $s =~ s~(export type InboxProviderThreadOpts\s*=\s*\{\n)~$1  viewer?: string;\n~s
      if $s =~ /export type InboxProviderThreadOpts/ && $s !~ /export type InboxProviderThreadOpts[\s\S]*?viewer\?:/;
    $_ = $s;
  ' "$PROV"
fi

# 3) backendStub provider: forward viewer via x-sd-viewer header (NOT URL param)
STUB="frontend/src/lib/inboxProviders/backendStub.ts"
if ! grep -q "x-sd-viewer" "$STUB"; then
  perl -0777 -i -pe '
    my $s = $_;
    $s =~ s~return fetch\(buildUrl\(path, opts\), init\);~const viewer = (opts as any)?.viewer as string | undefined;\n  const headers = new Headers(init.headers || {});\n  if (viewer && typeof viewer === \"string\" && viewer.trim()) {\n    headers.set(\"x-sd-viewer\", viewer.trim());\n  }\n  return fetch(buildUrl(path, opts), { ...init, headers });~s;
    $_ = $s;
  ' "$STUB"
fi

# 4) Inbox list page: add import + viewer state + pass viewer + mount panel
LIST_PAGE="frontend/src/app/siddes-inbox/page.tsx"
if ! grep -q "InboxStubDebugPanel" "$LIST_PAGE"; then
  perl -0777 -i -pe '
    my $s = $_;
    $s =~ s~(from \"lucide-react\";\n)~$1\nimport { InboxStubDebugPanel, useInboxStubViewer } from \"\@/src/components/InboxStubDebugPanel\";\n~s
      if $s !~ /InboxStubDebugPanel/;
    $_ = $s;
  ' "$LIST_PAGE"

  perl -0777 -i -pe '
    my $s = $_;
    $s =~ s~(const provider = useMemo\(\(\) => getInboxProvider\(\), \[\]\);\n)~$1\n  const [viewerInput, setViewerInput] = useInboxStubViewer();\n  const viewer = (viewerInput || \"\").trim() || undefined;\n~s
      if $s !~ /useInboxStubViewer\(/;
    $_ = $s;
  ' "$LIST_PAGE"

  perl -0777 -i -pe '
    my $s = $_;
    $s =~ s~provider\.listThreads\(\{\s*side,\s*limit: PAGE_SIZE\s*\}\)~provider.listThreads({ viewer, side, limit: PAGE_SIZE })~g;
    $s =~ s~provider\.listThreads\(\{\s*side,\s*limit: PAGE_SIZE,\s*cursor: nextCursor\s*\}\)~provider.listThreads({ viewer, side, limit: PAGE_SIZE, cursor: nextCursor })~g;
    if ($s !~ /<InboxStubDebugPanel/) {
      $s =~ s~(\n\s*</div>\n\s*\);\n}\s*$)~\n\n      {process.env.NODE_ENV !== \"production\" ? (\n        <InboxStubDebugPanel viewer={viewerInput} onViewer={setViewerInput} />\n      ) : null}$1~s;
    }
    $_ = $s;
  ' "$LIST_PAGE"
fi

# 5) Thread page: add import + viewer state + pass viewer + mount panel
THREAD_PAGE="frontend/src/app/siddes-inbox/[id]/page.tsx"
if ! grep -q "InboxStubDebugPanel" "$THREAD_PAGE"; then
  perl -0777 -i -pe '
    my $s = $_;
    $s =~ s~(from \"lucide-react\";\n)~$1import { InboxStubDebugPanel, useInboxStubViewer } from \"\@/src/components/InboxStubDebugPanel\";\n~s
      if $s !~ /InboxStubDebugPanel/;
    $_ = $s;
  ' "$THREAD_PAGE"

  perl -0777 -i -pe '
    my $s = $_;
    $s =~ s~(const provider = useMemo\(\(\) => getInboxProvider\(\), \[\]\);\n)~$1\n  const [viewerInput, setViewerInput] = useInboxStubViewer();\n  const viewer = (viewerInput || \"\").trim() || undefined;\n~s
      if $s !~ /useInboxStubViewer\(/;
    $_ = $s;
  ' "$THREAD_PAGE"

  perl -0777 -i -pe '
    my $s = $_;
    $s =~ s~provider\.getThread\(id, \{ limit: MSG_PAGE \}\)~provider.getThread(id, { viewer, limit: MSG_PAGE })~g;
    $s =~ s~provider\.getThread\(id, \{ limit: MSG_PAGE, cursor: msgCursor \}\)~provider.getThread(id, { viewer, limit: MSG_PAGE, cursor: msgCursor })~g;
    $s =~ s~provider\.sendMessage\(id, v, \"me\"\)~provider.sendMessage(id, v, \"me\", { viewer })~g;
    $s =~ s~provider\.setLockedSide\(id, to\)~provider.setLockedSide(id, to, { viewer })~g;
    $s =~ s~provider\.setLockedSide\(id, moveConfirmTo\)~provider.setLockedSide(id, moveConfirmTo, { viewer })~g;

    if ($s !~ /<InboxStubDebugPanel/) {
      $s =~ s~(\n\s*</div>\n\s*</div>\n\s*</div>\n\s*\);\n}\s*$)~\n\n      {process.env.NODE_ENV !== \"production\" ? (\n        <InboxStubDebugPanel viewer={viewerInput} onViewer={setViewerInput} />\n      ) : null}$1~s;
    }
    $_ = $s;
  ' "$THREAD_PAGE"
fi

echo "✅ sd_547i applied."
echo "Backup: $BK"
echo "Next: scripts/checks/inbox_backend_stub_debug_panel_check.sh"
