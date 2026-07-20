import assert from 'node:assert/strict';
import {
  newInventory,
  isPublicInventory,
  toPublicInventory,
  archiveInventory,
  restoreInventory,
  validateInventoryPatch,
} from '../api/_lib/inventory.js';
import { filterPublicInventory } from '../api/inventory.js';

const rental = newInventory({
  slug: '4231-tulip-oak-dr',
  offeringType: 'rental',
  rentalMode: 'long_term',
  publicStatus: 'available',
  published: true,
  internalNotes: 'Private intake note',
  auditLog: [{ type: 'created' }],
});

assert.equal(isPublicInventory(rental), true);
const publicRental = toPublicInventory(rental);
assert.equal(publicRental.slug, '4231-tulip-oak-dr');
assert.equal('internalNotes' in publicRental, false);
assert.equal('auditLog' in publicRental, false);

archiveInventory(rental, 'admin');
assert.equal(rental.published, false);
assert.equal(typeof rental.archivedAt, 'string');
assert.equal(rental.archivedBy, 'admin');
assert.equal(isPublicInventory(rental), false);

restoreInventory(rental, 'admin');
assert.equal(rental.publicStatus, 'draft');
assert.equal(rental.published, false);
assert.equal(rental.archivedAt, null);
assert.equal(rental.archivedBy, null);

assert.deepEqual(
  validateInventoryPatch({ publicStatus: 'booked', offeringType: 'rental' }),
  { ok: false, error: 'booked is only valid for stay offerings' },
);
assert.equal(validateInventoryPatch({ publicStatus: 'booked', offeringType: 'stay' }).ok, true);
assert.equal(validateInventoryPatch({ offeringType: 'sale', rentalMode: 'short_term' }).ok, false);
assert.equal(validateInventoryPatch({ slug: '../private' }).ok, false);

const publicRecords = filterPublicInventory({ inventory: {
  live: newInventory({ slug: 'live', publicStatus: 'available', published: true }),
  hidden: newInventory({ slug: 'hidden', publicStatus: 'available', published: false }),
  archived: archiveInventory(newInventory({ slug: 'archived', publicStatus: 'available', published: true })),
}});
assert.deepEqual(publicRecords.map((record) => record.slug), ['live']);

console.log('inventory domain tests passed');
