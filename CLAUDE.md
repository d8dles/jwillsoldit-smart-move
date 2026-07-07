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

- **`index.html`** — the entire front end: ~6,200 lines with **inline CSS + JS, no build
  step, no framework, no bundler**. This single-file, no-build design is a *deliberate,
  documented choice* — **do not propose splitting it into modules or adding a build.**
  The flow is a global (non-module) script: `FormLogic` (state/validation) plus top-level
  functions (`goTo`, `selectPath`, `submitContact`, `renderRouteDetails`, …) wired via
  inline `onclick`. Sections are `section-open,-path,-contact,-trunk,-budget,-area,
  -details,-brief` (indices 0–7).
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

## Known sharp edges

- **`index.html` has layered patch history** ("V8/V9/V14" CSS patch blocks, ~900 lines of
  dead `FormLogic` stub code, a dead `detectSmartFlags()` referencing renamed fields). A
  duplicate patch block has re-broken a fixed row before. **Always run the harness after
  editing `index.html`** — that is what it exists for.
- The flow uses auto-advance timers *plus* always-visible Continue buttons as the safety
  net (the fix for the old C1 stranding bug). If you touch `scheduleAutoAdvance`,
  `triggerBlueprintRewind`, or the scroll handlers, re-run the C1 regression check.
- A benign **≤1px sub-pixel horizontal overflow** exists at some viewports; the harness
  tolerates ≤1px. Anything larger is a real regression.
- Background on prior work: `docs/SMART-MOVE-AUDIT-2026-07.md` (audit + fixes),
  `reflection-notes.md` (setup retrospective).
