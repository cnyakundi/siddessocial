# World Launch P0 Tracker (v1.0)

This file is the **single source of truth** for “are we safe to world launch?”

## Run the automated gatepack
From repo root:

```bash
bash scripts/checks/launch_world_p0_gatepack_check.sh
```

## What this tracker is
- **Auto checks** catch the silent trust killers (cache bleed, search leaks, missing legal pages, missing safety endpoints, etc.)
- **Manual steps** confirm real-user behavior (PWA auth refresh, back button, modals, messaging under bad network)

Keep it simple: PASS/FAIL + evidence.

---

## P0 gates

| Gate | Automated checks (repo) | Manual validation (human) | Status | Evidence |
|---|---|---|---|---|
| P0.1 Side boundaries (no leakage) | caching_paranoia_check, search_privacy_guardrails_check, deeplink_check | 2-account token test across feeds/search/profile/notifs/DM previews/deeplinks | ⬜ | |
| P0.2 Login/session stable | auth_bootstrap_check (+ manual) | refresh stress test (20x), 2-tab logout sync, PWA reopen | ⬜ | |
| P0.3 Navigation escape | pwa_cache_check (+ manual) | modals always close, back works from post detail on mobile/PWA | ⬜ | |
| P0.4 Messaging reliability | **inbox_send_idempotency_check** (no duplicates on retry) | airplane-mode send, queued/failed/retry UX, no “vanished” | ⬜ | |
| P0.5 Performance feel | (mostly manual for now) | cold open + side switch x10 + compose open/close x10 | ⬜ | |
| P0.6 Data integrity | (partially manual) | flaky network post: never “success” without server truth | ⬜ | |
| P0.7 Safety basics | drf_throttling_skeleton_check + safety_block_report_check | block + report flows work across feed/profile/DM/search | ⬜ | |
| P0.8 Notifications safe | notifications_check | verify no wrong-side previews; if unsure: in-app only | ⬜ | |
| P0.9 Legal + lifecycle | legal_pages_check + account_deletion_check | confirm delete works end-to-end; support path visible | ⬜ | |
| P0.10 Observability | observability_baseline_check | confirm request ids + usable logs for failures | ⬜ | |

Legend: ⬜ unknown / 🟡 partial / ✅ pass / ❌ fail
