# CLAUDE.md — Smart Move intake site

Project brief for future Claude Code sessions. Sessions run in fresh containers, so
this file is the fastest way to orient. Read it before touching anything.

## What this is

The **Smart Move** intake site for real estate agent **Joey Williams / JWillSoldIt**
(Christin Rachelle Group). A single, premium multi-step lead-capture funnel that routes
a visitor down one of **six paths** and hands Joey a "Smart Move Brief" in HubSpot.

- Live at **https://move.jwillsoldit.com**
- The six user paths: **rent, buy, sell, sell-buy, commercial, not-sure**
- Most traffic is paid social (Facebook), so ad-attribution and partial-lead capture matter.

## Architecture

- **Front end = `index.html` (page shell) + `assets/css/*.css` + `assets/js/*.js`.**
  Still **no build step, no framework, no bundler, no dependencies** — the CSS/JS are
  plain static files loaded via `<link>` and `<script src>`. As of the
  `refactor/move-brand-system-v1` pass the old single-file `index.html` (~5,950 lines of
  inline CSS + JS) was split, *without behavior changes*, into:
  - **CSS** (in `<head>`, load order matters — later files override earlier; keep this order):
    `tokens.css` → `base.css` → `progress.css` → `layout.css` → `hero.css` → `form.css`
    → `responsive.css`. `responsive.css` holds the media queries and the V8/V9/V14 +
    footer patch blocks, so it **must stay last** or the cascade breaks.
  - **JS** (at end of `<body>`, **global / non-module** classic scripts, load order matters):
    `state.js` (`FormLogic` — state/validation/submission shape) → `config.js`
    (constants, ad-attribution capture, `SECTIONS`, `FormLogic.init()`) → `steps.js`
    (navigation, auto-advance, path/contact/trunk/budget/area handlers) → `validation.js`
    (dynamic field rendering + readiness) → `submit.js` (submission/brief builders) →
    `app.js` (hero/trail/route-cue engines + bootstrap). They share one global scope, so
    they are **classic scripts, not ES modules** — the flow is `FormLogic` plus top-level
    functions (`goTo`, `selectPath`, `submitContact`, `renderRouteDetails`, …) wired via
    inline `onclick`; **do not convert to modules or `defer` them** (inline handlers rely
    on the globals and on this exact load order). Sections are `section-open,-path,
    -contact,-trunk,-budget,-area,-details,-brief` (indices 0–7).
- **`api/smart-move.js`** — the only backend: a Vercel serverless function. Validates
  `contact.name` + `contact.email` (400 otherwise), upserts a HubSpot contact by email
  (creates custom `smart_move_*` properties, attaches the Brief as a note), and sends an
  optional Resend lead-alert email. Handles both `partial_contact` and `final` submissions.
- **`privacy.html`** — static privacy policy (linked from both footers).
- No database, no other backend, no other pages of substance.
- `CNAME`, `robots.txt`, `sitemap.xml`, `assets/`, `social-card.png` are static extras.
  **`CNAME` is a GitHub Pages leftover — harmless on Vercel, leave it.**

## Deploy

- Hosted on **Vercel**, which serves `index.html` and runs `api/smart-move.js` from the
  same domain. **Deploys automatically on push to `main`.**
- Env vars are set in the **Vercel dashboard** (Project → Settings → Environment Variables):
  - Required: `HUBSPOT_ACCESS_TOKEN`, `ALLOWED_ORIGIN` (`https://move.jwillsoldit.com`)
  - Optional (lead-alert email): `RESEND_API_KEY`, `LEAD_ALERT_TO`, `LEAD_ALERT_FROM`
    — all three needed or alerts are silently skipped (HubSpot sync is unaffected).
- Full deploy steps and HubSpot scopes are in `README.md`.

## How to verify changes

A committed Playwright harness drives all six paths end-to-end against a local mock of
the `/api/smart-move` contract. **Run it after any change to `index.html`:**

