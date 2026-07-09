import { newId } from './ids.js';

export function newVerification(fields = {}) {
  const now = new Date().toISOString();
  return {
    id: newId('ver'),
    createdAt: now,
    updatedAt: now,
    clientName: fields.clientName || '',
    propertyName: fields.propertyName || '',
    propertyAddress: fields.propertyAddress || '',
    unitNumber: fields.unitNumber || '',
    notes: fields.notes || '',
    clientLink: null,
    pmLink: null,
    clientSubmission: null,
    clientSubmittedAt: null,
    pmSubmission: null,
    pmSubmittedAt: null,
    manuallyVerified: false,
    manuallyVerifiedAt: null,
    manuallyVerifiedBy: null,
    invoiceId: null,
    auditLog: [],
  };
}

export function deriveStatus(v) {
  if (v.invoiceId) return 'invoiced';
  if (v.manuallyVerified) return 'verified';
  if (v.clientSubmission && v.pmSubmission) return 'both_submitted';
  if (v.clientSubmission) return 'client_submitted';
  if (v.pmSubmission) return 'pm_submitted';
  return 'new';
}

export const STATUS_LABELS = {
  new: 'New',
  client_submitted: 'Client Submitted',
  pm_submitted: 'PM Submitted',
  both_submitted: 'Both Submitted',
  verified: 'Manually Verified',
  invoiced: 'Invoice Prepared',
};

// Strips fields the public forms / list views should never see (token
// hashes, internal notes) — used when returning verification summaries.
export function toListSummary(v) {
  return {
    id: v.id,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    clientName: v.clientName,
    propertyName: v.propertyName,
    unitNumber: v.unitNumber,
    status: deriveStatus(v),
    hasClientLink: !!v.clientLink,
    hasPmLink: !!v.pmLink,
    manuallyVerified: v.manuallyVerified,
    invoiceId: v.invoiceId,
  };
}
