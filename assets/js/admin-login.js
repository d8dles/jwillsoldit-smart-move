let challengeId = null;
const errorBox = document.getElementById('login-error');

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.add('show');
}

// Only messages deliberately returned by the application are safe to show
// as-is. Unexpected browser/runtime exceptions are logged, while the user
// receives a plain message instead of implementation details.
function showFriendlyError(err, fallback) {
  const known = err instanceof Error && !(err instanceof TypeError) && !(err instanceof DOMException);
  if (!known) console.error('Unexpected sign-in error:', err);
  showError(known ? err.message : fallback);
}

function showPasswordStep() {
  challengeId = null;
  document.getElementById('code-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('code').value = '';
  document.getElementById('password').value = '';
}

function safeNextPath() {
  const value = new URLSearchParams(window.location.search).get('next');
  if (!value || !value.startsWith('/admin') || value.startsWith('//')) return '/admin/verifications';
  return value;
}

function finishLogin() {
  window.location.href = safeNextPath();
}

async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || 'Sign-in failed');
  return data;
}

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const btn = document.getElementById('login-submit');
  errorBox.classList.remove('show');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    const data = await postJson('/api/admin/login', {
      password: document.getElementById('password').value,
    });
    if (data.requires2fa) {
      challengeId = data.challengeId;
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('code-form').style.display = 'block';
      document.getElementById('code').focus();
    } else {
      finishLogin();
      return;
    }
  } catch (err) {
    showFriendlyError(err, 'Something went wrong signing in. Please try again.');
  }
  btn.disabled = false;
  btn.textContent = 'Sign In';
});

document.getElementById('code-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const btn = document.getElementById('code-submit');
  errorBox.classList.remove('show');
  btn.disabled = true;
  btn.textContent = 'Verifying…';
  try {
    const data = await postJson('/api/admin/verify-2fa', {
      challengeId,
      code: document.getElementById('code').value,
    });
    if (data.restart) showPasswordStep();
    finishLogin();
    return;
  } catch (err) {
    showFriendlyError(err, 'Something went wrong verifying the code. Please try again.');
  }
  btn.disabled = false;
  btn.textContent = 'Verify';
});

document.getElementById('code-restart').addEventListener('click', () => {
  errorBox.classList.remove('show');
  showPasswordStep();
});
