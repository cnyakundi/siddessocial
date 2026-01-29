/**
 * Siddes Perf Budgets (LHCI)
 *
 * Auth: provide SD_PERF_SESSION_COOKIE="sessionid=...." and SD_LHCI_BASE_URL.
 * Viewer: SD_PERF_VIEWER_ID used to construct seeded post URL.
 */
const base = String(process.env.SD_LHCI_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const viewer = String(process.env.SD_PERF_VIEWER_ID || "").trim();
const postId = viewer ? `seed_${viewer}_post_pub_1` : "seed_me_post_pub_1";

const cookie = String(process.env.SD_PERF_SESSION_COOKIE || "").trim();

const settings = {
  chromeFlags: "--no-sandbox --disable-dev-shm-usage",
};

// If we have a cookie, apply it to all requests.
if (cookie) {
  settings.extraHeaders = { cookie };
}

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 2,
      url: [
        `${base}/login`,
        `${base}/siddes-feed`,
        `${base}/siddes-post/${postId}`,
      ],
      settings,
    },
    assert: {
      assertions: {
        // Hard gate (start reasonable, tighten later)
        "categories:performance": ["error", { minScore: 0.75 }],

        // Helpful signals (warns)
        "categories:accessibility": ["warn", { minScore: 0.85 }],
        "categories:best-practices": ["warn", { minScore: 0.85 }],

        // Core Web Vitals-ish budgets (mobile default)
        "first-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 4500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 600 }],
        "speed-index": ["warn", { maxNumericValue: 5500 }],

        // Weight (helps prevent bundle creep)
        "total-byte-weight": ["warn", { maxNumericValue: 3000000 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
