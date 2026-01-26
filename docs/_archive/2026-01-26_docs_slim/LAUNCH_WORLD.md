# Siddes World Launch Documentation (v1.0)

Goal: launch Siddes (“Sides”) to the world with trust, stability, and WhatsApp-level clarity on Day 1 — while leaving room to improve everything else later.

---

## 0) Launch mindset

When you “launch to the world,” you’re not testing product-market fit anymore — you’re testing trust.

The world judges Siddes on three things:
1. Safety: “Will this embarrass me or leak my private life?”
2. Reliability: “Does it work every single time?”
3. Control: “Can I always exit, undo, and go back?”

Everything in this document exists to protect those three.

---

## 1) The simplest possible Four Sides (WhatsApp-level meaning)

Rule: users must understand the 4 Sides in 10 seconds.

### The one-sentence definitions (use these everywhere)
- **Public:** Anyone can see this.
- **Friends:** People I approved can see this.
- **Close:** Only my inner circle can see this.
- **Work:** Only colleagues can see this.

### The one UI concept that makes it instantly understandable

Treat “Sides” as **Audience**.

Every creation UI must show an Audience chip:

**Audience: Public / Friends / Close / Work**

Users don’t need to “understand Sides.” They just need to pick who sees this.

### The 3 actions (same everywhere)

WhatsApp is basically: message, post, manage people.

Siddes should feel the same:
- **Post**
- **Message**
- **People** (manage who’s in that audience)

Important: the actions must be identical across Sides. Only the audience changes.

---

## 2) Launch severity levels
- **P0 (Launch Blocker):** breaks trust, privacy, core flows, or makes the app feel broken.
- **P1 (Ship Soon):** major friction but not fatal.
- **P2 (Later):** polish, power features, optional upgrades.

---

## 3) P0 Launch Gates (must be 100% perfect)

### P0.1 Side boundaries are flawless (no leakage — ever)

Promise: content never crosses Side lines.

**PASS only if:**
- Server enforces Side access control (not “UI hiding”).
- No leaks via:
  - search results
  - recommendations/suggestions
  - notifications/previews
  - counts/avatars/snippets
  - caches (cross-user or cross-side)
  - deep links / guessed URLs
  - error messages that reveal metadata

**Minimum test script**
- Create two accounts A and B.
- A posts unique tokens into each Side (e.g. CLOSE-ONLY-123).
- B must be unable to find any trace of the Close token anywhere (feeds, search, profile, notifications, message previews, deep links).

### P0.2 Login + session is boringly stable

Users must never experience:
- “Login required” while clearly logged in
- random logouts
- redirect loops
- auth state mismatch between tabs/PWA/refresh

**PASS only if:**
- Refreshing any screen doesn’t break auth state.
- PWA installed mode behaves consistently with browser mode.
- Logout invalidates properly (no ghost sessions).

**Test script**
- Login → refresh 20 times on feed, post, inbox.
- Open 2 tabs → logout in one → other reflects logout reliably.
- Install PWA → kill app → reopen → state is correct.

### P0.3 Navigation + modals never trap people

Rule: there is always a way out.

**PASS only if:**
- Every modal/sheet/popover has a clear close.
- Tap outside / ESC / back button closes when appropriate.
- No full-screen overlays that block the app with no escape.
- Post detail → back works on mobile + desktop + PWA.

**Test script**
- Open “3 dots” menu repeatedly:
  - it must not cover the screen uncontrollably
  - it must always close reliably
- Open a post detail screen:
  - back returns you to the exact prior context

### P0.4 Messaging reliability (retention engine)

Messaging must feel like WhatsApp: instant, predictable, recoverable.

**PASS only if:**
- Sending a message results in exactly one truth:
  - delivered, or
  - failed with clear retry
- No duplicates on retry
- No “sent but vanished”
- Network loss states are handled gracefully (queued/failed/retry)

**Test script**
- Send 20 messages quickly.
- Toggle airplane mode during sending:
  - you see queued/failed states
  - recovery is clean (no duplicates)

### P0.5 Performance that feels fast

People don’t measure your app with benchmarks — they measure it with emotion.

**PASS only if:**
- Feed shows “something” immediately (cached skeleton is okay).
- Side switching feels instant.
- No jank: scrolling, opening posts, opening composer.
- Layout doesn’t jump around (no UI chaos).

**Test script**
- Cold open (killed app) → feed is visible fast.
- Switch sides 10 times → no lag spikes.
- Open/close composer 10 times → no drift/misalignment.

