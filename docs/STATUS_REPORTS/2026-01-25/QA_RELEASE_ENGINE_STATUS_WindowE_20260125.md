# QA / Release Engine — Consolidated Status Report (Window E)

**Goal:** Stop regressions while we iterate fast on UI + wiring fixes.  
**Scope window:** Window E (QA Architect + Release Engineer).  
**Generated from:** the latest terminal output you shared (after applying `sd_575`), plus the pack scripts we produced in this thread.

---

## 0) Why you’re feeling “multiple windows = misconfig”
You weren’t imagining it — we ended up with a *stack* of overlapping “fix packs” because each new failure surfaced a new missing assumption:

- **Your macOS shell doesn’t have `python`** (`python: command not found`), so any apply-helper that used `python` silently stopped mid-patch.
- **Playwright `page.request` bypasses your app’s `window.fetch` CSRF wrapper**, so POSTs can 403 unless tests explicitly bootstrap the `csrftoken` cookie and send `x-csrftoken`.
- **Signup throttling (429)** makes repeated local E2E runs fail if every test creates a new user.
- Some repo checks are **grep-based** and expect *exact strings* (e.g., inbox pin UI labels) — small refactors can fail checks even when functionality looks okay.

This report consolidates what’s been built, what’s applied, what’s currently failing, and the single “one path” to finish cleanly.

---

## 1) What Window E designed (the discipline)
### Critical user journeys (must never break)
1. Signup → onboarding → logout → login  
2. Protected route gating → redirects to login safely  
3. Feed loads (and safe states render)  
4. Compose → post appears in feed  
5. Post detail renders → reply works → reply persists  
6. Profile view (other user) shows public, gates private  
7. Search renders safely (no cross-side leaks)  
8. Inbox list → open thread → send message  
9. Inbox privacy/mismatch warning + move confirm  
10. Sets create flow works

### Smoke suite (minimum on every change)
- `./verify_overlays.sh`
- `./scripts/run_tests.sh`
- `cd frontend && npm run e2e -- tests/e2e/smoke.spec.ts`

### Release gates (before deploy)
- “Merge gate”: verify + harness + small Playwright subset
- “RC gate”: DRF smokes (auth/posts/inbox) + full Playwright
- “Deploy gate”: Django deploy checks + migration checks + env hardening

---

## 2) What we implemented so far (packs / changes)

### Window E core pack (QA + CI + E2E)
**Pack(s):** `sd_570` (Window E), followed by hardening packs.

Delivered:  
- Expanded Playwright test plan + seeded DRF smokes  
- Release gates guidance  
- New E2E tests for Auth / Post / Compose / Inbox / Media (some stubbed)  
- CI job expansion to run harness + selected E2E

### Inbox hardening
**Pack:** `sd_571`  
Delivered:  
- Inbox mismatch banner + move confirm bar + “load earlier” hooks  
- New inbox Playwright tests + DRF smoke+  
- Added testids for stability

### Feed hardening (scroll restore + pagination)
**Pack:** `sd_572` (FAILED mid-run)  
Issue: used `python` in the apply-helper; your machine doesn’t have `python`, so it stopped before writing tests + patches.

### Fix feed hardening and inbox sort (no python)
**Pack:** `sd_573`  
Delivered:  
- Node-based patcher (works on your machine)  
- Feed tests were written (so files exist)  
- Inbox list now reads threadStore and sorts by updatedAt

### Fix E2E CSRF + Inbox pin baseline
**Pack:** `sd_574`  
Delivered:  
- CSRF helper + safer POSTs (but later we discovered cookie memo + context issues)
- Inbox pin UI + pinned-first sort (initially)

### Fix signup throttling + inbox search placeholder + feed test strictness
**Pack:** `sd_575`  
Delivered:  
- `scripts/dev/e2e_seed_user.sh` (docker seed)  
- Most tests “login-first” instead of “signup every run”  
- Signup E2E becomes CI-only by default  
- Inbox search placeholder fix (expects `Search threads`)  
- Feed pagination test locator uses `.first()` to avoid strict-mode errors

---

