// Catch-all router for every /api/admin/* endpoint.
//
// Why one function instead of a file per endpoint: Vercel's Hobby plan caps a
// deployment at 12 Serverless Functions. The individual handlers live under
// api/_lib/handlers/ (the leading underscore makes Vercel skip them for
// function detection), and this router — plus the /api/forms one and the
// existing /api/smart-move — is the entire function budget. Adding endpoints
// in later phases is just another handler module + a case here, never a new
// function. Behavior per route is unchanged from the previous file layout.

import loginHandler from '../_lib/handlers/login.js';
import logoutHandler from '../_lib/handlers/logout.js';
import sessionHandler from '../_lib/handlers/session.js';
import verify2faHandler from '../_lib/handlers/verify-2fa.js';
import verificationsListHandler from '../_lib/handlers/verifications-list.js';
import verificationDetailHandler from '../_lib/handlers/verification-detail.js';
import clientLinkHandler from '../_lib/handlers/client-link.js';
import pmLinkHandler from '../_lib/handlers/pm-link.js';
import clientEmailHandler from '../_lib/handlers/client-email.js';
import pmEmailHandler from '../_lib/handlers/pm-email.js';
import evidenceHandler from '../_lib/handlers/evidence.js';
import verifyHandler from '../_lib/handlers/verify.js';
import prepareInvoiceHandler from '../_lib/handlers/prepare-invoice.js';
import invoicesListHandler from '../_lib/handlers/invoices-list.js';
import invoiceDetailHandler from '../_lib/handlers/invoice-detail.js';
import invoiceApproveHandler from '../_lib/handlers/invoice-approve.js';
import invoiceSendHandler from '../_lib/handlers/invoice-send.js';
import invoicePaidHandler from '../_lib/handlers/invoice-paid.js';
import invoiceExportHandler from '../_lib/handlers/invoice-export.js';
import invoicePdfHandler from '../_lib/handlers/invoice-pdf.js';
import invoiceArchiveHandler from '../_lib/handlers/invoice-archive.js';
import invoiceDeleteHandler from '../_lib/handlers/invoice-delete.js';
import listingsListHandler from '../_lib/handlers/listings-list.js';
import listingDetailHandler from '../_lib/handlers/listing-detail.js';
import listingClientLinkHandler from '../_lib/handlers/listing-client-link.js';
import listingClientEmailHandler from '../_lib/handlers/listing-client-email.js';
import listingApproveHandler from '../_lib/handlers/listing-approve.js';
import listingReminderHandler from '../_lib/handlers/listing-reminder.js';
import cdasListHandler from '../_lib/handlers/cdas-list.js';
import cdaDetailHandler from '../_lib/handlers/cda-detail.js';
import cdaClientLinkHandler from '../_lib/handlers/cda-client-link.js';
import cdaClientEmailHandler from '../_lib/handlers/cda-client-email.js';
import cdaApproveHandler from '../_lib/handlers/cda-approve.js';
import cdaReminderHandler from '../_lib/handlers/cda-reminder.js';
import inventoryListHandler from '../_lib/handlers/inventory-list.js';
import inventoryDetailHandler from '../_lib/handlers/inventory-detail.js';

function notFound(res) {
  return res.status(404).json({ success: false, error: 'Unknown admin route' });
}

