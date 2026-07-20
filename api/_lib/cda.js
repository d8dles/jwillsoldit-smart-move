// cda.js — the Commission Disbursement Authorization document type.
// Mirrors listing.js: a plain record stored in the single JSON doc
// (db.cdas), created by the admin (usually prefilled from an invoice),
// sent to the payee via a tokenized public form to confirm payment
// details and acknowledge the split, then approved and marked disbursed.

import { newId } from './ids.js';
import { AGENT_NAME, TREC_NUMBER } from './invoice.js';

// The live Supabase document predates this module, same situation as
// db.listings. Every handler that touches CDAs goes through this first.
export function ensureCdas(db) {
  if (!db.cdas || typeof db.cdas !== 'object') db.cdas = {};
  return db.cdas;
}

export function newCda(fields = {}) {
  const now = new Date().toISOString();
  return {
    id: newId('cda'),
    createdAt: now,
    updatedAt: now,
    sourceType: fields.sourceType === 'invoice' ? 'invoice' : null,
    sourceInvoiceId: fields.sourceInvoiceId || null,
    clientName: fields.clientName || '',
    propertyAddress: fields.propertyAddress || '',
    unitNumber: fields.unitNumber || '',
    community: fields.community || '',
    closingDate: fields.closingDate || '',
    transactionValue: fields.transactionValue || '',
    totalCommission: fields.totalCommission || '',
    commissionBasis: fields.commissionBasis === 'flat' ? 'flat' : 'percentage',
    payeeName: fields.payeeName || '',
    payeeCompany: fields.payeeCompany || '',
    payeeEmail: fields.payeeEmail || '',
    payeeAmount: fields.payeeAmount || '',
    notes: fields.notes || '',
    clientLink: null,
    clientSubmission: null,
    clientSubmittedAt: null,
    // itemKey -> { receivedAt, via } for checklist items Joey marks received
    // outside the form (signed pages handed over in person, faxed, ...).
    itemsReceived: {},
    approved: false,
    approvedAt: null,
    disbursedAt: null,
    auditLog: [],
  };
}

export function deriveCdaStatus(c) {
  if (c.disbursedAt) return 'disbursed';
  if (c.approved) return 'approved';
  if (c.clientSubmission) return 'client_submitted';
  if (c.clientLink) return 'sent';
  return 'new';
}

export const CDA_STATUS_LABELS = {
  new: 'New',
  sent: 'Link Sent',
  client_submitted: 'Payee Submitted',
  approved: 'Approved',
  disbursed: 'Disbursed',
};

// Strips token hashes / internal data for list views (see toListingSummary
// in listing.js).
export function toCdaSummary(c) {
  return {
    id: c.id,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    clientName: c.clientName,
    propertyAddress: c.propertyAddress,
    payeeName: c.payeeName,
    payeeAmount: c.payeeAmount,
    status: deriveCdaStatus(c),
    hasClientLink: !!c.clientLink,
    approved: !!c.approved,
    outstandingCount: computeOutstandingItems(c).length,
  };
}

// ---------------------------------------------------------------------------
// Checklist engine — a single flat list (no sale/lease branches like
// listing.js; every CDA needs the same two items from the payee).

export const REQUIRED_ITEMS = [
  { key: 'signed_cda', label: 'Signed Commission Disbursement Authorization', doc: true },
  { key: 'w9', label: 'Completed IRS Form W-9', doc: true },
];

function itemSatisfied(c, item) {
  if (c.itemsReceived && c.itemsReceived[item.key]) return true;
  const uploads = c.clientSubmission?.uploads;
  if (uploads && uploads[item.key]) return true;
  return false;
}

// The "still needed from you" list — drives the admin checklist view, the
// payee confirmation email, and the reminder email.
export function computeOutstandingItems(c) {
  return REQUIRED_ITEMS
    .filter((item) => !itemSatisfied(c, item))
    .map((item) => ({ key: item.key, label: item.label, doc: !!item.doc }));
}

// ---------------------------------------------------------------------------
// Prefill from an existing invoice. Mirrors buildInvoiceDraft's shape in
// invoice.js — the invoice is the authoritative source for community/
// client/commission facts; everything is editable afterward by the admin.
export function buildCdaDraft(invoice) {
  return {
    sourceType: 'invoice',
    sourceInvoiceId: invoice.id,
    clientName: invoice.fields?.client || '',
    propertyAddress: invoice.fields?.communityAddress || '',
    unitNumber: invoice.fields?.unitSuite || '',
    community: invoice.fields?.communityName || '',
    transactionValue: invoice.fields?.monthlyRent || '',
    totalCommission: invoice.fields?.balanceDue || '',
    commissionBasis: 'flat',
    payeeName: AGENT_NAME,
    payeeCompany: 'Christin Rachelle Group',
    payeeAmount: invoice.fields?.balanceDue || '',
    notes: `Prefilled from ${invoice.fields?.invoiceNumber || invoice.id}.`,
  };
}

// ---------------------------------------------------------------------------
// Public-form field whitelist (submit-cda copies values through this,
// mirroring SHARED_FIELDS in listing.js).
//
// Deliberately does NOT collect bank routing/account numbers here, matching
// the existing invoice paymentInstructions convention (invoice.js) of
// directing payees to contact Joey directly to arrange ACH details rather
// than typing them into a web form. This module already stores everything
// in one unencrypted JSON document (store.js) with base64 uploads sitting
// next to it -- adding raw bank details to that same blob is a real
// severity step up from what's here today (name/address/W-9 image) and
// isn't something to introduce as a side effect of an unrelated feature
// build. If Joey wants ACH numbers collected digitally later, that's a
// deliberate call worth its own security review, not a default.
// Same reasoning applies to the W-9's taxpayer ID: it's captured via the
// w9 document upload (already on the form as a checklist item), not
// re-typed into a plaintext field here -- one copy of a sensitive number,
// not two.
export const SUBMISSION_FIELDS = [
  'payeeLegalName', 'payeeCompany', 'trecLicense', 'email', 'phone',
  'mailingAddress', 'paymentMethod',
];
