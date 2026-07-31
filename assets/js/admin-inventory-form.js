function cleanImage(image) {
  if (!image || typeof image !== 'object') return null;
  const src = String(image.src || '').trim();
  const alt = String(image.alt || '').trim();
  if (!src || !alt) return null;
  const result = { src, alt };
  const srcSet = String(image.srcSet || '').trim();
  if (srcSet) result.srcSet = srcSet;
  return result;
}

function cleanGallery(gallery) {
  return Array.isArray(gallery) ? gallery.map(cleanImage).filter(Boolean) : [];
}

export function serializeInventoryForm(fields = {}) {
  return {
    ...fields,
    heroImage: cleanImage(fields.heroImage),
    gallery: cleanGallery(fields.gallery),
    propertyDetails: fields.propertyDetails && typeof fields.propertyDetails === 'object'
      ? { ...fields.propertyDetails }
      : {},
  };
}

function input(label, value, attribute, type = 'text') {
  const wrapper = document.createElement('label');
  wrapper.className = 'inventory-gallery-field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const element = document.createElement('input');
  element.type = type;
  element.value = value || '';
  element.setAttribute(attribute, '');
  wrapper.append(caption, element);
  return wrapper;
}

function renderRow(container, image = {}) {
  const row = document.createElement('div');
  row.className = 'inventory-gallery-row';
  row.append(
    input('Image URL', image.src, 'data-gallery-src', 'url'),
    input('Alt text', image.alt, 'data-gallery-alt'),
    input('Responsive sources', image.srcSet, 'data-gallery-srcset'),
  );

  const controls = document.createElement('div');
  controls.className = 'inventory-gallery-controls';
  for (const [label, action] of [['Move up', 'up'], ['Move down', 'down'], ['Remove', 'remove']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-btn ghost small';
    button.textContent = label;
    button.addEventListener('click', () => {
      if (action === 'remove') row.remove();
      if (action === 'up' && row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling);
      if (action === 'down' && row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row);
    });
    controls.append(button);
  }
  row.append(controls);
  container.append(row);
}

export function renderGalleryRows(container, gallery = []) {
  container.replaceChildren();
  for (const image of gallery) renderRow(container, image);
}

export function readGalleryRows(container) {
  return [...container.querySelectorAll('.inventory-gallery-row')].map((row) => ({
    src: row.querySelector('[data-gallery-src]').value.trim(),
    alt: row.querySelector('[data-gallery-alt]').value.trim(),
    srcSet: row.querySelector('[data-gallery-srcset]').value.trim(),
  })).filter((image) => image.src || image.alt || image.srcSet);
}

export function setupGalleryEditor(container, addButton) {
  addButton.addEventListener('click', () => renderRow(container));
}
