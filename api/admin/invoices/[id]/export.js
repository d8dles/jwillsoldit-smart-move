import { applyCors, handlePreflight } from '../../../_lib/http.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { readDB } from '../../../_lib/store.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;
  const db = await readDB();
  const invoice = db.invoices[id];
  if (!invoice) return res.status(404).json({ success: false, error: 'Not found' });

  res.setHeader('Content-Disposition', `attachment; filename="${invoice.fields.invoiceNumber || invoice.id}.json"`);
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).send(JSON.stringify({ ...invoice.fields, status: invoice.status, invoiceId: invoice.id }, null, 2));
}
