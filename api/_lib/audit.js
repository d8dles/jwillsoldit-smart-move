import { newId } from './ids.js';

// The eight required event types. `role` disambiguates client vs pm for
// sent/viewed/submitted; `actor` is 'admin' | 'client' | 'pm' | 'system'.
export const AUDIT_EVENTS = Object.freeze({
  CREATED: 'created',
  SENT: 'sent',
  VIEWED: 'viewed',
  SUBMITTED: 'submitted',
  MANUALLY_VERIFIED: 'manually_verified',
  INVOICE_GENERATED: 'invoice_generated',
  INVOICE_SENT: 'invoice_sent',
  PAID: 'paid',
  APPROVED: 'approved',
  REMINDER: 'reminder',
});

export function logEvent(verification, type, { actor = 'admin', role = null, detail = '' } = {}) {
  if (!Array.isArray(verification.auditLog)) verification.auditLog = [];
  const entry = {
    id: newId('evt'),
    type,
    actor,
    role,
    detail,
    at: new Date().toISOString(),
  };
  verification.auditLog.push(entry);
  return entry;
}
