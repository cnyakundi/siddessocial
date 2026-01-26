/* Siddes PWA client bootstrap (sd_001)
 * - Registers service worker
 * - Injects <link rel="manifest"> + theme-color meta if missing
 * - Shows install prompt banner (beforeinstallprompt)
 * - Shows update banner when a new SW is waiting (safe update strategy)
 */
(() => {
  const MANIFEST_HREF = "/manifest.webmanifest";
  const THEME_COLOR = "#0f172a";
  const SW_URL = "/sw.js";

  function ensureHead() {
    try {
      if (!document.querySelector('link[rel="manifest"]')) {
        const link = document.createElement("link");
        link.rel = "manifest";
        link.href = MANIFEST_HREF;
        document.head.appendChild(link);
      }
      if (!document.querySelector('meta[name="theme-color"]')) {
        const meta = document.createElement("meta");
        meta.name = "theme-color";
        meta.content = THEME_COLOR;
        document.head.appendChild(meta);
      }
    } catch (e) {
      // no-op
    }
  }

  function ensureStyles() {
    if (document.getElementById("siddes-pwa-style")) return;
    const style = document.createElement("style");
    style.id = "siddes-pwa-style";
    style.textContent = `
      .siddes-pwa-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;
        background:rgba(15,23,42,.92);color:#e5e7eb;border:1px solid rgba(148,163,184,.25);
        border-radius:16px;padding:12px 12px;backdrop-filter: blur(10px);
        box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;gap:10px;align-items:center;justify-content:space-between}
      .siddes-pwa-banner .txt{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
        font-size:13px;line-height:1.25;opacity:.95}
      .siddes-pwa-banner .btns{display:flex;gap:8px;flex-shrink:0}
      .siddes-pwa-banner button{cursor:pointer;border:0;border-radius:999px;padding:8px 12px;font-weight:800;
        font-size:12px;background:#e5e7eb;color:#0b1220}
      .siddes-pwa-banner button.secondary{background:transparent;color:#e5e7eb;border:1px solid rgba(229,231,235,.28)}
    `;
    document.head.appendChild(style);
  }

  function showBanner(id, text, primaryText, onPrimary, secondaryText, onSecondary) {
    ensureStyles();
    const existing = document.getElementById(id);
    if (existing) return;

    const el = document.createElement("div");
    el.className = "siddes-pwa-banner";
    el.id = id;

    const txt = document.createElement("div");
    txt.className = "txt";
    txt.textContent = text;

    const btns = document.createElement("div");
    btns.className = "btns";

    const primary = document.createElement("button");
    primary.textContent = primaryText;
    primary.onclick = () => {
      try { onPrimary && onPrimary(); } finally { hideBanner(id); }
    };

    btns.appendChild(primary);

    if (secondaryText) {
      const secondary = document.createElement("button");
      secondary.className = "secondary";
      secondary.textContent = secondaryText;
      secondary.onclick = () => {
        try { onSecondary && onSecondary(); } finally { hideBanner(id); }
      };
      btns.appendChild(secondary);
    }

    el.appendChild(txt);
    el.appendChild(btns);
    document.body.appendChild(el);
  }

  function hideBanner(id) {
    const el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function initInstallPrompt() {
    let deferredPrompt = null;

    window.addEventListener("beforeinstallprompt", (e) => {
      // Prevent mini-infobar
      e.preventDefault();
      deferredPrompt = e;

      // Don't nag if already installed
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return;

      showBanner(
        "siddes-install-banner",
        "Install Siddes for a faster, app-like experience.",
        "Install",
        async () => {
          if (!deferredPrompt) return;
          deferredPrompt.prompt();
          try { await deferredPrompt.userChoice; } catch (err) {}
          deferredPrompt = null;
        },
        "Not now",
        () => {}
      );
    });

    window.addEventListener("appinstalled", () => {
      hideBanner("siddes-install-banner");
    });
  }

  function showUpdateBanner(reg) {
    showBanner(
      "siddes-update-banner",
      "Update available. Reload to get the latest build.",
      "Reload",
      () => {
        try {
          if (reg && reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        } catch (e) {}
      },
      "Later",
      () => {}
    );
  }

  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;

    try {
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });

      // If there's already a waiting worker (e.g., a previous update)
      if (reg.waiting) showUpdateBanner(reg);

      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;

        sw.addEventListener("statechange", () => {
          // installed + we already have a controller => update is ready
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(reg);
          }
        });
      });

      // Reload once when the new SW takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        /* no hard reload (apply update on next open) */
      });
    } catch (e) {
      console.warn("[Siddes PWA] SW registration failed:", e);
    }
  }

  function main() {
    ensureHead();
    initInstallPrompt();
    registerSW();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
