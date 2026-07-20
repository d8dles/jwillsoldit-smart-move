// inventory.js — the public inventory record.
//
// This is intentionally separate from listing.js. A listing record is a
// private intake file; an inventory record is the public offer and its
// publication lifecycle.

import { newId } from './ids.js';

export const INVENTORY_TYPES = Object.freeze(['sale', 'rental', 'stay']);
export const RENTAL_MODES = Object.freeze(['long_term', 'mid_term', 'short_term']);
export const PUBLIC_STATUSES = Object.freeze([
  'draft',
  'coming_soon',
  'available',
  'pending',
  'rented',
  'booked',
  'sold',
  'off_market',
]);

const STATUS_BY_TYPE = Object.freeze({
  sale: new Set(['draft', 'coming_soon', 'available', 'pending', 'sold', 'off_market']),
  rental: new Set(['draft', 'coming_soon', 'available', 'pending', 'rented', 'off_market']),
  stay: new Set(['draft', 'coming_soon', 'available', 'pending', 'booked', 'off_market']),
});

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const INVENTORY_EDITABLE_FIELDS = Object.freeze([
  'listingFileId', 'slug', 'publicPath', 'offeringType', 'rentalMode',
  'publicStatus', 'published', 'title', 'addressLine', 'city', 'state',
  'zip', 'neighborhood', 'price', 'priceLabel', 'pricePeriod', 'bedrooms',
  'bathrooms', 'squareFeet', 'description', 'features', 'heroImageUrl',
  'galleryUrls', 'sourceLinks', 'stayDetails', 'internalNotes',
]);

export function ensureInventory(db) {
  if (!db.inventory || typeof db.inventory !== 'object') db.inventory = {};
  return db.inventory;
}

function valueOrEmpty(value) {
  return value == null ? '' : String(value);
}

function stringArray(value) {
  return Array.isArray(value) ? value.map(valueOrEmpty).filter(Boolean) : [];
}

function linkArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((link) => link && typeof link === 'object')
    .map((link) => ({ label: valueOrEmpty(link.label), url: valueOrEmpty(link.url) }))
    .filter((link) => link.label && link.url);
}

export function newInventory(fields = {}) {
  const now = new Date().toISOString();
  const offeringType = INVENTORY_TYPES.includes(fields.offeringType) ? fields.offeringType : 'rental';
  const rentalMode = offeringType === 'sale'
    ? null
    : (RENTAL_MODES.includes(fields.rentalMode) ? fields.rentalMode : 'long_term');

  return {
    id: newId('inv'),
    createdAt: now,
    updatedAt: now,
    listingFileId: fields.listingFileId || null,
    slug: valueOrEmpty(fields.slug),
    publicPath: valueOrEmpty(fields.publicPath),
    offeringType,
    rentalMode,
    publicStatus: PUBLIC_STATUSES.includes(fields.publicStatus) ? fields.publicStatus : 'draft',
    published: fields.published === true,
    archivedAt: null,
    archivedBy: null,
    title: valueOrEmpty(fields.title),
    addressLine: valueOrEmpty(fields.addressLine),
    city: valueOrEmpty(fields.city),
    state: valueOrEmpty(fields.state),
    zip: valueOrEmpty(fields.zip),
    neighborhood: valueOrEmpty(fields.neighborhood),
    price: Number.isFinite(fields.price) ? fields.price : null,
    priceLabel: valueOrEmpty(fields.priceLabel),
    pricePeriod: valueOrEmpty(fields.pricePeriod),
    bedrooms: Number.isFinite(fields.bedrooms) ? fields.bedrooms : null,
    bathrooms: Number.isFinite(fields.bathrooms) ? fields.bathrooms : null,
    squareFeet: Number.isFinite(fields.squareFeet) ? fields.squareFeet : null,
    description: valueOrEmpty(fields.description),
    features: stringArray(fields.features),
    heroImageUrl: valueOrEmpty(fields.heroImageUrl),
    galleryUrls: stringArray(fields.galleryUrls),
    sourceLinks: linkArray(fields.sourceLinks),
    stayDetails: fields.stayDetails && typeof fields.stayDetails === 'object'
      ? { ...fields.stayDetails }
      : null,
    internalNotes: valueOrEmpty(fields.internalNotes),
    auditLog: Array.isArray(fields.auditLog) ? fields.auditLog : [],
  };
}

function invalid(message) {
  return { ok: false, error: message };
}

