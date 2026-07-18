# Houston, Handled. — Content Authoring Brief (Tasks 8, 9, 11)

This brief is the contract for authoring the Phase 1 content files of the
`jwillsoldit-houston` Astro site (built separately on Joey's machine — Tasks 1–6 done).
You are authoring **drop-in markdown content files only**. No code, no templates.

**TODAY'S DATE: 2026-07-18.** Use it for every `updatedAt` and `accessed` value.

## Output location

Write files ONLY into:

- Guides → `/home/user/jwillsoldit-smart-move/handoff/jwillsoldit-houston-content/src/content/guides/`
- Areas  → `/home/user/jwillsoldit-smart-move/handoff/jwillsoldit-houston-content/src/content/areas/`

## The non-negotiable rules

1. **Never invent a fact.** No statistic, price, tax rate, drive time, population
   figure, business name, boundary, or date may appear unless your research (see
   Research Method) actually surfaced it from an authoritative source. If you cannot
   verify a fact, **omit it and write around it** — the templates render fine without
   it. Omission is success; invention is failure.
2. **Quarantined claims — never publish:** the "April 2026 HUD clarification" and any
   Houston population / land-area figure.
3. **No minute-based drive-time claims anywhere.** Approximate **mile ranges** are
   allowed with a source; traffic language stays qualitative ("varies widely with
   time of day and direction").
4. **No prices, no rent figures, no market statistics** — Phase 1 has no authorized
   market-data source, so none appear.
5. **No school quality judgments** (no ratings, no "good/strong schools") — district
   names + official links only. **No crime/safety characterizations of any kind.**
6. **No demographic characterization of any area** — who lives there, family status,
   age, religion, national origin, income class ("affluent", "upscale") are all off
   limits. Describe places and structures, never people.
7. **Do not write a `localNotes` field** for areas. That field is reserved for Joey's
   own first-person observations; an AI writing them would be fabrication.
8. **Zero exclamation marks.** No emoji.

## Banned vocabulary (build fails if any appears — case-insensitive substrings)

"best neighborhood", "good neighborhood", "bad area", "safe neighborhood",
"low-crime", "family-friendly", "good schools", "great schools",
"perfect for families", "young professional", "you belong here",
"people like you", "avoid this area", "up-and-coming", "dream home",
"nestled", "vibrant community", "something for everyone",
"best-kept secret", "perfect place to call home"

The banned list is a floor, not the whole rule: the substance rule is **no steering,
no rankings, no desirability language, no safety or school-quality judgments**.

## Voice

Write like a knowledgeable Houston local who respects the reader. Short declarative
sentences. Concrete. Plain. Honest tradeoffs. No realtor clichés, no chamber-of-
commerce tone, no "booming", no "charming".

Register reference (this is the standard):

> The Heights is an established area northwest of Downtown known for early
> twentieth-century homes, newer construction, independent businesses and the
> Heights Hike and Bike Trail. Housing ranges from restored bungalows and townhomes
> to larger recent builds. Access varies by location, with Interstate 10, Loop 610
> and several surface-street routes connecting the area to major employment centers.

## Research method (environment constraint — read carefully)

This container's network policy **blocks direct page fetches** (WebFetch/curl will
fail). **WebSearch works** and is your only research tool:

1. Load it once: `ToolSearch` with query `select:WebSearch`.
2. For each fact, run targeted searches **pinned to authoritative domains** using
   `allowed_domains`, e.g. `allowed_domains: ["tceq.texas.gov", "comptroller.texas.gov"]`.
3. A fact is "verified" only if the search results from an authoritative domain
   actually state it. Cite the exact result URL. Do not cite a URL whose result
   snippet did not support the fact.
4. Prefer official sources (Tier 1): state agencies (comptroller.texas.gov,
   tceq.texas.gov, puc.texas.gov / powertochoose.org, tdi.texas.gov, tea.texas.gov,
   txdot.gov, statutes.capitol.texas.gov), federal (fema.gov, floodsmart.gov,
   weather.gov, ready.gov), regional/local government (houstontx.gov, hcfcd.org,
   readyharris.org, hctra.org, ridemetro.org, fly2houston.com, harriscountytx.gov,
   fortbendcountytx.gov, mctx.org, hcad.org, fbcad.org), official district/municipal
   sites (houstonisd.org, katyisd.org, conroeisd.net, fortbendisd.com, ccisd.net,
   tomballisd.net, cityofkaty.com, sugarlandtx.gov, thewoodlandstownship-tx.gov).
   Wikipedia and news sites may orient you but are NOT sufficient sources for a
   published claim; if only they support a fact, omit the fact or find the official
   source.
5. Record every source used in the file's `sources` frontmatter with
   `accessed: "2026-07-18"`.
6. Because pages were verified via search excerpts rather than full fetches, keep
   claims conservative. When in doubt, generalize ("many newer master-planned
   sections are served by municipal utility districts") rather than specify.

## Frontmatter schemas (zod-enforced in the real repo — match EXACTLY)

**Quote every date value** (`"2026-07-18"`), otherwise YAML parses it as a Date and
the string regex fails. Quote any string containing a colon. `slug` must equal the
filename without `.md`.

### Guide file

```yaml
---
title: "Property Taxes in Greater Houston"
slug: "property-taxes"
description: "Max 160 characters, plain summary of what the guide covers."
disclaimerIds: ["general"]
sources:
  - label: "Texas Comptroller — Property Tax Basics"
    url: "https://comptroller.texas.gov/taxes/property-tax/"
    accessed: "2026-07-18"
updatedAt: "2026-07-18"
status: "draft"
---
Body: 700–1,200 words. `##` sections. The FINAL section must be
`## What this means when you're choosing a place`. Explain mechanisms and the
questions a renter/buyer should ask. Never give financial, legal, or insurance
advice — say "verify with the district / your agent / your insurer."
```

`disclaimerIds` allowed values: `general`, `schools`, `flood`, `travel-times`,
`development`, `market`. Per-file assignments are in the task lists below.

### Area file

```yaml
---
name: "The Heights"
slug: "the-heights"
regionSlug: "central-houston"        # best-guess placeholder — see note below
counties: ["Harris"]
jurisdiction: "City of Houston"       # verified statement of municipal status
areaType: "neighborhood"              # neighborhood | district | city | master-planned-community
housingTypes: ["Early twentieth-century bungalows", "Townhomes", "Recent single-family builds"]
typicalEra: "1910s–1930s originals alongside 1990s–present construction"
lotCharacter: "Compact urban lots; sizes vary block to block"
hoaPrevalence: "rare"                 # rare | some | common | nearly-universal
connections:
  - destination: "Downtown Houston"
    note: "Approximately 4–6 miles southeast; access via I-10, I-45 and surface streets, travel time varies widely with traffic"
schoolDistricts:
  - name: "Houston ISD"
    officialUrl: "https://www.houstonisd.org"
thingsNearby:
  - category: "Parks and trails"
    items: ["Heights Hike and Bike Trail"]
thingsToUnderstand:
  - "Parking arrangements vary by block, and some properties share driveways."
  - "Parts of the area carry historic-district or minimum-lot-size protections that affect renovation and redevelopment."
  - "Deed restrictions vary street by street; review them for any specific property."
sources:
  - label: "City of Houston Planning and Development — Historic Preservation"
    url: "https://www.houstontx.gov/planning/HistPres/"
    accessed: "2026-07-18"
updatedAt: "2026-07-18"
status: "draft"
---
Body: the area overview, 100–175 words, neutral and structural (location, built form,
housing mix, nearby destinations, defining physical/commercial features).
```

(The YAML above is a SHAPE example — verify every value you actually write.)

**`regionSlug` placeholders** (exact slugs live in the Mac repo's Spec §3; HANDOFF.md
flags these for a one-minute verification at merge): use `central-houston` (The
Heights, EaDo), `west-houston-energy-corridor` (Katy), `north-houston-woodlands`
(The Woodlands), `southwest-fort-bend` (Sugar Land), `clear-lake-bay-area`
(Clear Lake).

**Area field rules** (from plan Task 11):
- `jurisdiction`: verify the actual municipal status (e.g., Katy = City of Katy plus
  unincorporated Harris/Fort Bend/Waller County areas commonly addressed "Katy";
  The Woodlands = special-purpose township, mostly unincorporated Montgomery County;
  Clear Lake = largely City of Houston). Verify each before asserting; cite.
- `connections`: 2–4 entries, mile ranges only, qualitative notes; destinations from:
  Downtown, Texas Medical Center, Galleria/Uptown, IAH, Hobby, Energy Corridor,
  NASA/Johnson Space Center, Galveston — pick the regionally relevant ones.
- `schoolDistricts`: only districts that actually serve the area, official domains
  verified via search. Multiple districts fine where true.
- `thingsNearby`: ONLY named places with strong current evidence of operating
  (official site surfaced in search). Fewer, verified beats many, stale. Major parks,
  trails, institutions, venues — not small shops whose status can't be confirmed.
- `thingsToUnderstand`: ≥3 real, verified, neutral tradeoffs (MUD taxes in newer
  sections, shared driveways, rail crossings, windstorm insurance considerations,
  township assessments, event-day traffic near venues, mixed incorporated/
  unincorporated addressing…). Each verified or omitted.
- `status`: always `"draft"` — flipping to published happens on the Mac after the
  real build passes and pages are read.

## Completion report (your final message)

List: files written; for each file, the count of sources; and a short "omitted for
lack of verification" list — facts you considered and dropped. That list is signal,
not failure.
