// public-form-common.js — shared helpers for the two token-gated public
// forms (client-verification, property-verification). Deliberately
// independent of the Smart Move funnel's JS.

const PublicForm = (() => {
  const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3MB

  function getToken() {
    return window.location.pathname.split('/').filter(Boolean).pop();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showError(title, message) {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('form-state').style.display = 'none';
    document.getElementById('success-state').style.display = 'none';
    const el = document.getElementById('error-state');
    el.style.display = 'block';
    el.querySelector('h1').textContent = title;
    el.querySelector('p').textContent = message;
  }

  function showSuccess(message) {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('form-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'none';
    const el = document.getElementById('success-state');
    el.style.display = 'block';
    if (message) el.querySelector('p').textContent = message;
  }

  async function verifyToken(role) {
    const token = getToken();
    if (!token) {
      showError('Link Not Found', 'This verification link is missing its access token.');
      return null;
    }
    const res = await fetch(`/api/forms/verify-token?role=${role}&token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!data.valid) {
      const messages = {
        expired: 'This verification link has expired. Please contact Joey Williams for a new one.',
        revoked: 'This verification link is no longer active. Please contact Joey Williams for a new one.',
        not_found: 'This verification link isn’t recognized. Double-check the link or contact Joey Williams.',
      };
      showError('Link Not Valid', messages[data.reason] || 'This verification link could not be verified.');
      return null;
    }
    if (data.locked) {
      showError('Already Verified', 'This rental placement file has already been reviewed and verified. Contact Joey Williams directly if anything needs to change.');
      return null;
    }
    return { token, ...data };
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        reject(new Error('File is too large (max 3MB). Please choose a smaller file or a compressed screenshot.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  function setFormError(message) {
    const el = document.getElementById('submit-error');
    if (!el) return;
    if (!message) {
      el.classList.remove('show');
      return;
    }
    el.textContent = message;
    el.classList.add('show');
  }

  return { getToken, escapeHtml, showError, showSuccess, verifyToken, readFileAsDataUrl, setFormError };
})();