// Parsed directly from req.url rather than trusting Vercel to populate
// req.query from the [...route] filename — on this project's zero-config
// (frameworkless) setup that dynamic-segment population did not happen the
// way Vercel's docs describe for nested catch-all functions, which silently
// 404'd every /api/admin/* request in production. req.url is the one thing
// guaranteed to be the actual incoming request path, so both the route
// segments and the plain querystring are derived from it directly —
// handlers get req.query populated the same way either way.
function parseRequest(req) {
  const [pathname, qs = ''] = (req.url || '').split('?');
  const query = { ...(req.query || {}) };
  for (const [k, v] of new URLSearchParams(qs)) query[k] = v;

  // Vercel's explicit /api/admin/:path* rewrite passes the splat as `path`
  // (or, in some route modes, `route`). Prefer that when present so nested
  // admin API URLs still resolve even if the platform did not invoke the
  // original catch-all path directly.
  const rewrittenPath = query.path || query.route;
  if (rewrittenPath) {
    const raw = Array.isArray(rewrittenPath) ? rewrittenPath.join('/') : String(rewrittenPath);
    return { seg: raw.split('/').filter(Boolean), query };
  }

  const prefix = '/api/admin/';
  const seg = pathname.startsWith(prefix) ? pathname.slice(prefix.length).split('/').filter(Boolean) : [];
  return { seg, query };
}

export default async function handler(req, res) {
  const { seg, query } = parseRequest(req);
  req.query = query;
  const [a, b, c] = seg;

  // Flat endpoints
  if (seg.length === 1) {
    if (a === 'login') return loginHandler(req, res);
    if (a === 'logout') return logoutHandler(req, res);
    if (a === 'session') return sessionHandler(req, res);
    if (a === 'verify-2fa') return verify2faHandler(req, res);
    if (a === 'verifications') return verificationsListHandler(req, res);
    if (a === 'listings') return listingsListHandler(req, res);
    if (a === 'cdas') return cdasListHandler(req, res);
    if (a === 'inventory') return inventoryListHandler(req, res);
    if (a === 'invoices') return invoicesListHandler(req, res);
    return notFound(res);
  }

  // verifications/:id[/action]
  if (a === 'verifications' && b) {
    req.query.id = b;
    if (seg.length === 2) return verificationDetailHandler(req, res);
    if (c === 'client-link') return clientLinkHandler(req, res);
    if (c === 'pm-link') return pmLinkHandler(req, res);
    if (c === 'client-email') return clientEmailHandler(req, res);
    if (c === 'pm-email') return pmEmailHandler(req, res);
    if (c === 'evidence') return evidenceHandler(req, res);
    if (c === 'verify') return verifyHandler(req, res);
    if (c === 'prepare-invoice') return prepareInvoiceHandler(req, res);
    return notFound(res);
  }

  // listings/:id[/action]
  if (a === 'listings' && b) {
    req.query.id = b;
    if (seg.length === 2) return listingDetailHandler(req, res);
    if (c === 'client-link') return listingClientLinkHandler(req, res);
    if (c === 'client-email') return listingClientEmailHandler(req, res);
    if (c === 'approve') return listingApproveHandler(req, res);
    if (c === 'reminder') return listingReminderHandler(req, res);
    return notFound(res);
  }

  // cdas/:id[/action]
  if (a === 'cdas' && b) {
    req.query.id = b;
    if (seg.length === 2) return cdaDetailHandler(req, res);
    if (c === 'client-link') return cdaClientLinkHandler(req, res);
    if (c === 'client-email') return cdaClientEmailHandler(req, res);
    if (c === 'approve') return cdaApproveHandler(req, res);
    if (c === 'reminder') return cdaReminderHandler(req, res);
    return notFound(res);
  }

  // inventory/:id
  if (a === 'inventory' && b) {
    req.query.id = b;
    if (seg.length === 2) return inventoryDetailHandler(req, res);
    return notFound(res);
  }

  // invoices/:id[/action]
  if (a === 'invoices' && b) {
    req.query.id = b;
    if (seg.length === 2) return invoiceDetailHandler(req, res);
    if (c === 'approve') return invoiceApproveHandler(req, res);
    if (c === 'send') return invoiceSendHandler(req, res);
    if (c === 'paid') return invoicePaidHandler(req, res);
    if (c === 'export') return invoiceExportHandler(req, res);
    if (c === 'pdf') return invoicePdfHandler(req, res);
    if (c === 'archive') return invoiceArchiveHandler(req, res);
    if (c === 'delete') return invoiceDeleteHandler(req, res);
    return notFound(res);
  }

  return notFound(res);
}
