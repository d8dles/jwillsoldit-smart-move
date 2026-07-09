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
import verifyHandler from '../_lib/handlers/verify.js';
import prepareInvoiceHandler from '../_lib/handlers/prepare-invoice.js';
import invoiceDetailHandler from '../_lib/handlers/invoice-detail.js';
import invoiceApproveHandler from '../_lib/handlers/invoice-approve.js';
import invoiceSendHandler from '../_lib/handlers/invoice-send.js';
import invoicePaidHandler from '../_lib/handlers/invoice-paid.js';
import invoiceExportHandler from '../_lib/handlers/invoice-export.js';

function notFound(res) {
  return res.status(404).json({ success: false, error: 'Unknown admin route' });
}

export default async function handler(req, res) {
  // Vercel supplies the segments after /api/admin/ as req.query.route (array).
  const raw = req.query.route;
  const seg = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const [a, b, c] = seg;

  // Flat endpoints
  if (seg.length === 1) {
    if (a === 'login') return loginHandler(req, res);
    if (a === 'logout') return logoutHandler(req, res);
    if (a === 'session') return sessionHandler(req, res);
    if (a === 'verify-2fa') return verify2faHandler(req, res);
    if (a === 'verifications') return verificationsListHandler(req, res);
    return notFound(res);
  }

  // verifications/:id[/action]
  if (a === 'verifications' && b) {
    req.query.id = b;
    if (seg.length === 2) return verificationDetailHandler(req, res);
    if (c === 'client-link') return clientLinkHandler(req, res);
    if (c === 'pm-link') return pmLinkHandler(req, res);
    if (c === 'verify') return verifyHandler(req, res);
    if (c === 'prepare-invoice') return prepareInvoiceHandler(req, res);
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
    return notFound(res);
  }

  return notFound(res);
}