```bash
npm install        # first time only; Chromium is preinstalled, browser download is skipped
npm run verify     # drives 6 paths + regression + 5 viewports; exits non-zero on failure
```

It checks: all six paths complete via visible buttons, step transitions, no auto-advance on
the details step, horizontal overflow at 360/390/430/820/1440, the C1 scroll-up recovery
scenario, UTM/fbclid capture, and partial+final submission capture. Results land in
`tests/last-run.json` (gitignored). Harness code: `tests/verify.mjs`, `tests/mock-api.mjs`.

## Rental Verification & Invoicing module (private)

A second, self-contained module for Joey's internal use: `/admin/verifications*`,
`/admin/invoices/:id`, and the tokenized `/forms/client-verification/:token` +
`/forms/property-verification/:token` public forms. It **does not touch** the Smart
Move funnel, its payloads, or HubSpot fields — separate CSS (`assets/css/admin.css`),
separate JS (`assets/js/admin-*.js`, `assets/js/public-form-*.js`), separate backend
(`api/_lib/`, `api/admin/`, `api/forms/`). Storage is Vercel KV (`KV_REST_API_URL`/
`KV_REST_API_TOKEN`, required in production — falls back to a non-persistent local
JSON file otherwise) behind a single JSON document (`api/_lib/store.js`). Admin auth
is a shared `ADMIN_PASSWORD` + HttpOnly cookie session, with optional email-code 2FA
(`ADMIN_2FA_EMAIL`, fails closed if Resend is misconfigured) and a global lockout
after repeated failed passwords (`api/_lib/auth.js`). Link
tokens are hashed for validation and separately encrypted at rest so the admin can
re-display an already-issued link (`api/_lib/tokens.js`, `api/_lib/crypto.js`). See
the "Rental Verification & Invoicing module" section in `README.md` for env vars and
route details.

**All `/api/admin/*` and `/api/forms/*` endpoints route through two catch-all
functions** (`api/admin/[...route].js`, `api/forms/[...route].js`) dispatching to
handlers under `api/_lib/handlers/` — not one file per endpoint. This exists solely
to stay under Vercel Hobby's 12-Serverless-Functions-per-deployment cap (the module
has 18 logical endpoints; per-file would blow the budget instantly and fail the
whole deployment with `exceeded_serverless_functions_per_deployment`). **Adding a new
admin/forms endpoint means adding a handler module + a case in the router, never a
new file directly under `api/admin/` or `api/forms/`.** Relatedly: `vercel.json`
must never gain a rewrite whose `source` matches `/api/(.*)` — even a no-op
identity rewrite (`destination: /api/$1`) intercepts the request before Vercel's
filesystem router can match it against `[...route].js` and populate
`req.query.route`, so every admin/forms API call 404s with "Unknown route" while
`/api/smart-move` (no dynamic segments) keeps working — this exact bug shipped and
broke `/admin` sign-in in production once already.

## Known sharp edges

- **The front end has layered patch history** (the "V8/V9/V14" CSS patch blocks now live in
  `assets/css/responsive.css`; ~900 lines of dead `FormLogic` stub code and a dead
  `detectSmartFlags()` referencing renamed fields live in `assets/js/state.js`). A
  duplicate patch block has re-broken a fixed row before. **Always run the harness after
  editing any `index.html` / `assets/css` / `assets/js` file** — that is what it exists for.
- The flow uses auto-advance timers *plus* always-visible Continue buttons as the safety
  net (the fix for the old C1 stranding bug). If you touch `scheduleAutoAdvance`,
  `triggerBlueprintRewind`, or the scroll handlers, re-run the C1 regression check.
- A benign **≤1px sub-pixel horizontal overflow** exists at some viewports; the harness
  tolerates ≤1px. Anything larger is a real regression.
- Background on prior work: `docs/SMART-MOVE-AUDIT-2026-07.md` (audit + fixes),
  `reflection-notes.md` (setup retrospective).
