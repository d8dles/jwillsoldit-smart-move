'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await getSupabase().auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-box">
        <h1>COMMAND CENTER</h1>
        <p>One screen. The day, already sorted.</p>
        <form onSubmit={submit}>
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="btn-signal" type="submit" disabled={busy}>
            {busy ? 'Checking' : 'Enter'}
          </button>
        </form>
        {error ? <div className="error">{error}</div> : null}
      </div>
    </div>
  );
}
