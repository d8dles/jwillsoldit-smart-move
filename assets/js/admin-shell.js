// admin-shell.js — shared helpers for every /admin page: authenticated
// fetch wrapper, session guard, toast, small DOM utilities. Classic script,
// loaded before each page's own script. Deliberately independent of the
// public Smart Move funnel's JS (state.js/config.js/steps.js/etc.) — this
// module never touches that code or its globals.

const AdminShell = (() => {
  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (res.status === 401) {
      window.location.href = '/admin/login.html?next=' + encodeURIComponent(window.location.pathname);
      throw new Error('Not authenticated');
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
        window.location.href = '/admin/login.html?next=' + encodeURIComponent(window.location.pathname);
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
        try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* ignore */ }
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
