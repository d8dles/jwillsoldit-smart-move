import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { readDB, withDB } from '../store.js';
import {
  applyInventoryPatch,
  ensureInventory,
  archiveInventory,
  restoreInventory,
  validateInventoryPatch,
} from '../inventory.js';

function privateView(record) {
  return { ...record };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  const { id } = req.query;
  if (req.method === 'GET') {
    const db = await readDB();
    const record = ensureInventory(db)[id];
    if (!record) return res.status(404).json({ success: false, error: 'Not found' });
    return res.status(200).json({ success: true, inventory: privateView(record) });
  }

  if (req.method !== 'PATCH') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const body = parseJsonBody(req);
  if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

  const result = await withDB((db) => {
    const record = ensureInventory(db)[id];
    if (!record) return { error: 'not_found' };

    if (body.archived === true) {
      archiveInventory(record, 'admin');
      return { record };
    }
    if (body.archived === false) {
      restoreInventory(record, 'admin');
      return { record };
    }

    const merged = { ...record, ...body };
    const validation = validateInventoryPatch(merged);
    if (!validation.ok) return { error: 'invalid', detail: validation.error };
    if (record.archivedAt && body.published === true) {
      return { error: 'archived' };
    }
    if (body.published === true && (merged.publicStatus === 'draft' || !merged.publicStatus)) {
      return { error: 'draft_publish' };
    }

    applyInventoryPatch(record, body);
    return { record };
  });

  if (result.error === 'not_found') return res.status(404).json({ success: false, error: 'Not found' });
  if (result.error === 'invalid') return res.status(400).json({ success: false, error: result.detail });
  if (result.error === 'archived') {
    return res.status(409).json({ success: false, error: 'Restore the property before publishing it' });
  }
  if (result.error === 'draft_publish') {
    return res.status(400).json({ success: false, error: 'published inventory must have a non-draft publicStatus' });
  }
  return res.status(200).json({ success: true, inventory: privateView(result.record) });
}
