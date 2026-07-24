// admin-shell.js — shared helpers for every /admin page: authenticated
// fetch wrapper, session guard, toast, small DOM utilities. Classic script,
// loaded before each page's own script. Deliberately independent of the
// public Smart Move funnel's JS (state.js/config.js/steps.js/etc.) — this
// module never touches that code or its globals.

const AdminShell = (() => {
  function readCookie(name) {
    const prefix = `${name}=`;
    for (const part of document.cookie.split(';')) {
      const value = part.trim();
      if (!value.startsWith(prefix)) continue;
      try { return decodeURIComponent(value.slice(prefix.length)); } catch { return value.slice(prefix.length); }
    }
    return '';
  }

  async function api(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrf = readCookie('smadmin_csrf');
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }

    const res = await fetch(path, {
      ...options,
      method,
      credentials: 'same-origin',
      headers,
    });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (res.status === 401) {
      window.location.href = '/admin/login.html?next=' + encodeURIComponent(window.location.pathname + window.location.search);
      throw new Error('Not authenticated');
    }
    if (res.status === 403 && data?.error?.toLowerCase().includes('security token')) {
      window.location.href = '/admin/login.html?next=' + encodeURIComponent(window.location.pathname + window.location.search);
      throw new Error('Your session security token expired. Please sign in again.');
    }
    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  }

  async function requireSession() {
    try {
      const data = await api('/api/admin/session');
      if (!data.authenticated) {
        window.location.href = '/admin/login.html?next=' + encodeURIComponent(window.location.pathname + window.location.search);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let toastTimer = null;
  function toast(message, { error = false } = {}) {
    let el = document.getElementById('admin-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'admin-toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle('error', !!error);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function wireTopbar() {
    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } catch { /* ignore */ }
        window.location.href = '/admin/login.html';
      });
    }
    const page = document.body.dataset.page;
    document.querySelectorAll('.admin-nav a[data-nav]').forEach((a) => {
      if (page && a.dataset.nav === page) a.classList.add('active');
    });
  }

  document.addEventListener('DOMContentLoaded', wireTopbar);

  return { api, requireSession, escapeHtml, toast, formatDate, copyToClipboard };
})();
