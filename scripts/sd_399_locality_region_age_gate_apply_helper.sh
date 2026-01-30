#!/usr/bin/env bash
set -euo pipefail

# sd_399: Locality pack (Region detection + user override) + minimal Age Gate
#
# Adds:
# - SiddesProfile fields:
#     detected_region, detected_region_source, chosen_region, chosen_region_set_at,
#     age_gate_confirmed, age_gate_confirmed_at
# - Backend endpoints:
#     GET/POST /api/auth/region
#     POST     /api/auth/age/confirm
# - Backend enforcement:
#     /api/auth/onboarding/complete requires age gate confirmed
# - Frontend:
#     Signup adds age checkbox (email/password flow)
#     Onboarding adds Step 0 (Age confirm + Region override)
#     Settings adds Region & Age page
# - Proxy:
#     Forwards coarse geo headers to backend (country-only)

if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
  echo "ERROR: Run this from your repo root (must contain ./backend and ./frontend)."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required (node not found)."
  exit 1
fi

BK=".backup_sd_399_locality_region_age_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BK"

echo "== sd_399: Locality (Region + Age gate) =="
echo "Backups: $BK"

backup_file() {
  local f="$1"
  if [ -f "$f" ]; then
    mkdir -p "$BK/$(dirname "$f")"
    cp -p "$f" "$BK/$f"
  fi
}

