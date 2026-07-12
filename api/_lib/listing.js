// listing.js — the Listing Intake document type (sale + lease branches).
// Mirrors verification.js: a plain record stored in the single JSON doc
// (db.listings), created by the admin, filled by the client through a
// tokenized public form, reviewed/approved in the admin UI.

import { newId } from './ids.js';

export const LISTING_TYPES = ['sale', 'lease'];

// The live Supabase document predates this module, so db.listings may be
// missing. Every handler that touches listings goes through this first.
export function ensureListings(db) {
  if (!db.listings || typeof db.listings !== 'object') db.listings = {};
  return db.listings;
}

export function newListing(fields = {}) {
  const now = new Date().toISOString();
  return {
    id: newId('lst'),
    createdAt: now,
    updatedAt: now,
    listingType: fields.listingType === 'lease' ? 'lease' : 'sale',
    clientName: fields.clientName || '',
    clientEmail: fields.clientEmail || '',
    propertyAddress: fields.propertyAddress || '',
    unitNumber: fields.unitNumber || '',
    targetGoLiveDate: fields.targetGoLiveDate || '',
    notes: fields.notes || '',
    clientLink: null,
    clientSubmission: null,
    clientSubmittedAt: null,
    // itemKey -> { receivedAt, via } for checklist items Joey marks received
    // outside the form (docs handed over in person, keys dropped off, ...).
    itemsReceived: {},
    approved: false,
    approvedAt: null,
    liveAt: null,
    auditLog: [],
  };
}

export function deriveListingStatus(l) {
  if (l.liveAt) return 'live';
  if (l.approved) return 'approved';
  if (l.clientSubmission) return 'client_submitted';
  if (l.clientLink) return 'sent';
  return 'new';
}

export const LISTING_STATUS_LABELS = {
  new: 'New',
  sent: 'Link Sent',
  client_submitted: 'Client Submitted',
  approved: 'Approved',
  live: 'Live',
};

// Strips token hashes / internal data for list views (see toListSummary in
// verification.js).
export function toListingSummary(l) {
  return {
    id: l.id,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    listingType: l.listingType,
    clientName: l.clientName,
    propertyAddress: l.propertyAddress,
    unitNumber: l.unitNumber,
    targetGoLiveDate: l.targetGoLiveDate,
    status: deriveListingStatus(l),
    hasClientLink: !!l.clientLink,
    approved: !!l.approved,
    outstandingCount: computeOutstandingItems(l).length,
  };
}

// ---------------------------------------------------------------------------
// Checklist engine
//
// Each item: key, label, and an optional `when(facts)` gate. `doc: true`
// items accept an upload slot on the public form. Facts are merged from the
// client submission over the admin-entered record so conditions work both
// before and after the client fills the form.

const SHARED_ITEMS = [
  { key: 'listing_agreement', label: 'Signed listing agreement', doc: true },
  { key: 'lead_paint_disclosure', label: 'Lead-based paint disclosure (built before 1978)', doc: true, when: (f) => f.pre1978 },
  { key: 'utility_info', label: 'Utility providers & account info', doc: false },
  { key: 'keys_access', label: 'Keys, openers, remotes & gate/amenity codes', doc: false },
];

const SALE_ITEMS = [
  ...SHARED_ITEMS,
  { key: 'sellers_disclosure', label: "Seller's Disclosure Notice", doc: true },
  { key: 'survey_t47', label: 'Existing survey + T-47 affidavit', doc: true },
  { key: 'hoa_docs', label: 'HOA documents & transfer info', doc: true, when: (f) => f.hasHoa },
  { key: 'mortgage_payoff_contact', label: 'Mortgage lender / payoff contact', doc: false },
];

const LEASE_ITEMS = [
  ...SHARED_ITEMS,
  { key: 'hoa_lease_approval', label: 'HOA lease approval / restrictions', doc: true, when: (f) => f.hasHoa },
  { key: 'make_ready_status', label: 'Make-ready / cleaning confirmation', doc: false },
];

export const REQUIRED_ITEMS = { sale: SALE_ITEMS, lease: LEASE_ITEMS };

function listingFacts(l) {
  const s = l.clientSubmission || {};
  const yearBuilt = parseInt(s.yearBuilt || l.yearBuilt || '', 10);
  return {
    pre1978: Number.isFinite(yearBuilt) && yearBuilt < 1978,
    hasHoa: String(s.hasHoa || '').toLowerCase() === 'yes',
  };
}

export function applicableItems(l) {
  const facts = listingFacts(l);
  const items = REQUIRED_ITEMS[l.listingType] || REQUIRED_ITEMS.sale;
  return items.filter((item) => !item.when || item.when(facts));
}

function itemSatisfied(l, item) {
  if (l.itemsReceived && l.itemsReceived[item.key]) return true;
  const uploads = l.clientSubmission?.uploads;
  if (uploads && uploads[item.key]) return true;
  return false;
}

// The "still needed from you" list — drives the admin checklist view, the
// client confirmation email, and the reminder email.
export function computeOutstandingItems(l) {
  return applicableItems(l)
    .filter((item) => !itemSatisfied(l, item))
    .map((item) => ({ key: item.key, label: item.label, doc: !!item.doc }));
}

// Lead-prioritization flags in the spirit of the funnel's smart flags.
export function computeListingFlags(l) {
  const s = l.clientSubmission || {};
  const facts = listingFacts(l);
  const flags = [];

  const goLive = l.targetGoLiveDate || s.targetGoLiveDate || '';
  if (goLive) {
    const days = (new Date(goLive).getTime() - Date.now()) / 86400000;
    if (Number.isFinite(days) && days <= 14) flags.push('urgent');
  }
  const occupancy = String(s.occupancy || '').toLowerCase();
  if (occupancy === 'tenant') flags.push('tenant-occupied');
  if (occupancy === 'vacant') flags.push('vacant-ready');
  if (String(s.condition || '') === 'as-is') flags.push('as-is');
  if (facts.pre1978) flags.push('pre-1978');
  if (facts.hasHoa) flags.push('hoa-restricted');

  return flags;
}

// ---------------------------------------------------------------------------
// Public-form field whitelists (submit-listing copies values through these,
// mirroring the FIELDS list in submit-client.js).

export const SHARED_FIELDS = [
  'clientLegalName', 'email', 'phone',
  'propertyAddress', 'unitNumber', 'propertyType',
  'bedrooms', 'bathrooms', 'sqft', 'yearBuilt',
  'occupancy', 'accessNotes',
  'hasHoa', 'hoaName', 'hoaDues', 'hoaRestrictions',
  'targetGoLiveDate', 'notes',
];

export const SALE_FIELDS = [
  'mortgageStatus', 'payoffEstimate', 'priceExpectation',
  'condition', 'motivation', 'updatesRepairs', 'knownIssues',
];

export const LEASE_FIELDS = [
  'askingRent', 'securityDeposit', 'availableDate', 'leaseTerms',
  'petsAllowed', 'petPolicy', 'smokingPolicy',
  'utilitiesIncluded', 'appliancesIncluded',
  'screeningCriteria', 'makeReadyStatus',
];

export function submissionFieldsFor(listingType) {
  return SHARED_FIELDS.concat(listingType === 'lease' ? LEASE_FIELDS : SALE_FIELDS);
}
