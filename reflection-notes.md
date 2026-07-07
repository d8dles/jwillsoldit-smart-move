# Reflection Notes — Setup Improvements from Session Retrospective

Date: 2026-07-07. Diagnosis only — nothing here has been built. Ranked most leverage first.

## Session inventory (the evidence base)

| Session | When | Identifier | Output |
|---|---|---|---|
| Launch era (≥4 working bursts) | Jun 29–30, 2026 | No session trailers; commits `6db7305`…`5226650` | 15 commits: site launch (5,855-line drop), HubSpot backend, social/SEO, Resend lead alerts |
| Audit session | Jul 2, 2026 | `session_011ACMwhyx7Wc1ZrAPwGuhqX`; commits `4e41cff`…`fe56f29` | 14 commits: full Playwright audit at 5 viewports, 9-fix batch, 21 evidence screenshots, merged to main |
| Deploy session (current) | Jul 4–7, 2026 | `a19ba225-89dd-5648-9113-df1af78974b4`, branch `claude/github-pass-vercel-deploy-t96bpa` | 1 branch push, **0 commits, deploy never completed** |

Sources: full parse of the local transcript, `git log --all` across the three branches, `docs/SMART-MOVE-AUDIT-2026-07.md` + `docs/audit-evidence/after/verification-results.json`, README/.env.example/api code, and the hooks in `~/.claude/`.

---

## 1. The Vercel deploy path is a dead end from these sessions — finish the one-time wiring

**Verdict: fix (one-time setup + environment config). Not a skill — once wired, it stops recurring.**

**Evidence:**
- Deploy session, turn 1: "upload the pass to vercel so that I can share the app" → the environment has no Vercel CLI, no Vercel auth, and no Vercel integration, so the session could only push the branch and hand back a manual dashboard checklist. Turn ended on unanswered questions (which Vercel account? HubSpot token handy?).
- Deploy session, turn 2: follow-up question about repos/projects; session stalled again on the same unknowns. Three days later the deploy still hasn't happened and the branch has zero commits.
- Audit session: the sandbox network policy blocked reaching `move.jwillsoldit.com`, so production was mocked locally; the audit explicitly closes with "a single manual live submission on the production URL is still recommended to confirm HubSpot/Resend wiring" — i.e. the same gap.
- README already documents the intended flow (import `d8dles/jwillsoldit-smart-move` in Vercel, set env vars, deploy on push to `main`) — it's documented but was never executed.

**What it wants:** one-time, mostly outside the sandbox: (a) connect the repo to Vercel via Vercel's GitHub integration so every merge to `main` auto-deploys; (b) enter `HUBSPOT_ACCESS_TOKEN`, `ALLOWED_ORIGIN`, and the optional Resend trio in the Vercel dashboard; (c) optionally add a `VERCEL_TOKEN` env var to this Claude Code environment so future sessions can run `vercel` CLI deploys and check deploy status themselves instead of stalling. Recurrence is currently 2 stalls in 1 session plus a standing audit caveat; build cost is ~30 minutes of your time. Highest leverage because it's the only item blocking the actual goal (sharing the app).

## 2. Every session re-derives the repo from scratch — add a CLAUDE.md

**Verdict: fix (trivial). Highest leverage-per-cost on the list.**

**Evidence:**
- Deploy session, turn 1: 7 orientation calls (ls, read vercel.json, read .env.example, git status, find package.json, git log, git branch/remote) before the first real action — rediscovering facts the launch and audit sessions already knew.
- Deploy session, turn 3: the same "where is everything" sweep again before the retro work.
- Sessions run in ephemeral containers cloned fresh each time, so nothing carries over except what's committed. There is no CLAUDE.md, no `.claude/` project directory, and no package.json to orient from.
- The user's phrase "the pass" in turn 1 was flagged as ambiguous in-session; a project brief stating "deploys to Vercel, live at move.jwillsoldit.com, single-file index.html, one serverless function" would have disambiguated instantly.

**What it wants:** a short CLAUDE.md at repo root: what the project is, the deploy story (Vercel on push to main; env vars and where they live), the architecture (6,229-line single-file `index.html`, `api/smart-move.js`, no build step, no tests), how to verify changes (see item 3), and known sharp edges (patch-layered CSS, dead `FormLogic` code). ~20 minutes to write, pays off every single future session.

## 3. Verification keeps being rebuilt and thrown away — commit the Playwright harness as the project's verify skill

**Verdict: skill (this genuinely recurs) — but the core is committing the harness, with a thin skill/doc pointing at it.**

