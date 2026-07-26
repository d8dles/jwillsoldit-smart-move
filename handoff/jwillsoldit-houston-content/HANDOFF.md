# Houston, Handled. — Content Pack Handoff (Tasks 8, 9, 11)

**From:** cloud session, 2026-07-18/19, continuing from the desktop session's
`HOUSTON_HANDLED_SESSION_REPORT_20260718.md` and `HOUSTON_HANDLED_PHASE1_IMPLEMENTATION_PLAN.md`.
**Status:** 16/16 content files written, schema-validated, lint-clean, spot-checked.
**Not done:** merged into the real `jwillsoldit-houston` Astro repo, `npm run build`'d there,
or read by Joey. Treat everything below as a verified draft, not a finished product.

## What this is

The desktop session built Tasks 1–6 (scaffold, lint, schemas, layout, map, region pages) in a
local repo, `/Users/j0eschm0/Desktop/THE HUB/App:Web Work/JWILLSOLDIT.COM/jwillsoldit-houston`,
that this cloud session cannot reach. What *can* be done remotely — researched, sourced,
schema-shaped content — is done. This directory is a drop-in package for the other repo,
not a working site by itself.

## Inventory (16 files)

**Guides** (`src/content/guides/`, all `status: "draft"`):
property-taxes, muds-pids-and-utility-districts, flood-risk-and-insurance,
hoas-and-deed-restrictions, electricity-choice-and-utilities,
how-houston-is-organized, traffic-and-commutes, toll-roads-and-ez-tag,
no-zoning-explained, heat-humidity-and-hurricane-prep.

**Areas** (`src/content/areas/`, all `status: "draft"`):
the-heights, eado, katy, the-woodlands, sugar-land, clear-lake.

## What was actually checked (this review pass)

