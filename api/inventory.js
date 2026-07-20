import { applyCors, handlePreflight } from './_lib/http.js';
import { readDB } from './_lib/store.js';
import { ensureInventory, isPublicInventory, toPublicInventory } from './_lib/inventory.js';

function queryValue(value) {
  if (Array.isArray(value)) return String(value[0] || '');
  return String(value || '').trim();
}

export function filterPublicInventory(db, query = {}) {
  const slug = queryValue(query.slug);
  const offeringType = queryValue(query.offeringType);
  const publicStatus = queryValue(query.publicStatus);

  return Object.values(ensureInventory(db))
    .filter(isPublicInventory)
    .filter((record) => !slug || record.slug === slug)
    .filter((record) => !offeringType || record.offeringType === offeringType)
    .filter((record) => !publicStatus || record.publicStatus === publicStatus)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(toPublicInventory);
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const db = await readDB();
  const records = filterPublicInventory(db, req.query || {});
  if (queryValue(req.query?.slug) && records.length === 0) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  return res.status(200).json({ success: true, inventory: records });
}