## 3) Latest repo status (from your most recent run)
### ✅ Good news
- `./verify_overlays.sh` passes.
- `./scripts/run_tests.sh` runs a large set of checks successfully (Auth, Feed scaffolding, lots of Inbox DB checks, etc.).
- E2E user seeding runs (you saw: `ok e2e created` / `ok e2e existing`).

### ❌ What is still failing right now
1) **Harness check failing**
- `scripts/checks/inbox_thread_list_pin_local_check.sh`  
  Output: `❌ Pin UI or pinned-first sort missing`

2) **Feed E2E tests failing with CSRF**
- `feed_pagination_ui.spec.ts` and `feed_scroll_restore.spec.ts` both fail:
  - `seed post failed (403): CSRF cookie not set`

**Root cause:**  
Playwright seeding uses `page.request.post("/api/post", ...)` in a fresh context, but CSRF cookie (`csrftoken`) is not present. `ensureCsrf()` needs to re-check the cookie per context and bootstrap via `/api/auth/csrf`.

---

## 4) The single “one path” to finish (no more window drift)

### Step 1 — Apply the final consolidation fix
Apply: **`sd_576b_fix_csrf_e2e_and_inbox_search_pins_apply_helper.sh`**  
What it does:
- Fixes CSRF handling in Playwright per-context (no stale memo)
- Switches feed test seeding to `csrfPost(...)`
- Re-injects inbox pin UI and pinned-first sort strings the check expects
- Ensures inbox search placeholder remains exactly `Search threads`

### Step 2 — Re-run the same verification commands
```bash
./verify_overlays.sh
./scripts/run_tests.sh

cd frontend
npm run e2e -- tests/e2e/feed_pagination_ui.spec.ts
npm run e2e -- tests/e2e/feed_scroll_restore.spec.ts
cd ..
```

### Step 3 — Commit + push correctly (important!)
From your earlier log:
- Your commit **was on branch `ui/quality-bootstrap`**
- You ran `git push -u origin main` and got **Everything up-to-date**  
That usually means **your changes were not pushed** (wrong branch).

Do this to be safe:
```bash
git status -sb
# If it shows "## ui/quality-bootstrap"
git push -u origin ui/quality-bootstrap
# OR merge into main
git checkout main
git merge ui/quality-bootstrap
git push
```

---

## 5) What remains after `sd_576b` (expected next failures, if any)
If `sd_576b` lands cleanly, remaining items are likely *real product fixes*, not harness plumbing:

- **Inbox search bar UI**: the check wants a real search input + clear button + filtering.
- **Feed scroll restore semantics**: test may expose edge cases where virtualization needs better anchor restore.
- **Optional:** Make grep-based checks less brittle (replace with unit tests where possible).

But first we must get to a *stable green baseline*.

---

## 6) Consolidated “Window E” operating mode (no misconfigs)
**Rule:** One command must tell the truth.

### Daily local loop (fast)
```bash
./verify_overlays.sh
./scripts/run_tests.sh
cd frontend && npm run e2e -- tests/e2e/smoke.spec.ts
```

### Before pushing a feature branch (stronger)
```bash
./verify_overlays.sh
./scripts/run_tests.sh
VIEWER=me bash scripts/dev/posts_drf_smoke.sh
VIEWER=me bash scripts/dev/drf_smoke.sh
bash scripts/dev/inbox_visibility_smoke.sh
cd frontend && npm run e2e
```

### “No more python assumption”
Any new apply-helper should use **node** or `python3`, not `python`.

---

## Appendix A — Pack timeline (quick reference)
- `sd_570`: Window E core QA/Release discipline + tests + CI
- `sd_571`: Inbox hardening + tests + smoke+
- `sd_572`: Feed hardening attempt **failed** (python missing)
- `sd_573`: Feed hardening re-applied (node patcher) + inbox last-message sort
- `sd_574`: CSRF + inbox pins (first pass)
- `sd_575`: E2E seeded user + signup throttle avoidance + inbox search placeholder + feed strict locator
- **Next:** `sd_576b` to close the loop (CSRF per-context + inbox pins/search + feed seeding)

---

## Appendix B — “One thing” summary
**The one thing we’re doing:**  
> Make the repo reliably green with `verify_overlays + run_tests + targeted E2E`, so UI iteration no longer causes regressions or “mystery breakage”.

