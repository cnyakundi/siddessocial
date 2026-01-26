# PWA phone install test (HTTPS)

Siddes is a PWA, but it will only feel like a real mobile app once you install it from your phone’s home screen.

This requires opening Siddes over **HTTPS** on your phone.

## Beginner-safe helper

From the repo root:

```bash
chmod +x scripts/dev/pwa_phone_test.sh
PORT=3000 ./scripts/dev/pwa_phone_test.sh
```

The script will:
1) Build a production Next.js bundle
2) Start a production server on `http://localhost:3000`
3) Start an HTTPS tunnel using `npx localtunnel`

It will print a **https://** URL — open that on your phone:

- **iPhone/iPad:** use **Safari** → Share → **Add to Home Screen**
- **Android:** use **Chrome** → **Install app**

## Notes

- Service workers + install/update UI are usually enabled only in **production** builds.
- The first run of `npx localtunnel` downloads dependencies and needs internet access.
- If port 3000 is busy, pick a different port:

```bash
PORT=3100 ./scripts/dev/pwa_phone_test.sh
```

## Quick sanity checks (installed mode)

After installing:
- Launch from the home screen and confirm it opens without browser UI.
- Toggle airplane mode and confirm you see your offline fallback (and no crash).
- Confirm “Update available” appears after you deploy a new build (service worker update flow).
