import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { readDB, withDB } from '../store.js';
import {
  ensureInventory,
  newInventory,
  toInventorySummary,
  validateInventoryPatch,
} from '../inventory.js';

function isTrue(value) {
  return String(value || '').toLowerCase() === 'true';
}

function publicPath(value) {
  const path = String(value || '').trim();
  return path.startsWith('/') && !path.startsWith('//') ? path : '';
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  if (req.method === 'GET') {
    const db = await readDB();
    const includeArchived = isTrue(req.query?.includeArchived);
    const records = Object.values(ensureInventory(db))
      .filter((record) => includeArchived || !record.archivedAt)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(toInventorySummary);
    return res.status(200).json({ success: true, inventory: records });
  }

  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const body = parseJsonBody(req);
  if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

  const slug = String(body.slug || '').trim();
  const path = publicPath(body.publicPath);
  if (!slug || !path) {
    return res.status(400).json({ success: false, error: 'slug and publicPath are required' });
  }

  const validation = validateInventoryPatch(body);
  if (!validation.ok) return res.status(400).json({ success: false, error: validation.error });
  if (body.published === true && (!body.publicStatus || body.publicStatus === 'draft')) {
    return res.status(400).json({ success: false, error: 'published inventory must have a non-draft publicStatus' });
  }

  const result = await withDB((db) => {
    const inventory = ensureInventory(db);
    const duplicate = Object.values(inventory).find((record) => record.slug === slug && !record.archivedAt);
    if (duplicate) return { error: 'duplicate' };

    const record = newInventory({ ...body, slug, publicPath: path });
    inventory[record.id] = record;
    return { record };
  });

  if (result.error === 'duplicate') {
    return res.status(409).json({ success: false, error: 'An active inventory record already uses that slug' });
  }
  return res.status(201).json({ success: true, inventory: toInventorySummary(result.record) });
}
