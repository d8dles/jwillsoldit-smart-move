#!/usr/bin/env python3
"""Independent schema validator mirroring the Astro zod collections (Task 3 of the plan).
Verification-only script for the content handoff; not part of the shipped Astro repo."""
import sys, re, glob, yaml, os

DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
AREA_TYPES = {"neighborhood", "district", "city", "master-planned-community"}
HOA = {"rare", "some", "common", "nearly-universal"}
DISCLAIMER_IDS = {"general", "schools", "flood", "travel-times", "development", "market"}
STATUS = {"draft", "published"}

errors = []

def err(f, msg):
    errors.append(f"{f}: {msg}")

def load(path):
    text = open(path, encoding='utf-8').read()
    m = re.match(r'^---\n(.*?)\n---\n(.*)$', text, re.S)
    if not m:
        err(path, "no frontmatter block found")
        return None, None
    try:
        fm = yaml.safe_load(m.group(1))
    except yaml.YAMLError as e:
        err(path, f"YAML parse error: {e}")
        return None, None
    return fm, m.group(2)

def check_sources(f, sources):
    if not isinstance(sources, list) or len(sources) < 1:
        err(f, "sources must be a non-empty list")
        return
    for s in sources:
        if 'label' not in s: err(f, f"source missing label: {s}")
        if 'accessed' not in s or not DATE_RE.match(str(s.get('accessed'))):
            err(f, f"source accessed date invalid/unquoted: {s}")

def check_updated(f, fm):
    if 'updatedAt' not in fm or not DATE_RE.match(str(fm['updatedAt'])):
        err(f, f"updatedAt invalid or unquoted: {fm.get('updatedAt')!r}")

def check_status(f, fm):
    if fm.get('status') not in STATUS:
        err(f, f"status invalid: {fm.get('status')!r}")

def check_slug(f, fm):
    base = os.path.splitext(os.path.basename(f))[0]
    if fm.get('slug') != base:
        err(f, f"slug {fm.get('slug')!r} does not match filename {base!r}")

for f in sorted(glob.glob('src/content/guides/*.md')):
    fm, body = load(f)
    if fm is None: continue
    for req in ('title', 'slug', 'description', 'disclaimerIds', 'sources', 'updatedAt', 'status'):
        if req not in fm: err(f, f"missing required field: {req}")
    check_slug(f, fm)
    if len(fm.get('description', '')) > 160:
        err(f, f"description exceeds 160 chars ({len(fm['description'])})")
    for d in fm.get('disclaimerIds', []):
        if d not in DISCLAIMER_IDS:
            err(f, f"invalid disclaimerId: {d}")
    check_sources(f, fm.get('sources', []))
    check_updated(f, fm)
    check_status(f, fm)
    wc = len(body.split())
    if not (700 <= wc <= 1200):
        err(f, f"body word count {wc} outside 700-1200")
    if not body.strip().rstrip().endswith("choosing a place") and "## What this means when you're choosing a place" not in body:
        err(f, "missing required final section '## What this means when you're choosing a place'")

for f in sorted(glob.glob('src/content/areas/*.md')):
    fm, body = load(f)
    if fm is None: continue
    required = ('name', 'slug', 'regionSlug', 'counties', 'jurisdiction', 'areaType',
                'housingTypes', 'typicalEra', 'lotCharacter', 'hoaPrevalence',
                'connections', 'schoolDistricts', 'thingsNearby', 'thingsToUnderstand',
                'sources', 'updatedAt', 'status')
    for req in required:
        if req not in fm: err(f, f"missing required field: {req}")
    check_slug(f, fm)
    if 'localNotes' in fm:
        err(f, "localNotes present — reserved for Joey's first-person notes, must not be AI-authored")
    if fm.get('areaType') not in AREA_TYPES:
        err(f, f"invalid areaType: {fm.get('areaType')!r}")
    if fm.get('hoaPrevalence') not in HOA:
        err(f, f"invalid hoaPrevalence: {fm.get('hoaPrevalence')!r}")
    conns = fm.get('connections', [])
    if not (2 <= len(conns) <= 4):
        err(f, f"connections count {len(conns)} outside 2-4")
    for c in conns:
        if 'destination' not in c or 'note' not in c:
            err(f, f"connection missing destination/note: {c}")
        elif re.search(r'\b\d+\s*(-\s*\d+\s*)?minutes?\b', c['note'], re.I):
            err(f, f"connection note contains minute-based time: {c['note']!r}")
    sd = fm.get('schoolDistricts', [])
    if len(sd) < 1:
        err(f, "schoolDistricts must have at least 1 entry")
    for s in sd:
        if 'name' not in s or 'officialUrl' not in s:
            err(f, f"schoolDistrict missing name/officialUrl: {s}")
    ttu = fm.get('thingsToUnderstand', [])
    if len(ttu) < 3:
        err(f, f"thingsToUnderstand has {len(ttu)}, need >= 3")
    check_sources(f, fm.get('sources', []))
    check_updated(f, fm)
    check_status(f, fm)
    wc = len(body.split())
    if not (100 <= wc <= 175):
        err(f, f"overview body word count {wc} outside 100-175")

if errors:
    print(f"SCHEMA VALIDATION: {len(errors)} problem(s)\n")
    for e in errors:
        print(" -", e)
    sys.exit(1)
else:
    guides = len(glob.glob('src/content/guides/*.md'))
    areas = len(glob.glob('src/content/areas/*.md'))
    print(f"SCHEMA VALIDATION: clean ({guides} guides, {areas} areas, all required fields/enums/ranges pass)")