node_patch() {
  local f="$1"
  local label="$2"
  node - "$f" "$label" <<'NODE'
const fs = require("fs");

const file = process.argv[2];
const label = process.argv[3] || "patch";

function die(msg) {
  console.error(`ERROR(${label}): ${msg}`);
  process.exit(2);
}

let txt;
try {
  txt = fs.readFileSync(file, "utf8");
} catch (e) {
  die(`cannot read ${file}: ${e.message}`);
}

const original = txt;

function ensureContains(needle, msg) {
  if (!txt.includes(needle)) die(msg || `expected anchor not found: ${needle}`);
}

if (label === "auth_models_locality") {
  if (txt.includes("detected_region") || txt.includes("age_gate_confirmed")) {
    // already patched
  } else {
    const anchor = '    contact_sync_done = models.BooleanField(default=False)\n\n\n    # Email verification';
    ensureContains(anchor, "expected contact_sync_done + Email verification anchor not found");

    const replacement =
`    contact_sync_done = models.BooleanField(default=False)


    # Locality / region (sd_399)
    # - detected_region is coarse country code (2-letter), used for defaults only
    # - chosen_region is user override (wins for UX)
    detected_region = models.CharField(max_length=8, blank=True, default="", db_index=True)
    detected_region_source = models.CharField(max_length=32, blank=True, default="")
    chosen_region = models.CharField(max_length=8, blank=True, default="", db_index=True)
    chosen_region_set_at = models.DateTimeField(null=True, blank=True)

    # Age gate (sd_399) - store only a boolean + timestamp (no DOB)
    age_gate_confirmed = models.BooleanField(default=False)
    age_gate_confirmed_at = models.DateTimeField(null=True, blank=True)


    # Email verification`;

    txt = txt.replace(anchor, replacement);
  }
}

else if (label === "auth_urls_locality") {
  if (txt.includes("RegionView") && txt.includes("AgeGateConfirmView") && txt.includes('path("region"')) {
    // already patched
  } else {
    // Expand views import
    const importLine = "from .views import SignupView, LoginView, LogoutView, MeView, GoogleAuthView, OnboardingCompleteView";
    if (txt.includes(importLine)) {
      txt = txt.replace(
        importLine,
        "from .views import SignupView, LoginView, LogoutView, MeView, GoogleAuthView, OnboardingCompleteView, RegionView, AgeGateConfirmView"
      );
    } else if (!txt.includes("RegionView")) {
      die("cannot find siddes_auth.views import line to extend");
    }

    // Insert new routes after /me
    const meAnchor = '    path("me", MeView.as_view()),\n';
    ensureContains(meAnchor, "expected me route anchor not found");
    if (!txt.includes('path("region", RegionView.as_view())')) {
      txt = txt.replace(
        meAnchor,
        meAnchor +
          '    path("region", RegionView.as_view()),\n' +
          '    path("age/confirm", AgeGateConfirmView.as_view()),\n'
      );
    }
  }
}

else if (label === "auth_export_locality") {
  if (txt.includes('"ageGateConfirmed"') || txt.includes('"locality"')) {
    // already patched
  } else {
    const anchor = '                "onboarding": {\n' +
      '                    "completed": bool(getattr(prof, "onboarding_completed", False)),\n' +
      '                    "step": getattr(prof, "onboarding_step", "welcome"),\n' +
      '                    "contactSyncDone": bool(getattr(prof, "contact_sync_done", False)),\n' +
      "                },\n" +
      '                "accountState": getattr(prof, "account_state", "active"),';

    ensureContains(anchor, "expected export profile anchor not found");

    const insert =
'                "onboarding": {\n' +
'                    "completed": bool(getattr(prof, "onboarding_completed", False)),\n' +
'                    "step": getattr(prof, "onboarding_step", "welcome"),\n' +
'                    "contactSyncDone": bool(getattr(prof, "contact_sync_done", False)),\n' +
'                },\n' +
'                "ageGateConfirmed": bool(getattr(prof, "age_gate_confirmed", False)),\n' +
'                "ageGateConfirmedAt": getattr(prof, "age_gate_confirmed_at", None).isoformat() if getattr(prof, "age_gate_confirmed_at", None) else None,\n' +
'                "locality": {\n' +
'                    "detectedRegion": str(getattr(prof, "detected_region", "") or ""),\n' +
'                    "chosenRegion": str(getattr(prof, "chosen_region", "") or ""),\n' +
'                    "region": str(getattr(prof, "chosen_region", "") or getattr(prof, "detected_region", "") or ""),\n' +
'                },\n' +
'                "accountState": getattr(prof, "account_state", "active"),';

    txt = txt.replace(anchor, insert);
  }
}

else if (label === "auth_proxy_geo_headers") {
  if (txt.includes("sd_399: forward geo headers")) {
    // already patched
  } else {
    const anchor = '  const referer = req.headers.get("referer") || "";\n\n  const headers: Record<string, string> = {\n';
    ensureContains(anchor, "expected buildProxyHeaders anchor not found");

    const inject =
'  const referer = req.headers.get("referer") || "";\n' +
'\n' +
'  // sd_399: forward geo headers (country-only) so backend can set detected_region.\n' +
'  // These are hints used for defaults only (never enforcement).\n' +
'  const cf = req.headers.get("cf-ipcountry") || "";\n' +
'  const vercel = req.headers.get("x-vercel-ip-country") || "";\n' +
'  const cloudfront = req.headers.get("cloudfront-viewer-country") || "";\n' +
'  const geo = req.headers.get("x-geo-country") || "";\n' +
'  const gae = req.headers.get("x-appengine-country") || "";\n' +
'\n' +
'  const headers: Record<string, string> = {\n';

    txt = txt.replace(anchor, inject);

    // add to headers object population
    const retAnchor = "  if (referer) headers.referer = referer;\n  return headers;\n";
    ensureContains(retAnchor, "expected headers return anchor not found");
    txt = txt.replace(
      retAnchor,
      '  if (referer) headers.referer = referer;\n' +
      '  if (cf) headers["cf-ipcountry"] = cf;\n' +
      '  if (vercel) headers["x-vercel-ip-country"] = vercel;\n' +
      '  if (cloudfront) headers["cloudfront-viewer-country"] = cloudfront;\n' +
      '  if (geo) headers["x-geo-country"] = geo;\n' +
      '  if (gae) headers["x-appengine-country"] = gae;\n' +
      '  return headers;\n'
    );
  }
}

else if (label === "signup_age_checkbox") {
  if (txt.includes("sd_399_age_checkbox")) {
    // already patched
  } else {
    // add state
    const stateAnchor = '  const [password, setPassword] = useState("");\n';
    ensureContains(stateAnchor, "expected password state anchor not found");
    txt = txt.replace(stateAnchor, stateAnchor + '  const [ageOk, setAgeOk] = useState(false); // sd_399_age_checkbox\n');

    // canSubmit gating
    const canAnchor = "  const canSubmit = ";
    ensureContains(canAnchor, "expected canSubmit anchor not found");
    txt = txt.replace(
      /const canSubmit = ([^;]+);/,
      (m, expr) => `const canSubmit = (${expr}) && ageOk;`
    );

    // include in body
    const bodyAnchor = '      body: JSON.stringify({ email, username, password }),\n';
    ensureContains(bodyAnchor, "expected signup body JSON anchor not found");
    txt = txt.replace(bodyAnchor, '      body: JSON.stringify({ email, username, password, ageConfirmed: ageOk }),\n');

    // insert checkbox before msg
    const uiAnchor = '          />\n\n          {msg ? <div className="text-sm text-rose-600 font-medium">{msg}</div> : null}\n';
    ensureContains(uiAnchor, "expected UI insert anchor not found");

    const checkbox =
`          <div className="mt-2">\n            <label className="flex items-start gap-2 text-xs text-gray-600">\n              <input\n                type="checkbox"\n                className="mt-0.5"\n                checked={ageOk}\n                onChange={(e) => setAgeOk(e.target.checked)}\n              />\n              <span>\n                I confirm I’m at least 13 years old (or the minimum age required in my country).\n              </span>\n            </label>\n          </div>\n\n          {msg ? <div className="text-sm text-rose-600 font-medium">{msg}</div> : null}\n`;

    txt = txt.replace(uiAnchor, checkbox);
  }
}

else if (label === "settings_locality_link") {
  if (txt.includes('href="/siddes-settings/locality"')) {
    // already patched
  } else {
    const anchor = '        <Link href="/siddes-settings/blocked" className="block">\n';
    ensureContains(anchor, "expected blocked link anchor not found");

    const insert =
`        <Link href="/siddes-settings/locality" className="block">\n          <div className="mt-2 flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50">\n            <div>\n              <div className="text-sm font-bold text-gray-900">Region & Age</div>\n              <div className="text-xs text-gray-500 mt-1">Circle your region defaults and confirm age gate.</div>\n            </div>\n            <div className="text-xs font-extrabold text-gray-700">Open</div>\n          </div>\n        </Link>\n`;

    txt = txt.replace(anchor, insert + anchor);
  }
}

else if (label === "authme_type_locality") {
  if (txt.includes("locality?:")) {
    // already patched
  } else {
    const anchor = "  onboarding?: { completed: boolean; step: string };\n};\n";
    ensureContains(anchor, "expected MeResponse type anchor not found");
    txt = txt.replace(
      anchor,
      '  onboarding?: { completed: boolean; step: string };\n' +
      '  locality?: { detectedRegion?: string; chosenRegion?: string; region?: string };\n' +
      '  ageGateConfirmed?: boolean;\n' +
      '  ageGateConfirmedAt?: string | null;\n' +
      '  minAge?: number;\n' +
      '};\n'
    );
  }
}

else if (label === "auth_views_locality") {
  if (txt.includes("sd_399: locality helpers") && txt.includes("class RegionView(APIView):")) {
    // already patched
  } else {
    // 1) typing import
    txt = txt.replace(
      "from typing import Any, Dict",
      "from typing import Any, Dict, Optional, Tuple"
    );

    // 2) insert helpers after _ensure_profile
    if (!txt.includes("sd_399: locality helpers")) {
      const anchor =
`def _ensure_profile(user) -> SiddesProfile:
    prof, _ = SiddesProfile.objects.get_or_create(user=user)
    return prof
`;
      ensureContains(anchor, "expected _ensure_profile anchor not found");

      const helpers =
`\n\n# sd_399: locality helpers (coarse, privacy-respecting)\n_GEO_HEADER_CANDIDATES = (\n    (\"CF-IPCountry\", \"CF-IPCountry\"),\n    (\"X-Vercel-IP-Country\", \"X-Vercel-IP-Country\"),\n    (\"CloudFront-Viewer-Country\", \"CloudFront-Viewer-Country\"),\n    (\"X-Geo-Country\", \"X-Geo-Country\"),\n    (\"X-AppEngine-Country\", \"X-AppEngine-Country\"),\n)\n\n\ndef _min_age() -> int:\n    try:\n        v = int(str(os.environ.get(\"SIDDES_MIN_AGE\", \"13\")).strip() or \"13\")\n        return max(0, v)\n    except Exception:\n        return 13\n\n\ndef _detect_country_code(request) -> Tuple[str, str]:\n    \"\"\"Return (country_code, source_header) best-effort.\n\n    Country code is coarse (2-letter). Used for defaults only.\n    Never used for enforcement.\n    \"\"\"\n    try:\n        hdrs = getattr(request, \"headers\", None)\n    except Exception:\n        hdrs = None\n    if not hdrs:\n        return (\"\", \"\")\n\n    for name, key in _GEO_HEADER_CANDIDATES:\n        try:\n            v = hdrs.get(key)  # django headers mapping is case-insensitive\n        except Exception:\n            v = None\n        code = str(v or \"\").strip().upper()\n        if not code:\n            continue\n        if code in (\"XX\", \"T1\"):\n            continue\n        if len(code) == 2 and code.isalpha():\n            return (code, name)\n\n    return (\"\", \"\")\n\n\ndef _maybe_record_detected_region(prof: SiddesProfile, request) -> None:\n    try:\n        code, src = _detect_country_code(request)\n        if not code:\n            return\n        cur = str(getattr(prof, \"detected_region\", \"\") or \"\").strip().upper()\n        cur_src = str(getattr(prof, \"detected_region_source\", \"\") or \"\").strip()\n        if cur == code and cur_src == src:\n            return\n        prof.detected_region = code\n        prof.detected_region_source = src\n        prof.save(update_fields=[\"detected_region\", \"detected_region_source\", \"updated_at\"])\n    except Exception:\n        return\n\n\ndef _effective_region(prof: SiddesProfile) -> str:\n    chosen = str(getattr(prof, \"chosen_region\", \"\") or \"\").strip().upper()\n    if chosen:\n        return chosen\n    return str(getattr(prof, \"detected_region\", \"\") or \"\").strip().upper()\n\n\ndef _locality_payload(prof: SiddesProfile) -> Dict[str, Any]:\n    det = str(getattr(prof, \"detected_region\", \"\") or \"\").strip().upper()\n    cho = str(getattr(prof, \"chosen_region\", \"\") or \"\").strip().upper()\n    eff = _effective_region(prof)\n    return {\"detectedRegion\": det, \"chosenRegion\": cho, \"region\": eff}\n\n\ndef _ensure_age_gate(prof: SiddesProfile) -> None:\n    try:\n        if bool(getattr(prof, \"age_gate_confirmed\", False)):\n            return\n        prof.age_gate_confirmed = True\n        prof.age_gate_confirmed_at = timezone.now()\n        prof.save(update_fields=[\"age_gate_confirmed\", \"age_gate_confirmed_at\", \"updated_at\"])\n    except Exception:\n        return\n\n`;

      txt = txt.replace(anchor, anchor + helpers);
    }

    // 3) Signup: parse ageConfirmed
    if (!txt.includes("age_confirmed = bool(")) {
      const a = '        password = str(body.get(\"password\") or \"\")\n\n        if not email';
      ensureContains(a, "expected signup password anchor not found");
      txt = txt.replace(
        a,
        '        password = str(body.get(\"password\") or \"\")\n        age_confirmed = bool(body.get(\"ageConfirmed\") or body.get(\"age_confirmed\") or False)\n\n        if not email'
      );
    }

    // 4) Signup: set age + detected region inside transaction
    const signupTxnAnchor =
`            user = User.objects.create_user(username=username, email=email, password=password)
            _ensure_profile(user)
            _ensure_email_token(user, email)
            _bootstrap_default_sets(user)
`;
    if (txt.includes(signupTxnAnchor)) {
      txt = txt.replace(
        signupTxnAnchor,
`            user = User.objects.create_user(username=username, email=email, password=password)
            prof = _ensure_profile(user)
            if age_confirmed:
                _ensure_age_gate(prof)
            _maybe_record_detected_region(prof, request)
            _ensure_email_token(user, email)
            _bootstrap_default_sets(user)
`
      );
    }

    // 5) Login: record detected region
    const loginProfAnchor = "        _ensure_profile(user)\n        login(request, user)\n";
    if (txt.includes(loginProfAnchor)) {
      txt = txt.replace(
        loginProfAnchor,
        "        prof = _ensure_profile(user)\n        _maybe_record_detected_region(prof, request)\n        login(request, user)\n"
      );
    }

    // 6) MeView: record detected region after ensure_profile
    const meProfAnchor = "        _ensure_profile(user)\n\n        return Response(";
    if (txt.includes(meProfAnchor)) {
      txt = txt.replace(
        meProfAnchor,
        "        prof = _ensure_profile(user)\n        _maybe_record_detected_region(prof, request)\n\n        return Response("
      );
    }

    // 7) OnboardingComplete: enforce age gate
    const onbAnchor = "        prof = _ensure_profile(user)\n        body: Dict[str, Any] = request.data or {}\n";
    if (!txt.includes("age_gate_required") && txt.includes(onbAnchor)) {
      txt = txt.replace(
        onbAnchor,
`        prof = _ensure_profile(user)
        body: Dict[str, Any] = request.data or {}

        if not bool(getattr(prof, "age_gate_confirmed", False)):
            return Response({"ok": False, "error": "age_gate_required", "minAge": _min_age()}, status=status.HTTP_403_FORBIDDEN)
`
      );
    }

    // 8) Add locality + age fields to all auth responses (Signup/Login/Google/Me) by expanding emailVerified line
    if (!txt.includes('"ageGateConfirmed":')) {
      txt = txt.replace(
        /^(\s*)"emailVerified": bool\(getattr\(user\.siddes_profile, "email_verified", False\)\),\s*$/gm,
        (m, indent) => (
          `${indent}"emailVerified": bool(getattr(user.siddes_profile, "email_verified", False)),\n` +
          `${indent}"ageGateConfirmed": bool(getattr(user.siddes_profile, "age_gate_confirmed", False)),\n` +
          `${indent}"ageGateConfirmedAt": getattr(user.siddes_profile, "age_gate_confirmed_at", None).isoformat() if getattr(user.siddes_profile, "age_gate_confirmed_at", None) else None,\n` +
          `${indent}"minAge": _min_age(),\n` +
          `${indent}"locality": _locality_payload(user.siddes_profile),`
        )
      );
    }

    // 9) Add RegionView + AgeGateConfirmView + wire Google to record detected region
    if (!txt.includes("class RegionView(APIView):")) {
      txt += `\n\n# ---------------------------------------------------------------------------\n# Locality endpoints (sd_399)\n# ---------------------------------------------------------------------------\n\n@method_decorator(dev_csrf_exempt, name=\"dispatch\")\nclass RegionView(APIView):\n    \"\"\"GET/POST /api/auth/region\n\n    - GET returns detected + chosen + effective region\n    - POST sets chosen region (2-letter country code) or clears when region is blank\n\n    NOTE: region is used for defaults only, not enforcement.\n    \"\"\"\n\n    throttle_scope = \"auth_region\"\n\n    def get(self, request):\n        user = getattr(request, \"user\", None)\n        if not user or not getattr(user, \"is_authenticated\", False):\n            return Response({\"ok\": False, \"error\": \"restricted\"}, status=status.HTTP_401_UNAUTHORIZED)\n\n        prof = _ensure_profile(user)\n        _maybe_record_detected_region(prof, request)\n        return Response({\"ok\": True, \"locality\": _locality_payload(prof)}, status=status.HTTP_200_OK)\n\n    def post(self, request):\n        user = getattr(request, \"user\", None)\n        if not user or not getattr(user, \"is_authenticated\", False):\n            return Response({\"ok\": False, \"error\": \"restricted\"}, status=status.HTTP_401_UNAUTHORIZED)\n\n        prof = _ensure_profile(user)\n        body: Dict[str, Any] = request.data if isinstance(request.data, dict) else {}\n        region = str(body.get(\"region\") or body.get(\"chosenRegion\") or \"\").strip().upper()\n\n        if not region:\n            prof.chosen_region = \"\"\n            prof.chosen_region_set_at = None\n            prof.save(update_fields=[\"chosen_region\", \"chosen_region_set_at\", \"updated_at\"])\n            _maybe_record_detected_region(prof, request)\n            return Response({\"ok\": True, \"cleared\": True, \"locality\": _locality_payload(prof)}, status=status.HTTP_200_OK)\n\n        if len(region) != 2 or (not region.isalpha()):\n            return Response({\"ok\": False, \"error\": \"invalid_region\"}, status=status.HTTP_400_BAD_REQUEST)\n\n        prof.chosen_region = region\n        prof.chosen_region_set_at = timezone.now()\n        prof.save(update_fields=[\"chosen_region\", \"chosen_region_set_at\", \"updated_at\"])\n\n        _maybe_record_detected_region(prof, request)\n        return Response({\"ok\": True, \"locality\": _locality_payload(prof)}, status=status.HTTP_200_OK)\n\n\n@method_decorator(dev_csrf_exempt, name=\"dispatch\")\nclass AgeGateConfirmView(APIView):\n    \"\"\"POST /api/auth/age/confirm\n\n    Minimal age gate: store a boolean + timestamp (no DOB).\n    \"\"\"\n\n    throttle_scope = \"auth_age_gate\"\n\n    def post(self, request):\n        user = getattr(request, \"user\", None)\n        if not user or not getattr(user, \"is_authenticated\", False):\n            return Response({\"ok\": False, \"error\": \"restricted\"}, status=status.HTTP_401_UNAUTHORIZED)\n\n        prof = _ensure_profile(user)\n        _ensure_age_gate(prof)\n        return Response({\"ok\": True, \"ageGateConfirmed\": True, \"minAge\": _min_age()}, status=status.HTTP_200_OK)\n`;
    }

    // GoogleAuth: record detected region once we have a profile
    if (!txt.includes("_maybe_record_detected_region(")) {
      // already added in login/me/signup; google may still not be patched but ok
    } else {
      // best-effort: after "login(request, user)" add region record if not already present nearby
      txt = txt.replace(
        /login\(request, user\)\n\s*# Ensure session key exists/m,
        (m) => `login(request, user)\n        try:\n            _maybe_record_detected_region(user.siddes_profile, request)\n        except Exception:\n            pass\n\n        # Ensure session key exists`
      );
    }
  }
}

else if (label === "onboarding_locality_age_gate") {
  if (txt.includes("sd_399_step0_locality")) {
    // already patched
  } else {
    // Replace MeResp type block
    txt = txt.replace(
`type MeResp = {
  ok: boolean;
  authenticated?: boolean;
  user?: { id: number; username: string; email: string };
  viewerId?: string;
  onboarding?: { completed: boolean; step?: string; contact_sync_done?: boolean };
};
`,
`type MeResp = {
  ok: boolean;
  authenticated?: boolean;
  user?: { id: number; username: string; email: string };
  viewerId?: string;
  onboarding?: { completed: boolean; step?: string; contact_sync_done?: boolean };
  locality?: { detectedRegion?: string; chosenRegion?: string; region?: string };
  ageGateConfirmed?: boolean;
  ageGateConfirmedAt?: string | null;
  minAge?: number;
};
`
    );

    // Insert state vars near msg/note
    const stateAnchor = '  const [msg, setMsg] = useState<string | null>(null);\n  const [note, setNote] = useState<string | null>(null);\n';
    ensureContains(stateAnchor, "expected msg/note state anchor not found");
    txt = txt.replace(
      stateAnchor,
      stateAnchor +
      '  const [localityMsg, setLocalityMsg] = useState<string | null>(null);\n' +
      '  const [ageOk, setAgeOk] = useState(false);\n' +
      '  const [ageBusy, setAgeBusy] = useState(false);\n' +
      '  const [regionChoice, setRegionChoice] = useState<string>(\"\");\n' +
      '  const [regionBusy, setRegionBusy] = useState(false);\n'
    );

    // After authed compute, inject derived vars + region sync
    const authedAnchor = "  const authed = !!me?.authenticated;\n";
    ensureContains(authedAnchor, "expected authed anchor not found");
    txt = txt.replace(
      authedAnchor,
      authedAnchor +
      '\n  const ageConfirmed = !!me?.ageGateConfirmed;\n' +
      '  const minAge = typeof me?.minAge === \"number\" && (me.minAge as any) > 0 ? (me.minAge as number) : 13;\n' +
      '  const detectedRegion = String(me?.locality?.detectedRegion || \"\").trim();\n' +
      '  const cho
