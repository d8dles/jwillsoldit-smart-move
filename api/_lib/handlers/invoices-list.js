import { applyCors, handlePreflight } from '../http.js';
import { requireAdmin } from '../auth.js';
import { readDB } from '../store.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const showArchived = req.query.archived === '1' || req.query.archived === 'true';

  const db = await readDB();
  const list = Object.values(db.invoices)
    .filter((inv) => (showArchived ? true : !inv.archived))
    .map((inv) => {
      const verification = db.verifications[inv.verificationId];
      return {
        id: inv.id,
        invoiceNumber: inv.fields.invoiceNumber || inv.id,
        client: inv.fields.client || verification?.clientName || '',
        community: inv.fields.communityName || verification?.propertyName || '',
        balanceDue: inv.fields.balanceDue,
        status: inv.status,
        archived: !!inv.archived,
        createdAt: inv.createdAt,
        sentAt: inv.sentAt,
        paidAt: inv.paidAt,
        verificationId: inv.verificationId,
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.status(200).json({ success: true, invoices: list });
}
