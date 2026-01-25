# Siddes Observability — Consolidated Status Report (2026-01-25)

This document is the **single source of truth** for what we were doing, what is done, and what remains.
It exists because multiple windows/threads can cause partial fixes and “drift” in the repo.

Scope of this report:
- Observability Engine work (logs, correlation, dashboards/alerts, privacy)
- The current “blocking” misconfiguration that is preventing E2E from passing (CSRF cookie not set)
- The concrete next steps to get back to **one clean working state**

---

## 1) What we were doing (the mission)

Build an observability plan and implementation pack that:
- makes production debugging fast (5‑minute answers)
- keeps user content private (no PII, no post/DM text, no tokens)
- uses Siddes’ existing correlation key (`request_id`) end‑to‑end
- provides a beginner-safe runbook + drills + gates so we don’t deploy blind

Core outcomes we targeted:
- **Request logs**: structured JSON, consistent `request_id`, `status`, `latency_ms`
- **Correlation**: client ↔ Next proxy ↔ Django via `X‑Request‑ID`
- **Dashboards**: Golden signals, Endpoint explorer, Auth, Media, Inbox
- **Alerts**: minimal paging + drift detector (write 401 outside auth)
- **Privacy**: hash/remove viewer ids, redact query strings, short retention
- **Drills**: fire drill + incident drills + launch gate

---

## 2) What we have done (completed deliverables)

### 2.1 Backend baseline already in repo (✅)
- Django middleware emits `event="api_request"` for `/api/*` and includes `request_id`
- Backend returns `X‑Request‑ID` and exposes it to the browser
- Observability baseline check passes:
  - `bash scripts/checks/observability_baseline_check.sh` ✅

### 2.2 Observability “Docs Pack” (✅ created, may require restore into repo)
We produced a complete docs + runbook pack that includes:
- Spec + privacy rules
- Datadog ClickOps setup
- Dashboard + monitor copy/paste
- Fire drill, incident drills, launch gate
- Support workflow using Request ID
- SLOs v0 + burn-rate guidance
- Privacy audit checklist + retention/access policy
- Known failure signatures + fix playbook map
- Oncall home + quickstart pages
- Optional PDF storage policy under `docs/pack/`

### 2.3 PDF export (✅)
- A consolidated PDF “handbook” exists and can be stored at:
  - `docs/pack/Siddes_Observability_Pack_YYYY-MM-DD.pdf`

---

## 3) Current status from the latest zip (what’s true right now)

### 3.1 Observability baseline (✅ good)
- Repo check: `scripts/checks/observability_baseline_check.sh` passes
- Fire drill script (when present) shows expected behavior:
  - `/api/auth/csrf` returns an `X‑Request‑ID`
  - unauth writes return 401 (write guard)
  - inbox stub routes return 200 locally

### 3.2 Standing doc drift / misconfiguration (❌)
In the current “source_of_truth_clean” zip, these are true:
- `docs/OBSERVABILITY.md` exists and references:
  - `docs/OBS_PACK_INDEX.md`
  - `docs/ONCALL_HOME.md`
  - plus many other pack docs
- BUT most of those referenced pack files are **missing** in the zip.

This creates a “half-installed observability pack”:
- you have the entrypoint doc and the PDF integration,
- but the rest of the runbooks/drills/docs are not present.

**Fix:** apply the observability pack restore helper (sd_616) to re-create the missing docs + scripts.

### 3.3 Real blocker: Playwright E2E failures (❌)
Your Playwright E2E feed tests fail with:

> `CSRF Failed: CSRF cookie not set.`

Root cause (test harness):
- `frontend/tests/e2e/utils.ts` memoizes the CSRF token globally (`let _csrfMemo`),
- but Playwright creates a **new BrowserContext per test**, so the memoized token does not match the new context cookies,
- causing 403 on seed post requests.

**Fix:** apply sd_617 to remove global memoization and ensure csrftoken exists per test context.

### 3.4 Known remaining product/UI gap (❌ not blocking observability)
One check shows a missing UI behavior:
- `scripts/checks/inbox_thread_list_pin_local_check.sh`
- Result: local pin storage exists, but **Pin UI or pinned-first sort missing**.

This is **not** an observability blocker, but it is a tracked UX gap to fix next.

---

## 4) What remains (the one clean path forward)

### Step 1 — Restore the missing observability docs pack (if not already)
Apply:
- **sd_616_observability_pack_restore_apply_helper**  
Result:
- adds `docs/OBS_PACK_INDEX.md` and the full pack
- adds `scripts/obs/fire_drill.sh`, `scripts/obs/incident_drills.sh`, `scripts/go_live_observability_gate.sh`

Definition of Done:
- `ls docs/OBS_PACK_INDEX.md` works
- `docs/OBSERVABILITY.md` links now resolve

### Step 2 — Fix Playwright CSRF E2E blocker
Apply:
- **sd_617_fix_playwright_csrf_cookie_apply_helper**  
Result:
- patches only `frontend/tests/e2e/utils.ts` (test harness only)
- E2E feed tests should stop failing due to missing CSRF cookie

Then run:
```bash
cd frontend
npm run e2e -- tests/e2e/feed_pagination_ui.spec.ts
npm run e2e -- tests/e2e/feed_scroll_restore.spec.ts
npm run e2e
```

Definition of Done:
- `npm run e2e` passes

### Step 3 — Optional next UI item (Inbox pin)
Fix:
- add Pin UI affordance and pinned-first sorting on inbox list  
Definition of Done:
- `scripts/checks/inbox_thread_list_pin_local_check.sh` passes

---

## 5) Canonical commands (copy/paste)

From repo root:

```bash
# 0) sanity
git status -sb

# 1) restore pack (if missing)
# (run your sd_616 helper)

# 2) verify observability baseline
bash scripts/checks/observability_baseline_check.sh

# 3) run fire drill (local)
./scripts/obs/fire_drill.sh

# 4) fix E2E csrf issue (run sd_617 helper), then:
cd frontend
npm run e2e -- tests/e2e/feed_pagination_ui.spec.ts
npm run e2e -- tests/e2e/feed_scroll_restore.spec.ts
npm run e2e
```

---

## 6) Single-source-of-truth rule (to stop window drift)

Going forward:
- Treat **one** working copy of the repo as canonical.
- After each apply-helper script:
  - run `./verify_overlays.sh`
  - run the relevant checks/tests
  - commit the change before opening new windows.

This prevents “half-applied” states from spreading across zips.

---

## 7) Current checklist (DoD)

✅ Observability baseline check passes  
✅ Fire drill passes locally  
❌ E2E feed tests failing due to CSRF cookie missing  
❌ Inbox pinned-first sort/UI (optional next item)  
❌ Observability pack docs missing in the latest zip (needs restore)

Once sd_616 + sd_617 are applied and E2E passes, we are back to **one clean state**.
