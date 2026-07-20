(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  const form = document.getElementById('inventory-form');
  const typeEl = document.getElementById('offeringType');
  const modeEl = document.getElementById('rentalMode');
  const stayCard = document.getElementById('stay-card');
  const slugEl = document.getElementById('slug');
  const pathEl = document.getElementById('publicPath');

  function isStay() {
    return typeEl.value === 'stay' || modeEl.value === 'short_term';
  }

  function refreshTypeFields() {
    modeEl.disabled = typeEl.value === 'sale';
    if (typeEl.value === 'sale') modeEl.value = 'long_term';
    stayCard.style.display = isStay() ? 'block' : 'none';
  }

  function numberOrNull(id) {
    const value = document.getElementById(id).value;
    return value === '' ? null : Number(value);
  }

  function lines(id) {
    return document.getElementById(id).value.split('\n').map((item) => item.trim()).filter(Boolean);
  }

  function stayDetails() {
    if (!isStay()) return null;
    return {
      ratePeriod: document.getElementById('ratePeriod').value,
      minimumStay: numberOrNull('minimumStay'),
      maxGuests: numberOrNull('maxGuests'),
      bookingUrl: document.getElementById('bookingUrl').value.trim(),
      availabilityStart: document.getElementById('availabilityStart').value,
      availabilityEnd: document.getElementById('availabilityEnd').value,
      amenities: lines('amenities'),
      houseRules: lines('houseRules'),
    };
  }

  function payload() {
    return {
      offeringType: typeEl.value,
      rentalMode: typeEl.value === 'sale' ? null : modeEl.value,
      slug: slugEl.value.trim(),
      publicPath: pathEl.value.trim(),
      publicStatus: document.getElementById('publicStatus').value,
      published: document.getElementById('published').checked,
      title: document.getElementById('title').value.trim(),
      addressLine: document.getElementById('addressLine').value.trim(),
      neighborhood: document.getElementById('neighborhood').value.trim(),
      city: document.getElementById('city').value.trim(),
      state: document.getElementById('state').value.trim(),
      zip: document.getElementById('zip').value.trim(),
      priceLabel: document.getElementById('priceLabel').value.trim(),
      bedrooms: numberOrNull('bedrooms'),
      bathrooms: numberOrNull('bathrooms'),
      squareFeet: numberOrNull('squareFeet'),
      description: document.getElementById('description').value.trim(),
      features: lines('features'),
      heroImageUrl: document.getElementById('heroImageUrl').value.trim(),
      sourceLinks: document.getElementById('mlsUrl').value.trim() ? [{ label: 'MLS / channel', url: document.getElementById('mlsUrl').value.trim() }] : [],
      stayDetails: stayDetails(),
      internalNotes: document.getElementById('internalNotes').value.trim(),
    };
  }

  typeEl.addEventListener('change', refreshTypeFields);
  modeEl.addEventListener('change', refreshTypeFields);
  slugEl.addEventListener('input', () => {
    if (!pathEl.value || pathEl.dataset.auto === 'true') {
      const segment = typeEl.value === 'sale' ? 'listings/sales' : typeEl.value === 'stay' ? 'listings/stays' : 'listings/rentals';
      pathEl.value = `/${segment}/${slugEl.value.trim()}/`;
      pathEl.dataset.auto = 'true';
    }
  });
  pathEl.addEventListener('input', () => { pathEl.dataset.auto = 'false'; });
  refreshTypeFields();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('inventory-submit');
    const error = document.getElementById('inventory-error');
    error.classList.remove('show');
    button.disabled = true;
    button.textContent = 'Creating…';
    try {
      const data = await AdminShell.api('/api/admin/inventory', { method: 'POST', body: JSON.stringify(payload()) });
      window.location.href = `/admin/inventory/${encodeURIComponent(data.inventory.id)}`;
    } catch (err) {
      error.textContent = err.message;
      error.classList.add('show');
      button.disabled = false;
      button.textContent = 'Create Inventory Record';
    }
  });
})();