### P0.6 Data integrity (no ghost states)

No action should ever leave users confused about what happened.

**PASS only if:**
- Posts/messages are never duplicated.
- “Success” always means it exists on server.
- “Failed” always means it didn’t.
- UI always reconciles with server truth after refresh.

**Test script**
- Post with flaky network:
  - it must either show “queued/failed” OR truly succeed
  - never “success” with missing post

### P0.7 Safety & abuse basics (minimum viable Trust & Safety)

You don’t need fancy ML on Day 1 — you need strong fundamentals.

**PASS only if:**
- Block works everywhere (feed, profile, DMs, search, notifications).
- Report exists in-app for posts and users.
- Basic throttles exist (messages/invites/follows) to prevent spam.
- You have a way to review reports (even if manual admin panel).

### P0.8 Notifications are correct (or minimal)

Notifications are a common privacy leak vector.

**PASS only if:**
- Notifications never reveal wrong-side content or previews.
- If not 100% correct, ship in-app only first and keep push minimal.

### P0.9 Legal + account lifecycle basics

You need real-world credibility.

**PASS only if:**
- Privacy policy + Terms are accessible (in-app + website).
- Account deletion exists and actually works (with clear explanation).
- A support contact path exists (email/form).

### P0.10 Observability + incident readiness (don’t launch blind)

If you can’t see failures, you can’t fix them fast enough.

**PASS only if:**
- You can monitor:
  - auth failures
  - message send failures
  - API error rate (4xx/5xx)
  - slow endpoints
  - Frontend + backend errors are captured with enough context to debug.
- You have a “what to do if X breaks” playbook.

---

## 4) The “Normal Human” Launch Test (12 steps)

A non-technical person must complete all 12 with zero confusion:
1. Sign up
2. Understand the 4 audiences
3. Switch audiences
4. Post to the intended audience
5. View that post
6. Open/close menus & modals
7. Open a post and go back
8. Find a person
9. Message them successfully
10. Block them and verify it holds
11. Log out / log in cleanly
12. Use the app for 5 minutes with no “WTF” moment

If any step causes “this is broken” vibes → do not world launch.

---

## 5) What is allowed to be “later”

These can be improved after launch without destroying trust:

**P1 (soon)**
- better discovery/search (without privacy risk)
- onboarding polish (as long as the basic flow is crystal clear)
- set creation friction reduction
- richer media UI

**P2 (later)**
- advanced ranking/personalization
- creator tools
- deep analytics dashboards
- themes / heavy customization

---

## 6) World launch rollout plan (safe expansion)

**Phase A — Private beta (trusted users)**
- Goal: crush P0 issues quietly.
- Gate: P0 stays stable for multiple days.

**Phase B — Canary public launch (small)**
- Goal: test at real-world scale without getting overwhelmed.
- Gate: error rates stable + no privacy incidents.

**Phase C — Gradual ramp**
- Increase invites/users in steps, only if metrics remain calm.

Rule: never scale while you’re actively firefighting.

---

## 7) Incident response (what you do when something breaks)

**P0 incident examples**
- privacy leak suspicion
- “can’t login” spike
- messages failing widely
- broken navigation trap on mobile
- runaway spam

**Immediate playbook**
1. Stop the bleeding (disable feature flag / rollback / reduce exposure)
2. Confirm scope (who is affected? which endpoints?)
3. Communicate (short status message + ETA only if certain)
4. Fix + verify
5. Postmortem (what happened, why, how to prevent)

---

## 8) Launch readiness checklist (copy/paste)

**P0 Must Pass**
- Side access control verified on API + UI
- No cross-side leaks through search/suggestions/notifications/caches
- Login stable across refresh, tabs, PWA
- Back works everywhere; modals always close
- Messaging: send/fail/retry states are correct; no duplicates
- Feed + side switching feels fast; no jank
- No ghost states; UI reconciles with server truth
- Block + report + throttles working
- Notifications are correct or minimal/in-app only
- Terms + Privacy + Account deletion + Support path live
- Error logging + basic dashboards + incident plan exist

---

## 9) “WhatsApp Simplicity Spec” (the UX contract)

This is the contract your UI must obey.

**Always visible**
- Audience chip on composer + message contexts
- Clear “who will see this” at all times

**Always consistent actions**
- Post
- Message
- People

**Always safe defaults**
- Default audience: Friends
- Close: a list (inner circle), not a complicated mode
- Work: opt-in (don’t force it early)

**Always escape**
- Close buttons
- Back button
- Tap outside to dismiss (where appropriate)