export function validateInventoryPatch(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid('Request body must be an object');

  if (Object.prototype.hasOwnProperty.call(body, 'slug')) {
    const slug = String(body.slug || '').trim();
    if (!SLUG_PATTERN.test(slug)) return invalid('slug must contain lowercase letters, numbers, and single hyphens');
  }

  const offeringType = body.offeringType;
  if (offeringType !== undefined && !INVENTORY_TYPES.includes(offeringType)) {
    return invalid('offeringType must be "sale", "rental", or "stay"');
  }

  const effectiveType = offeringType || 'rental';
  if (body.rentalMode !== undefined) {
    if (effectiveType === 'sale' && body.rentalMode != null && body.rentalMode !== '') {
      return invalid('rentalMode is not valid for sale offerings');
    }
    if (effectiveType !== 'sale' && body.rentalMode != null && !RENTAL_MODES.includes(body.rentalMode)) {
      return invalid('rentalMode must be "long_term", "mid_term", or "short_term"');
    }
  }

  if (body.publicStatus !== undefined) {
    if (!PUBLIC_STATUSES.includes(body.publicStatus)) return invalid('publicStatus is invalid');
    if (!STATUS_BY_TYPE[effectiveType].has(body.publicStatus)) {
      const statusLabel = body.publicStatus;
      const typeLabel = body.publicStatus === 'booked'
        ? 'stay offerings'
        : body.publicStatus === 'rented'
          ? 'rental offerings'
          : body.publicStatus === 'sold'
            ? 'sale offerings'
            : effectiveType === 'stay' ? 'stay' : `${effectiveType} offerings`;
      return invalid(`${statusLabel} is only valid for ${typeLabel}`);
    }
  }

  if (body.published !== undefined && typeof body.published !== 'boolean') {
    return invalid('published must be a boolean');
  }

  return { ok: true };
}

export function isPublicInventory(record) {
  return !!record
    && record.published === true
    && !record.archivedAt
    && record.publicStatus !== 'draft';
}

export function applyInventoryPatch(record, body) {
  for (const key of INVENTORY_EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    if (key === 'features' || key === 'galleryUrls') {
      record[key] = stringArray(body[key]);
    } else if (key === 'sourceLinks') {
      record[key] = linkArray(body[key]);
    } else if (key === 'stayDetails') {
      record[key] = body[key] && typeof body[key] === 'object' ? { ...body[key] } : null;
    } else if (key === 'price' || key === 'bedrooms' || key === 'bathrooms' || key === 'squareFeet') {
      record[key] = Number.isFinite(body[key]) ? body[key] : null;
    } else if (key === 'published') {
      record[key] = body[key] === true;
    } else if (key === 'rentalMode' && body[key] == null) {
      record[key] = null;
    } else {
      record[key] = valueOrEmpty(body[key]);
    }
  }

  if (record.offeringType === 'sale') record.rentalMode = null;
  record.updatedAt = new Date().toISOString();
  return record;
}

export function toInventorySummary(record) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    slug: record.slug,
    publicPath: record.publicPath,
    offeringType: record.offeringType,
    rentalMode: record.rentalMode,
    publicStatus: record.publicStatus,
    published: !!record.published,
    archivedAt: record.archivedAt || null,
    archivedBy: record.archivedBy || null,
    title: record.title,
    addressLine: record.addressLine,
    city: record.city,
    state: record.state,
    zip: record.zip,
    priceLabel: record.priceLabel,
  };
}

export function toPublicInventory(record) {
  return {
    id: record.id,
    slug: record.slug,
    publicPath: record.publicPath,
    offeringType: record.offeringType,
    rentalMode: record.rentalMode,
    publicStatus: record.publicStatus,
    title: record.title,
    addressLine: record.addressLine,
    city: record.city,
    state: record.state,
    zip: record.zip,
    neighborhood: record.neighborhood,
    price: record.price,
    priceLabel: record.priceLabel,
    pricePeriod: record.pricePeriod,
    bedrooms: record.bedrooms,
    bathrooms: record.bathrooms,
    squareFeet: record.squareFeet,
    description: record.description,
    features: record.features,
    heroImageUrl: record.heroImageUrl,
    galleryUrls: record.galleryUrls,
    sourceLinks: record.sourceLinks,
    stayDetails: record.stayDetails,
    updatedAt: record.updatedAt,
  };
}

export function archiveInventory(record, actor = 'admin') {
  const now = new Date().toISOString();
  record.archivedAt = now;
  record.archivedBy = actor;
  record.published = false;
  record.updatedAt = now;
  return record;
}

export function restoreInventory(record, actor = 'admin') {
  const now = new Date().toISOString();
  record.archivedAt = null;
  record.archivedBy = null;
  record.publicStatus = 'draft';
  record.published = false;
  record.updatedAt = now;
  record.auditLog = Array.isArray(record.auditLog) ? record.auditLog : [];
  record.auditLog.push({ type: 'restored', actor, at: now });
  return record;
}
