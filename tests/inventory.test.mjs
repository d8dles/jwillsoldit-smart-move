import assert from 'node:assert/strict';
import {
  newInventory,
  isPublicInventory,
  toPublicInventory,
  archiveInventory,
  restoreInventory,
  validateInventoryPatch,
} from '../api/_lib/inventory.js';

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

console.log('inventory domain tests passed');
