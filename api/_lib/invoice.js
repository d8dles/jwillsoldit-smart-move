// invoice.js — builds the invoice-ready object from a verification's
// submissions, matching the CRG locator invoicing template fields exactly,
// plus the client/PM submission comparison used to highlight mismatches.

const AGENT_NAME = 'Joey Williams';
const TREC_NUMBER = '0702090';

function num(value) {
  if (value === '' || value == null) return NaN;
  return parseFloat(String(value).replace(/[^0-9.]/g, ''));
}

export function nextInvoiceNumber(db) {
  db.counters.invoice = (db.counters.invoice || 0) + 1;
  const year = new Date().getFullYear();
  return `INV-${year}-${String(db.counters.invoice).padStart(4, '0')}`;
}

// Builds a draft invoice-ready object. PM submission is treated as the
// authoritative source for community/commission facts (they're the ones
// paying and confirming terms); client submission fills gaps. Everything
// here is editable afterward by the admin before approval.
export function buildInvoiceDraft(verification, invoiceNumber) {
  const c = verification.clientSubmission || {};
  const p = verification.pmSubmission || {};

  const communityName = p.communityName || c.propertyName || '';
  const unit = p.unitNumber || c.unitNumber || '';
  const client = c.clientLegalName || p.clientName || '';
  const monthlyRent = p.monthlyRent || c.monthlyRent || '';
  const commissionBasis = p.commissionBasis || '';
  const commissionOffered = p.commissionOffered || '';

  let balanceDue = '';
  const rent = num(monthlyRent);
  const offered = num(commissionOffered);
  if (commissionBasis === 'percentage' && !isNaN(rent) && !isNaN(offered)) {
    balanceDue = (rent * (offered / 100)).toFixed(2);
  } else if (commissionBasis === 'flat' && !isNaN(offered)) {
    balanceDue = offered.toFixed(2);
  }

  return {
    attention: p.invoiceAttentionLine || p.pmContactName || c.pmContactName || '',
    communityName,
    managementCompany: p.managementCompany || '',
    communityAddress: p.communityAddress || c.propertyAddress || '',
    date: new Date().toISOString().slice(0, 10),
    invoiceNumber,
    agent: AGENT_NAME,
    trecNumber: TREC_NUMBER,
    client,
    commissionDescription:
      client && communityName
        ? `Locator/placement commission — ${client} at ${communityName}${unit ? `, Unit ${unit}` : ''}.`
        : '',
    leaseTerm: p.leaseTerm || c.leaseTerm || '',
    unitSuite: unit,
    applicationDate: p.applicationDate || c.applicationDate || '',
    moveInDate: p.moveInDate || c.moveInDate || '',
    offeredCommissionFeePct: commissionBasis === 'percentage' ? commissionOffered : '',
    monthlyRent,
    balanceDue,
    paymentInstructions:
      'Payment via ACH or check, payable to Christin Rachelle Group. ' +
      'Contact jwillsoldit@icloud.com to arrange ACH details or a mailing address for checks.',
    brokerW9Note: 'A completed IRS Form W-9 for the broker (Christin Rachelle Group) is available upon request.',
  };
}

export const INVOICE_FIELD_LABELS = {
  attention: 'Attention',
  communityName: 'Community Name',
  managementCompany: 'Property Management Company',
  communityAddress: 'Community Address',
  date: 'Date',
  invoiceNumber: 'Invoice Number',
  agent: 'Agent',
  trecNumber: 'TREC #',
  client: 'Client',
  commissionDescription: 'Commission Description',
  leaseTerm: 'Lease Term',
  unitSuite: 'Unit/Suite',
  applicationDate: 'Application Date',
  moveInDate: 'Move In Date',
  offeredCommissionFeePct: 'Offered Commission Fee %',
  monthlyRent: 'Monthly Rent',
  balanceDue: 'Balance Due',
  paymentInstructions: 'Payment Instructions',
  brokerW9Note: 'Broker W9 Note',
};

const COMPARE_FIELDS = [
  { key: 'clientName', label: 'Client Name', client: 'clientLegalName', pm: 'clientName' },
  { key: 'propertyName', label: 'Property / Community Name', client: 'propertyName', pm: 'communityName' },
  { key: 'propertyAddress', label: 'Property / Community Address', client: 'propertyAddress', pm: 'communityAddress' },
  { key: 'unitNumber', label: 'Unit Number', client: 'unitNumber', pm: 'unitNumber' },
  { key: 'pmContactName', label: 'PM / Leasing Contact', client: 'pmContactName', pm: 'pmContactName' },
  { key: 'pmEmail', label: 'PM Email', client: 'pmEmail', pm: 'pmEmail' },
  { key: 'applicationDate', label: 'Application Date', client: 'applicationDate', pm: 'applicationDate' },
  { key: 'moveInDate', label: 'Move-In Date', client: 'moveInDate', pm: 'moveInDate' },
  { key: 'leaseStartDate', label: 'Lease Start Date', client: 'leaseStartDate', pm: 'leaseStartDate' },
  { key: 'leaseTerm', label: 'Lease Term', client: 'leaseTerm', pm: 'leaseTerm' },
  { key: 'monthlyRent', label: 'Monthly Rent', client: 'monthlyRent', pm: 'monthlyRent' },
];

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function compareSubmissions(clientSubmission, pmSubmission) {
  if (!clientSubmission || !pmSubmission) return [];
  return COMPARE_FIELDS.map((f) => {
    const clientValue = clientSubmission[f.client] ?? '';
    const pmValue = pmSubmission[f.pm] ?? '';
    const bothPresent = String(clientValue).trim() !== '' && String(pmValue).trim() !== '';
    const mismatch = bothPresent && normalize(clientValue) !== normalize(pmValue);
    return { key: f.key, label: f.label, clientValue, pmValue, mismatch };
  });
}
