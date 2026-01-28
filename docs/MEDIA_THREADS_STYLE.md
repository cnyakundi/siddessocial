# Siddes Media — Threads Web Parity (Source of Truth)

Goal: make Siddes images/videos feel as “clean” as Threads (desktop + mobile).

## 1) The hidden rule that makes Threads look clean
For multi-attachment posts, **the first attachment defines the aspect ratio** of the whole set.

- Compute `r = width / height` from the first item’s metadata.
- Clamp it to IG/Threads bounds:
  - Portrait min: **0.8** (4:5)
  - Landscape max: **1.91** (1.91:1)
- Render **every tile** using this same `aspect-ratio` and `object-fit: cover`.

This creates the “tight, uniform row” look you see on Threads web.

## 2) Feed tiles (clean chrome)
- **No borders**. Use a subtle **ring** (`ring-1 ring-black/5`) if needed.
- **Tight gaps** (~6px).
- Rounded corners: `rounded-2xl` (adjust later if you want sharper).

## 3) Single media (respectful)
- Use `object-fit: contain` so portraits aren’t brutally cropped.
- Use a gentle max height based on metadata (portrait vs landscape).

## 4) Viewer (expand)
Threads-style cleanliness:
- Pure black backdrop
- Minimal chrome (close + arrows)
- No rounded corners on the media in the viewer (cleaner, more “pro”)

## 5) Next level “premium” quality (not just UI)
UI polish alone can’t fully match Threads unless we also do:
- Responsive variants (thumb / tile / full)
- WebP/AVIF when possible
- Correct caching headers (public vs private)
- EXIF orientation fix
