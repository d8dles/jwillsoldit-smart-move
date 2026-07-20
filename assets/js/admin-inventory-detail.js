(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  const id = window.location.pathname.split('/').filter(Boolean).pop();
  const api = (path = '', options) => AdminShell.api(`/api/admin/inventory/${encodeURIComponent(id)}${path}`, options);
  const typeEl = document.getElementById('offeringType');
  const modeEl = document.getElementById('rentalMode');
  const statusEl = document.getElementById('publicStatus');
  const stayCard = document.getElementById('stay-card');
  const labels = { draft: 'Draft', coming_soon: 'Coming Soon', available: 'Available', pending: 'Pending', rented: 'Rented', booked: 'Booked', sold: 'Sold', off_market: 'Off Market' };
  const statusByType = {
    sale: ['draft', 'coming_soon', 'available', 'pending', 'sold', 'off_market'],
    rental: ['draft', 'coming_soon', 'available', 'pending', 'rented', 'off_market'],
    stay: ['draft', 'coming_soon', 'available', 'pending', 'booked', 'off_market'],
  };
  let record = null;

  const value = (id) => document.getElementById(id).value;
  const setValue = (id, v) => { document.getElementById(id).value = v == null ? '' : v; };
  const lines = (id) => value(id).split('\n').map((item) => item.trim()).filter(Boolean);
  const numberOrNull = (id) => value(id) === '' ? null : Number(value(id));
  const isStay = () => typeEl.value === 'stay' || modeEl.value === 'short_term';

  function refreshTypeFields() {
    modeEl.disabled = typeEl.value === 'sale';
    if (typeEl.value === 'sale') modeEl.value = 'long_term';
    stayCard.style.display = isStay() ? 'block' : 'none';
    const allowed = statusByType[typeEl.value] || statusByType.rental;
    const current = statusEl.value;
    statusEl.innerHTML = allowed.map((status) => `<option value="${status}">${labels[status]}</option>`).join('');
    statusEl.value = allowed.includes(current) ? current : 'draft';
  }

  function fillStayDetails(details) {
    const stay = details || {};
    setValue('ratePeriod', stay.ratePeriod || 'night');
    setValue('minimumStay', stay.minimumStay);
    setValue('maxGuests', stay.maxGuests);
    setValue('bookingUrl', stay.bookingUrl);
    setValue('availabilityStart', stay.availabilityStart);
    setValue('availabilityEnd', stay.availabilityEnd);
    setValue('amenities', (stay.amenities || []).join('\n'));
    setValue('houseRules', (stay.houseRules || []).join('\n'));
  }

  function payload() {
    const mls = value('mlsUrl').trim();
    return {
      offeringType: typeEl.value,
      rentalMode: typeEl.value === 'sale' ? null : modeEl.value,
      slug: value('slug').trim(),
      publicPath: value('publicPath').trim(),
      publicStatus: statusEl.value,
      published: document.getElementById('published').checked,
      title: value('title').trim(), addressLine: value('addressLine').trim(), neighborhood: value('neighborhood').trim(),
      city: value('city').trim(), state: value('state').trim(), zip: value('zip').trim(), priceLabel: value('priceLabel').trim(),
      bedrooms: numberOrNull('bedrooms'), bathrooms: numberOrNull('bathrooms'), squareFeet: numberOrNull('squareFeet'),
      description: value('description').trim(), features: lines('features'), heroImageUrl: value('heroImageUrl').trim(),
      sourceLinks: mls ? [{ label: 'MLS / channel', url: mls }] : [],
      stayDetails: isStay() ? { ratePeriod: value('ratePeriod'), minimumStay: numberOrNull('minimumStay'), maxGuests: numberOrNull('maxGuests'), bookingUrl: value('bookingUrl').trim(), availabilityStart: value('availabilityStart'), availabilityEnd: value('availabilityEnd'), amenities: lines('amenities'), houseRules: lines('houseRules') } : null,
      internalNotes: value('internalNotes').trim(),
    };
  }

  function render() {
    document.getElementById('inventory-loading').style.display = 'none';
    document.getElementById('inventory-state').style.display = 'block';
    document.getElementById('inventory-title').textContent = record.addressLine || record.title || record.slug;
    document.getElementById('inventory-sub').textContent = `${record.offeringType} · ${record.slug} · updated ${AdminShell.formatDate(record.updatedAt)}`;
    const badge = document.getElementById('inventory-badge');
    badge.textContent = record.archivedAt ? 'Archived' : labels[record.publicStatus] || record.publicStatus;
    badge.className = `badge status-${record.archivedAt ? 'archived' : record.publicStatus}`;
    typeEl.value = record.offeringType;
    modeEl.value = record.rentalMode || 'long_term';
    setValue('slug', record.slug); setValue('publicPath', record.publicPath); setValue('priceLabel', record.priceLabel);
    setValue('title', record.title); setValue('addressLine', record.addressLine); setValue('neighborhood', record.neighborhood);
    setValue('city', record.city); setValue('state', record.state); setValue('zip', record.zip); setValue('bedrooms', record.bedrooms);
    setValue('bathrooms', record.bathrooms); setValue('squareFeet', record.squareFeet); setValue('description', record.description);
    setValue('features', (record.features || []).join('\n')); setValue('heroImageUrl', record.heroImageUrl); setValue('mlsUrl', record.sourceLinks?.[0]?.url || '');
    setValue('internalNotes', record.internalNotes); document.getElementById('published').checked = !!record.published;
    statusEl.value = record.publicStatus;
    fillStayDetails(record.stayDetails);
    refreshTypeFields();
    statusEl.value = record.publicStatus;
    document.getElementById('view-public').href = record.publicPath || '#';
    document.getElementById('archive-inventory').style.display = record.archivedAt ? 'none' : 'inline-flex';
    document.getElementById('restore-inventory').style.display = record.archivedAt ? 'inline-flex' : 'none';
  }

  async function load() {
    try { const data = await api(); record = data.inventory; render(); }
    catch (err) { document.getElementById('inventory-loading').textContent = `Could not load inventory: ${err.message}`; }
  }

  typeEl.addEventListener('change', refreshTypeFields);
  modeEl.addEventListener('change', refreshTypeFields);
  document.getElementById('save-inventory').addEventListener('click', async () => {
    const error = document.getElementById('inventory-error'); error.classList.remove('show');
    try { const data = await api('', { method: 'PATCH', body: JSON.stringify(payload()) }); record = data.inventory; render(); AdminShell.toast('Inventory saved'); }
    catch (err) { error.textContent = err.message; error.classList.add('show'); }
  });
  document.getElementById('archive-inventory').addEventListener('click', async () => {
    if (!window.confirm('Archive this property? It will disappear from all public listings.')) return;
    try { const data = await api('', { method: 'PATCH', body: JSON.stringify({ archived: true }) }); record = data.inventory; render(); AdminShell.toast('Property archived'); }
    catch (err) { AdminShell.toast(err.message, { error: true }); }
  });
  document.getElementById('restore-inventory').addEventListener('click', async () => {
    try { const data = await api('', { method: 'PATCH', body: JSON.stringify({ archived: false }) }); record = data.inventory; render(); AdminShell.toast('Property restored as draft'); }
    catch (err) { AdminShell.toast(err.message, { error: true }); }
  });
  await load();
})();