**Evidence of recurrence:**
- Launch era: 9 of 28 commits across all sessions are fix/restore/rework commits. Same-day self-corrections: HubSpot backend added `2afaea0` then substantially rewritten 50 minutes later (`afad479`, +110/−77); social preview fixed twice (`5248392`, `7b2a64a`); duplicate questions introduced and fixed 3 minutes apart (`d6d2f03` → `d0c2920`).
- Audit session built a real harness — Playwright driving all six paths end-to-end at 390px, overflow checks at 360/430/820/1440, submission-payload capture (21 submissions), tracking-param verification — and produced `docs/audit-evidence/after/verification-results.json`. **The harness script itself was never committed.** Only its outputs survive; the verification is not re-runnable, and the container that held the script is gone.
- Cross-session regressions prove the need: `d72e91b`'s commit message documents removing "a later duplicate patch block that re-broke the row" — a hotfix re-breaking an earlier fix inside index.html. The audit session also spent effort reversing launch-era decisions (`487689f` restoring Continue buttons, `a1e2e78` removing auto-advance).
- The 15 before-screenshots were explicitly labeled as the baseline "for regression-checking every fix" — the intent to re-run exists; the tooling doesn't.

**What it wants:** rebuild the harness once (the JSON output is a precise spec: 6 e2e paths, 7-step sequences, overflow ≤ 0 across 5 viewports, mock `/api/smart-move`, submission capture, the C1 scroll-up regression scenario), commit it (e.g. `tests/verify.mjs` + minimal package.json), and register it as the project verify skill so any session can run it before pushing. Build cost: one focused session, and the spec already exists. Recurrence: every future change to index.html — which is 79% of all commits to date (see item 4). Optional follow-on, weigh separately: a GitHub Actions workflow running it on PRs (repo currently has zero CI); cheap once the harness is committed.

## 4. index.html is a 6,229-line patch-archaeology monolith — do a one-time dead-code purge, not a refactor

**Verdict: fix (one-time, medium cost). No skill, no rewrite.**

**Evidence:**
- `index.html` (212KB) is touched in **22 of 28 commits (79%)** — every UI, copy, styling, and behavior change lands in one file.
- The audit documents "CSS patch archaeology (V8, V9, V14)" — layered version-labeled patch blocks — plus ~900 lines of dead `FormLogic` code and a dead `detectSmartFlags()` referencing non-existent field names (`Q7_existingAgent`).
- The patch layering has already caused a real regression (`d72e91b`, duplicate patch block re-breaking a fixed row).

**What it wants:** a single cleanup pass — delete the dead ~900-line FormLogic block and dead functions, flatten the V8/V9/V14 patch layers into the base styles — gated by the item-3 harness so the cleanup itself can't silently regress the six paths. A full split into separate files/build step is *not* justified: "single-file, no build step" is a deliberate, documented choice, and recurrence of pain traces to the dead layers, not the single-file-ness. Do this only after item 3 exists.

## 5. Known api/smart-move.js hardening backlog — small approved-fix batch

**Verdict: fix (small, already scoped by the audit). Nothing new to diagnose — it's sitting in the audit's Phase 3 awaiting approval.**

**Evidence:**
- Audit §7 (confirmed by direct code read this session): user input interpolated raw into the alert-email HTML (injection), no honeypot / rate limiting on the endpoint, and `ensureCustomProperties()` making 9 property-schema calls to HubSpot on **every** submission (quota + latency).
- These were explicitly "gated on your explicit approval" in the audit's phased plan and remain unshipped 5 days later — the gate itself is the friction.

**What it wants:** approve and ship the batch (escape interpolated fields, add honeypot, cache/skip the property-ensure after first success). ~1 session, one commit each per the audit's existing plan.

## 6. Clusters that want nothing

- **CNAME / GitHub Pages leftover** — appeared in two sessions' reads; audit already ruled it "harmless on Vercel". Leave it.
- **Session hooks** (`stop-hook-git-check.sh`, git-identity, reply-gate) — working as intended; the git-check hook is why session work reliably ends up pushed. No change.
- **Tool-error noise** — 1 trivial EISDIR across the entire transcript record, 0 permission denials, 0 failed pushes. The mechanical setup is clean; no automation warranted.
- **A "deploy skill"** — considered and rejected: deploy friction (item 1) is a missing one-time integration, not a recurring procedure worth encoding. Proposing a skill here would be building around a fixable gap.

---

## Ranked summary

| # | Cluster | Wants | Recurrence | Build cost |
|---|---|---|---|---|
| 1 | Vercel deploy dead-end | One-time wiring (GitHub↔Vercel integration, dashboard env vars, optional `VERCEL_TOKEN` in environment) | Blocked the current session twice + standing audit caveat | ~30 min, mostly yours |
| 2 | Per-session re-orientation | CLAUDE.md project brief | Every session (fresh container) | ~20 min |
| 3 | Throwaway verification | Commit Playwright harness + project verify skill | Every index.html change (79% of commits); 9/28 commits are rework | ~1 session; spec already exists in `verification-results.json` |
| 4 | index.html patch archaeology | One-time dead-code purge (after #3) | Regression source touched in 22/28 commits | ~1 session |
| 5 | api hardening backlog | Approve + ship audit Phase 3 batch | Already scoped, waiting on approval | &lt;1 session |
| 6 | CNAME, hooks, tool noise, "deploy skill" | Nothing | — | — |

Only one skill is proposed (#3), and only because verification demonstrably recurred across the launch era and the audit session and will recur on every future change to the monolith.
