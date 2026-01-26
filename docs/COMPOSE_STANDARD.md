# Compose Standard (sd_740)

This fixes the *real* issue from the screenshot:

- On mobile, the in-feed composer looked like a full editor, but it **can't** provide Siddes-standard audience control (Set/Topic selection) + an obvious Post CTA.
- It also led to confusion: keyboard pops up on the feed, but posting feels unclear.

## The Siddes standard
**Mobile feed composer = launcher.**  
Tapping it opens `/siddes-compose` where:
- Audience is explicit (Side + Set/Topic)
- You can switch Set/Topic (e.g., **Gym Squad** inside Friends)
- There's a clear **Post** button
- Close/back behavior is reliable

## What changed
### 1) Mobile launcher
File: `frontend/src/components/FeedComposerRow.tsx`

- `lg:hidden` launcher row (no textarea) → tap opens composer page
- + and send both open the composer (no "disabled send" confusion)

### 2) Desktop stays fast
- `hidden lg:block` keeps quick-inline posting for keyboard users
- + still opens advanced composer

### 3) Alignment safety
File: `frontend/src/components/SideFeed.tsx`

- Removes redundant `px-4` on virtual rows so posts align with composer.

## Acceptance checks (mobile)
- Tap the composer row → opens compose page (no keyboard on feed)
- In compose, pick a Set (Gym Squad) and Post
- After posting, you return to feed and see the new post