Four implementer agents authored the content in parallel (later serialized after
repeatedly hitting the account's session usage limit — see Process notes below). This
review was then done independently — by the supervising session, not the authoring
agents — using two scripts committed alongside this doc:

- **`scripts/lint-language.mjs`** — the plan's actual banned-vocabulary gate, re-implemented
  here and run against all 16 files. **Result: clean, 0 hits.**
- **`scripts/validate-schema.py`** — a Python re-implementation of the Task 3 zod schemas
  (required fields, enums, sources/updatedAt/status shape, connections 2–4 with no
  minute-based times, schoolDistricts ≥1, thingsToUnderstand ≥3, word-count bounds, slug
  = filename). **Result: clean, 0 problems across 10 guides + 6 areas.**
  This is a **stand-in** for the real `astro check` / zod validation, written because this
  container can't run the actual Astro repo. Re-run the real `npm run build` after merging
  — treat this script's pass as strong evidence, not a substitute.
- **Substance grep beyond the literal banned list** (safe/unsafe, desirable, upscale,
  affluent, exclusive, prestigious, crime rate, top-rated schools, sought-after, etc.):
  clean, 0 hits. Exclamation-mark scan: 0 real hits (one grep false-positive on an HTML
  comment's `<!--`).
- **Quarantined-claims check** (the "April 2026 HUD clarification" and any Houston
  population/land-area figure): clean, 0 hits.
- **Cross-file consistency:** every area's `regionSlug` matches the placeholder mapping
  in `AUTHORING-BRIEF.md` and is used identically where two areas share a region (Heights
  and EaDo both `central-houston`). Every guide's `disclaimerIds` matches the plan's
  Task 8/9 assignments exactly.
- **Read every `thingsToUnderstand` bullet across all 6 areas** (18 bullets) end to end —
  the highest fair-housing-risk surface in the schema. All read as neutral, structural,
  verifiable tradeoffs (MUD/LID tax mechanics, historic-district review, jurisdictional
  complexity, windstorm-insurance zones, HOA assessments, freight rail, event-day
  parking). None veer into safety, demographic, or desirability characterization.
- **Independent spot-verification of 3 claims** (I re-ran these myself, not trusting the
  authoring agents' self-reports):
  1. Shell Energy Stadium as Houston Dynamo FC/Dash's current venue name — **confirmed**
     current for 2026.
  2. The property-taxes.md exemption figures ($140,000 school-district homestead,
     $60,000 age-65/disabled) — **confirmed** directly against Texas Tax Code
     §11.13(b)/(c) via comptroller.texas.gov.
  3. Katy's "covers about 15 square miles" figure — **could not independently confirm.**
     My spot-check verified the three-county-junction framing and "30 miles west of
     Houston" via cityofkaty.com, but did not surface the specific acreage figure. The
     citation points to the correct official page (`cityofkaty.com/about`); I just
     couldn't verify that one number myself. **Recommend a human check this specific
     figure on cityofkaty.com before publishing** — don't strip it unilaterally, and don't
     assume it's fine either.

## Honest limits — read this part (mirrors the desktop session's own framing)

1. **This container's network policy blocks direct page fetches.** Both the authoring
   agents and this review used WebSearch results pinned to official domains
   (`allowed_domains`), not full page reads. A fact was accepted only when a search
   result snippet from an authoritative domain directly supported it; anything that
   didn't clear that bar was omitted (each file's completion report lists what got
   dropped). This is a real constraint, not a formality — a human with actual page access
   should still spot-check anything load-bearing before launch, the same way the desktop
   report insisted on for the region pages.
2. **AI reviewed AI, again.** Same caveat the desktop session gave for Task 6: this
   review pass was done by the supervising session, which is more independent than the
   authoring agents reviewing themselves, but it is still not human review. Joey reading
   every page remains a precondition for publishing, not optional.
3. **The `regionSlug` values are best-guess placeholders**, assigned from the mapping in
   `AUTHORING-BRIEF.md`, not read from the actual `src/content/regions/*.md` files in the
   Mac repo (this session can't reach them). **Before merging, confirm these 5 slugs
   exist exactly as spelled here** in the real region collection: `central-houston`,
   `west-houston-energy-corridor`, `north-houston-woodlands`, `southwest-fort-bend`,
   `clear-lake-bay-area`. If the real repo named them differently, it's a find-and-replace
   across 6 frontmatter blocks, not a content rewrite.
4. **The homestead-exemption dollar figures in property-taxes.md are a judgment call
   worth a second look.** They're official, statutory, and confirmed (see above) — not
   invented, not market data — but they're the one place in the pack with specific dollar
   amounts. The guide hedges them as legislatively set and subject to change. Keep, but
   Joey/broker review should knowingly bless this one, since the broader brief leaned
   toward omitting specific figures wherever possible.
5. **Nothing has been read by Joey.** Nothing has been merged, built with the real Astro
   toolchain, or deployed. The blast radius of everything in this content pack is one
   directory in the `jwillsoldit-smart-move` repo's `handoff/` folder — fully reversible.

## Process note: session usage limits

Running four research-heavy agents in parallel tripped this account's session usage
limit twice (resets logged at 8:30pm and 1:30am UTC on 2026-07-18). After the second
trip, work was serialized — one agent at a time — which completed without further
interruption. Each batch was committed and pushed to the remote branch as soon as it was
verified on disk, so no completed work was ever at risk from a further interruption. If
this content pack's approach (parallel background agents for independent research
batches) gets reused for Tasks 12–14 or the next batch of area pages, serializing from
the start — or capping parallelism at two — will likely avoid re-tripping the limit.

## How to merge (on the Mac, in the real `jwillsoldit-houston` repo)

1. `git pull` (or otherwise fetch) this content from `claude/houston-handled-spec-4t3fdt`
   in `jwillsoldit-smart-move`, then copy the two folders in wholesale:
   ```bash
   cp handoff/jwillsoldit-houston-content/src/content/guides/*.md  ../jwillsoldit-houston/src/content/guides/
   cp handoff/jwillsoldit-houston-content/src/content/areas/*.md   ../jwillsoldit-houston/src/content/areas/
   ```
2. Verify the 5 `regionSlug` values against the real `src/content/regions/*.md` slugs
   (see Honest Limits #3 above). Fix if they don't match.
3. Run the **real** build: `npm run build` (lint + `astro check` + `astro build`). This
   supersedes the Python validator used here — if the real zod schema catches something
   this approximation missed, trust the real one.
4. Read every page. This is Task 6's still-outstanding step for the region pages too —
   might as well do both passes together.
5. Flip `status: "draft"` → `"published"` file by file, only after each one is read and
   cleared — not as a batch.
6. Continue with the plan's Task 7 (guide template + index — note guide bodies here
   already assume the template renders `## `-level headings and a disclaimer block per
   `disclaimerIds`), Task 10 (area template — bodies here assume the Spec §5 section
   order), then 12–14 (landing page, SEO, deploy).

## Corrections

Checked against this directory's own files and the two scripts above, which are
committed alongside this document. If anything here is found inaccurate, the content
files and scripts are the authority, the same convention the desktop session's report
used.
